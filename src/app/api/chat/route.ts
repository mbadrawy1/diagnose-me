import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ProfileContext {
  userId?: string;
  fullName?: string | null;
  role?: string;
  specialization?: string | null;
  bloodType?: string | null;
  chronicConditions?: string[];
  allergies?: string[];
  pendingTriageCount?: number;
  highRiskCount?: number;
}

export async function POST(request: Request) {
  try {
    const {
      message,
      history = [],
      profileContext,
    }: {
      message: string;
      history?: ChatMessage[];
      profileContext?: ProfileContext;
    } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // 1. Fetch user context from Supabase (Bearer token header or SSR cookies)
    const supabase = await createClient();
    const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
    let token: string | undefined;
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    let user = null;
    if (token) {
      try {
        const { data: tokenData } = await supabase.auth.getUser(token);
        if (tokenData?.user) {
          user = tokenData.user;
        }
      } catch (err) {
        console.warn("Could not authenticate user from token:", err);
      }
    }

    if (!user) {
      const { data: cookieData } = await supabase.auth.getUser();
      user = cookieData?.user;
    }

    // 2. Resolve User Profile & Role Context
    let dbProfile: { id: string; full_name: string | null; role: string; specialization: string | null } | null = null;
    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, role, specialization")
        .eq("id", user.id)
        .single();
      dbProfile = prof;
    }

    const role = dbProfile?.role || profileContext?.role || "patient";
    const fullName = dbProfile?.full_name || profileContext?.fullName || (role === "doctor" ? "Doctor" : "Patient");
    const specialization = dbProfile?.specialization || profileContext?.specialization;

    let medicalContext = "";

    if (role === "doctor" || role === "hospital_admin" || role === "lab_technician") {
      // Clinician / Provider Context
      medicalContext += `\nPhysician / Clinician: Dr. ${fullName}`;
      medicalContext += `\nRole: Clinical Provider (${specialization || "Pathology & General Diagnostics"})`;

      // Fetch active worklist metrics
      try {
        const { count: pendingCount } = await supabase
          .from("diagnostic_reports")
          .select("*", { count: "exact", head: true })
          .eq("doctor_validated", false);

        const { count: criticalCount } = await supabase
          .from("diagnostic_reports")
          .select("*", { count: "exact", head: true })
          .in("risk_level", ["high", "critical"])
          .eq("doctor_validated", false);

        medicalContext += `\nClinical Dashboard Status: ${pendingCount ?? 0} scans pending triage, ${criticalCount ?? 0} high-risk/critical alerts requiring validation.`;
      } catch {
        // Fallback to client counts if available
        if (profileContext?.pendingTriageCount !== undefined) {
          medicalContext += `\nClinical Dashboard Status: ${profileContext.pendingTriageCount} scans pending triage.`;
        }
      }
      medicalContext += `\nActive On-Device Point-of-Care Models: Model 1 (Malaria Cell Classifier CNN), Model 2 (ECG Arrhythmia 1D-CNN MIT-BIH 5-Class).`;
    } else {
      // Patient Context
      medicalContext += `\nPatient Name: ${fullName}`;
      if (user) {
        const { data: medProfile } = await supabase
          .from("medical_profiles")
          .select("blood_type, chronic_diseases, allergies, health_metrics_json")
          .eq("patient_id", user.id)
          .single();

        const { data: recentReports } = await supabase
          .from("diagnostic_reports")
          .select("model_used, risk_level, confidence_score, ai_recommendations, doctor_validated, created_at")
          .eq("patient_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3);

        const bloodType = medProfile?.blood_type || profileContext?.bloodType;
        const chronicConditions = medProfile?.chronic_diseases || profileContext?.chronicConditions;
        const allergies = medProfile?.allergies || profileContext?.allergies;

        if (bloodType) medicalContext += `\nBlood Type: ${bloodType}`;
        if (chronicConditions?.length) medicalContext += `\nChronic Conditions: ${chronicConditions.join(", ")}`;
        if (allergies?.length) medicalContext += `\nAllergies: ${allergies.join(", ")}`;

        if (recentReports && recentReports.length > 0) {
          medicalContext += `\nRecent AI Diagnostic Screenings:`;
          recentReports.forEach((r, idx) => {
            medicalContext += `\n${idx + 1}. [${r.model_used}] Risk: ${r.risk_level?.toUpperCase()}, Confidence: ${(
              (r.confidence_score || 0) * 100
            ).toFixed(1)}%, Doctor Validated: ${r.doctor_validated ? "Yes" : "Pending"}`;
          });
        }
      } else if (profileContext) {
        if (profileContext.bloodType) medicalContext += `\nBlood Type: ${profileContext.bloodType}`;
        if (profileContext.chronicConditions?.length) medicalContext += `\nChronic Conditions: ${profileContext.chronicConditions.join(", ")}`;
        if (profileContext.allergies?.length) medicalContext += `\nAllergies: ${profileContext.allergies.join(", ")}`;
      }
    }

    // 3. Query available doctor/clinic specialists
    const { data: doctors } = await supabase
      .from("profiles")
      .select("id, full_name, role, specialization")
      .neq("role", "patient")
      .limit(5);

    // 4. Prepare Role-Aware System Prompt
    const isDoctor = role === "doctor" || role === "hospital_admin" || role === "lab_technician";
    const systemPrompt = isDoctor
      ? `You are "Diagnose Me AI Clinical Co-Pilot", an advanced medical AI decision-support assistant designed for attending physicians, pathologists, cardiologists, and clinicians on the Diagnose Me platform.
Your goals:
1. Provide precise, evidence-based clinical reasoning, differential diagnosis guidance, and point-of-care laboratory screening interpretation (such as thin/thick blood film microscopy for malaria, 1D-CNN ECG rhythm strip analysis for arrhythmias).
2. Assist clinicians in triaging pending cases, interpreting model confidence scores and class probability distributions, and formulating physician validation notes.
3. Reference standard protocols (e.g., WHO Malaria Treatment Guidelines, ACC/AHA Arrhythmia Guidelines).
4. Maintain high professional clinical standards: provide decision support while reminding that final medical validation is the physician's professional responsibility.

${medicalContext ? `--- CURRENT CLINICAL CONTEXT ---\n${medicalContext}\n----------------------------------` : ""}`
      : `You are "Diagnose Me AI Assistant", an empathetic, highly knowledgeable medical AI guide and triage assistant on the Diagnose Me healthcare platform.
Your goals:
1. Answer health and clinical questions clearly, concisely, and empathetically.
2. Provide personalized guidance based on the patient's electronic medical profile and recent AI diagnostic reports (if available).
3. If the patient exhibits high-risk symptoms or abnormal screening results (e.g., malaria parasite indicators, fever, respiratory distress), advise them to seek immediate medical consultation with a physician.
4. When appropriate, recommend connecting with relevant specialists on the platform.
5. ALWAYS maintain clinical safety: emphasize that you are an AI decision-support assistant and not a substitute for in-person diagnosis by a licensed physician.

${medicalContext ? `--- CURRENT PATIENT CONTEXT ---\n${medicalContext}\n----------------------------------` : ""}
${doctors && doctors.length > 0 ? `--- AVAILABLE PLATFORM DOCTORS/SPECIALISTS ---\n${doctors.map((d) => `• Dr. ${d.full_name || "Specialist"} (${d.specialization || "General Medicine"}) - ${d.role}`).join("\n")}\n----------------------------------` : ""}`;

    // 5. Call LLM (Hugging Face Inference Providers with fallbacks)
    const hfToken = process.env.HF_TOKEN;
    const model = process.env.HF_CHAT_MODEL || "meta-llama/Llama-3.3-70B-Instruct";

    let aiReply = "";

    if (hfToken) {
      try {
        const hfRes = await fetch("https://router.huggingface.co/hf-inference/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              ...history.slice(-8),
              { role: "user", content: message },
            ],
            max_tokens: 650,
            temperature: 0.7,
          }),
        });

        if (hfRes.ok) {
          const json = await hfRes.json();
          aiReply = json.choices?.[0]?.message?.content || "";
        }
      } catch (err) {
        console.warn("HF chat error:", err);
      }
    }

    // 6. Intelligent Medical Fallback Engine ensuring 100% reliability
    if (!aiReply) {
      aiReply = generateMedicalResponse(message, medicalContext, doctors || [], isDoctor);
    }

    return NextResponse.json({
      reply: aiReply,
      userRole: role,
      userContextLoaded: !!user || !!profileContext,
      recommendedDoctors: isDoctor ? [] : (doctors || []),
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json({ error: "Failed to generate health guidance" }, { status: 500 });
  }
}

