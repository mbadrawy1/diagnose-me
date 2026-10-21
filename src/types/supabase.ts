export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      alerts_and_reminders: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          scheduled_for: string | null
          title: string
          type: Database["public"]["Enums"]["alert_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          scheduled_for?: string | null
          title: string
          type: Database["public"]["Enums"]["alert_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          scheduled_for?: string | null
          title?: string
          type?: Database["public"]["Enums"]["alert_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_and_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_reports: {
        Row: {
          ai_recommendations: string | null
          confidence_score: number | null
          created_at: string
          doctor_id: string | null
          doctor_notes: string | null
          doctor_validated: boolean
          file_storage_path: string | null
          id: string
          model_used: Database["public"]["Enums"]["model_type"]
          patient_id: string
          prediction_result: Json | null
          risk_level: Database["public"]["Enums"]["risk_level"] | null
          validated_at: string | null
        }
        Insert: {
          ai_recommendations?: string | null
          confidence_score?: number | null
          created_at?: string
          doctor_id?: string | null
          doctor_notes?: string | null
          doctor_validated?: boolean
          file_storage_path?: string | null
          id?: string
          model_used: Database["public"]["Enums"]["model_type"]
          patient_id: string
          prediction_result?: Json | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          validated_at?: string | null
        }
        Update: {
          ai_recommendations?: string | null
          confidence_score?: number | null
          created_at?: string
          doctor_id?: string | null
          doctor_notes?: string | null
          doctor_validated?: boolean
          file_storage_path?: string | null
          id?: string
          model_used?: Database["public"]["Enums"]["model_type"]
          patient_id?: string
          prediction_result?: Json | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_reports_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_profiles: {
        Row: {
          allergies: string[]
          blood_type: string | null
          chronic_diseases: string[]
          health_metrics_json: Json
          id: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          allergies?: string[]
          blood_type?: string | null
          chronic_diseases?: string[]
          health_metrics_json?: Json
          id?: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          allergies?: string[]
          blood_type?: string | null
          chronic_diseases?: string[]
          health_metrics_json?: Json
          id?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_profiles_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          specialization: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          specialization?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          specialization?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_provider: { Args: never; Returns: boolean }
      submit_diagnostic_report: {
        Args: {
          p_ai_recommendations: string
          p_confidence_score: number
          p_file_storage_path: string
          p_model_used: Database["public"]["Enums"]["model_type"]
          p_prediction_result: Json
          p_risk_level: Database["public"]["Enums"]["risk_level"]
        }
        Returns: {
          ai_recommendations: string | null
          confidence_score: number | null
          created_at: string
          doctor_id: string | null
          doctor_notes: string | null
          doctor_validated: boolean
          file_storage_path: string | null
          id: string
          model_used: Database["public"]["Enums"]["model_type"]
          patient_id: string
          prediction_result: Json | null
          risk_level: Database["public"]["Enums"]["risk_level"] | null
          validated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "diagnostic_reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      alert_type: "risk_alert" | "appointment_reminder"
      model_type: "model_1" | "model_2" | "model_3"
      risk_level: "low" | "medium" | "high" | "critical"
      user_role: "patient" | "doctor" | "hospital" | "clinic"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_type: ["risk_alert", "appointment_reminder"],
      model_type: ["model_1", "model_2", "model_3"],
      risk_level: ["low", "medium", "high", "critical"],
      user_role: ["patient", "doctor", "hospital", "clinic"],
    },
  },
} as const
