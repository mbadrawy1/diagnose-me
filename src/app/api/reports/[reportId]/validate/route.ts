import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const body = await request.json().catch(() => ({}));
    const { notes = "" } = body;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role === "patient") {
      return NextResponse.json({ error: "Only verified healthcare providers can validate reports" }, { status: 403 });
    }

    const { data: report, error } = await supabase
      .from("diagnostic_reports")
      .update({
        doctor_id: user.id,
        doctor_validated: true,
        doctor_notes: notes,
        validated_at: new Date().toISOString(),
      })
      .eq("id", reportId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Optional: send alert/notification to patient
    if (report?.patient_id) {
      await supabase.from("alerts_and_reminders").insert({
        user_id: report.patient_id,
        type: "appointment_reminder",
        title: "Clinical Report Validated",
        message: `Dr. ${profile.full_name || "Specialist"} has reviewed and clinically validated your ${report.model_used} diagnostic report.`,
      });
    }

    return NextResponse.json({ report });
  } catch (err) {
    console.error("Report validate error:", err);
    return NextResponse.json({ error: "Failed to validate report" }, { status: 500 });
  }
}