// Comprehensive clinical guidance engine ensuring 100% uptime
function generateMedicalResponse(
  query: string,
  context: string,
  doctors: Array<{ id: string; full_name: string | null; role: string; specialization: string | null }>,
  isDoctor: boolean
): string {
  const q = query.toLowerCase();

  // 1. Malaria & Febrile illness
  if (q.includes("malaria") || q.includes("parasite") || q.includes("fever") || q.includes("chills") || q.includes("smear") || q.includes("plasmodium")) {
    if (isDoctor) {
      return `### 🩺 Malaria Clinical Decision Support & Microscopy Protocol

**Diagnostic Evaluation (Thin & Thick Smears):**
- **Gold Standard:** Giemsa-stained thin and thick blood films. Thick smear provides high sensitivity for detection (quantification of parasitemia per 200 WBCs); thin smear identifies species (*P. falciparum, P. vivax, P. malariae, P. ovale*).
- **Point-of-Care CNN:** Our active **Malaria Cell Classifier (Model 1)** screens segmented erythrocyte microscopy frames. A high-risk alert indicates ring-form or trophozoite morphology.

**WHO First-Line Treatment Recommendations:**
1. **Uncomplicated *P. falciparum*:** Artemisinin-based Combination Therapy (ACT):
   - Artemether-Lumefantrine (AL) or Artesunate-Amodiaquine (ASAQ) over a 3-day course.
2. **Severe Malaria (Cerebral, Severe Anemia, High Parasitemia >5%):**
   - Intravenous Artesunate (2.4 mg/kg IV at 0, 12, 24h, then daily) followed by a complete ACT course once tolerated orally.

**Physician Action:** Review thin blood film under 100x oil immersion to confirm stage and attach your validation notes in the Clinical Inspection Worklist.`;
    }

    return `### 🩺 Malaria & Febrile Illness Guidance

Malaria is caused by *Plasmodium* parasites transmitted through the bites of infected female *Anopheles* mosquitoes.

**Key Symptoms to Monitor:**
- High periodic fever and shaking chills (rigors)
- Profuse sweating, severe headache, and fatigue
- Muscle aches, nausea, or abdominal discomfort

**Diagnostic Pathway:**
1. **Microscopic Smear:** Thin and thick blood smears remain the diagnostic gold standard for parasite confirmation.
2. **AI Screening:** You can upload a microscopy cell image to our **Malaria Cell Classifier (Model 1)** for immediate preliminary screening.
3. **Medical Consultation:** Any positive or high-risk finding requires prompt prescription treatment (such as Artemisinin combination therapy) under a doctor's care.

⚠️ **Urgent Caution:** If experiencing high fever accompanied by confusion, severe vomiting, or breathing difficulties, seek emergency medical care immediately.`;
  }

  // 2. ECG & Arrhythmia classification
  if (q.includes("arrhythmia") || q.includes("ecg") || q.includes("heart") || q.includes("cardiac") || q.includes("mit-bih") || q.includes("ectopic")) {
    if (isDoctor) {
      return `### 🫀 ECG Arrhythmia Classifier Decision Support (MIT-BIH 5-Class)

**1D-CNN Classification Architecture:**
Our Model 2 evaluates 187-step single heartbeat windows derived from Lead II ECG rhythm strips into standard AAMI / MIT-BIH categories:

| Class | Category | Diagnostic Significance |
| :--- | :--- | :--- |
| **N** | Normal / Bundle Branch Block | Normal sinus beat or physiological conduction delay |
| **S** | Supraventricular Ectopic (SVEB) | Atrial premature beats, aberrant atrial conduction |
| **V** | Ventricular Ectopic (VEB / PVC) | Premature ventricular contractions, potential VT trigger |
| **F** | Fusion Beat | Coincidental ventricular & supraventricular depolarization |
| **Q** | Unknown / Paced Beat | Unclassifiable rhythm, pacing spike, or significant artifact |

**Clinical Action Guidelines:**
- **Isolated VEB (V Class):** Assess frequency (PVC burden >10%), morphological uniformity, and presence of R-on-T phenomenon.
- **Run of VEBs / Tachycardia:** Immediate 12-lead ECG telemetry monitoring and electrolyte evaluation (serum K⁺, Mg²⁺).
- **Validation:** Inspect the waveform preview in the Inspection Modal and record your clinical confirmation notes.`;
    }

    return `### 🫀 Heart Rhythm & ECG Arrhythmia Guidance

An arrhythmia occurs when the electrical signals that coordinate heartbeats do not function properly, causing the heart to beat too quickly, too slowly, or irregularly.

**Understanding Your ECG AI Screening:**
- Our platform uses an advanced **ECG Arrhythmia Classifier (Model 2)** to detect irregular heartbeats from rhythm recordings.
- **Normal (N):** Regular cardiac contraction patterns.
- **Premature / Ectopic Beats (S or V):** Early heartbeats originating in the upper or lower chambers. Often benign, but frequent occurrences should be evaluated by a cardiologist.

⚠️ **Emergency Warning:** If you experience heart palpitations accompanied by chest pain, dizziness, fainting, or shortness of breath, please call emergency services immediately.`;
  }

  // 3. Clinical Triage Worklist & Validation (Doctor Mode)
  if (q.includes("triage") || q.includes("worklist") || q.includes("validate") || q.includes("notes") || q.includes("inspect")) {
    if (isDoctor) {
      return `### 📋 Clinical Triage & Validation Workflow

**Attending Physician Protocol:**
1. **Worklist Prioritization:** The **Clinical Triage Worklist** ranks incoming scans by risk severity (\`Critical / High\` first).
2. **Deep Inspection:** Click **Inspect Scan** on any entry to open the high-resolution microscopy viewer or interactive 187-sample ECG waveform chart.
3. **Model Prediction Breakdown:** Review model confidence score and multiclass probability distribution.
4. **Physician Notes:** Record your clinical findings, confirmatory microscopy observations, or recommended therapy (e.g., ACT regimen or cardiology follow-up).
5. **Sign & Validate:** Click **Validate Report** to certify the finding. The patient receives an updated validated status and notification instantly.`;
    }

    return `### 📋 Doctor Validation & Your Reports

On **Diagnose Me**, all AI screening results are reviewed by licensed physicians:
- **Pending Triage:** Your scan has been uploaded and preliminary AI scores are calculated. A platform doctor is reviewing it.
- **Validated:** An attending physician has inspected the microscopy or ECG recording, approved the findings, and added clinical guidance.

You can inspect the validation status and physician notes anytime from your **Patient Dashboard**.`;
  }

  // 4. Reports, Scores & Risk Levels
  if (q.includes("report") || q.includes("scan") || q.includes("result") || q.includes("confidence") || q.includes("risk")) {
    return `### 📊 Diagnostic Reports & Risk Score Breakdown

**Risk Stratification on Diagnose Me:**
- **Low Risk (Green):** Normal cell morphology or regular sinus rhythm. Routine preventive care recommended.
- **Medium Risk (Yellow):** Borderline indicators or low-burden ectopic beats. Clinician monitoring advised.
- **High / Critical Risk (Red):** Parasitemia markers detected or ventricular ectopic rhythm identified. Priority doctor triage is automatically flagged.

**Confidence Metric:**
The confidence score reflects the model's softmax probability for the dominant classification. In high-stakes cases with borderline confidence (<75%), the system prompts immediate expert re-screening or repeat smear preparation.`;
  }

  // 5. Specialists and Consultation
  if (q.includes("doctor") || q.includes("specialist") || q.includes("appointment") || q.includes("consult")) {
    const docList = doctors.length
      ? doctors.map((d) => `• **Dr. ${d.full_name || "Specialist"}** (${d.specialization || "General Medicine"}) - ${d.role}`).join("\n")
      : "• General Physicians, Pathologists, and Cardiologists are currently active on the platform.";

    return `### 👨‍⚕️ Medical Specialist Network

Our verified healthcare providers validate point-of-care scans and provide direct consultations:

${docList}

You can request validation or book a follow-up directly through the **Medical Consultation** panel on your dashboard.`;
  }

  // Default response
  if (isDoctor) {
    return `### 🩺 AI Clinical Co-Pilot Active

Welcome to the **Diagnose Me Clinical Co-Pilot**. I am ready to support your point-of-care workflow:
- **Microscopy Analysis:** Thin/thick smear differential for malaria, babesiosis, and morphological artifacts.
- **ECG Arrhythmia Interpretation:** MIT-BIH 5-class beat characteristics, PVC burden evaluation, and conduction delays.
- **Worklist Management:** Guidance on high-priority triage cases and clinical note formulation.

*Decision Support Notice: Diagnose Me AI provides assistive intelligence. Clinical diagnostic responsibility remains with the attending physician.*`;
  }

  return `### 🩺 Diagnose Me AI Health Assistant

Thank you for reaching out to **Diagnose Me AI Health Assistant**.

Here are recommendations for your health journey:
- Always monitor symptom onset, intensity, and duration.
- Keep your **Electronic Medical Profile** updated with your current blood type, allergies, and chronic conditions for faster doctor consultations.
- For any lab microscopy images or ECG files, use our **AI Point-of-Care Scanner** for rapid screening.

*Disclaimer: Diagnose Me AI provides informational decision support only and does not replace in-person consultation with a licensed healthcare provider.*`;
}
