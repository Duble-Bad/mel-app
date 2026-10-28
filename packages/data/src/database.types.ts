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
      lost_cases: {
        Row: {
          city: string | null
          contact_chat: boolean
          contact_phone: string | null
          contact_phone_public: boolean
          contact_whatsapp_public: boolean
          created_at: string
          found_at: string | null
          found_how: string | null
          id: string
          indexable: boolean
          last_seen_label: string | null
          last_seen_lat: number | null
          last_seen_lng: number | null
          last_seen_point: unknown
          lost_at: string | null
          lost_at_uncertain: boolean
          notes: string | null
          owner_id: string
          pet_id: string
          public_area_label: string | null
          public_lat: number | null
          public_lng: number | null
          public_point: unknown
          public_point_exact: boolean
          published_at: string | null
          reunion_story: string | null
          short_code: string
          state: string | null
          status: Database["public"]["Enums"]["lost_case_status"]
          updated_at: string
          wearing: string[]
        }
        Insert: {
          city?: string | null
          contact_chat?: boolean
          contact_phone?: string | null
          contact_phone_public?: boolean
          contact_whatsapp_public?: boolean
          created_at?: string
          found_at?: string | null
          found_how?: string | null
          id?: string
          indexable?: boolean
          last_seen_label?: string | null
          last_seen_lat?: number | null
          last_seen_lng?: number | null
          last_seen_point?: unknown
          lost_at?: string | null
          lost_at_uncertain?: boolean
          notes?: string | null
          owner_id: string
          pet_id: string
          public_area_label?: string | null
          public_lat?: number | null
          public_lng?: number | null
          public_point?: unknown
          public_point_exact?: boolean
          published_at?: string | null
          reunion_story?: string | null
          short_code?: string
          state?: string | null
          status?: Database["public"]["Enums"]["lost_case_status"]
          updated_at?: string
          wearing?: string[]
        }
        Update: {
          city?: string | null
          contact_chat?: boolean
          contact_phone?: string | null
          contact_phone_public?: boolean
          contact_whatsapp_public?: boolean
          created_at?: string
          found_at?: string | null
          found_how?: string | null
          id?: string
          indexable?: boolean
          last_seen_label?: string | null
          last_seen_lat?: number | null
          last_seen_lng?: number | null
          last_seen_point?: unknown
          lost_at?: string | null
          lost_at_uncertain?: boolean
          notes?: string | null
          owner_id?: string
          pet_id?: string
          public_area_label?: string | null
          public_lat?: number | null
          public_lng?: number | null
          public_point?: unknown
          public_point_exact?: boolean
          published_at?: string | null
          reunion_story?: string | null
          short_code?: string
          state?: string | null
          status?: Database["public"]["Enums"]["lost_case_status"]
          updated_at?: string
          wearing?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "lost_cases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_cases_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_photos: {
        Row: {
          created_at: string
          height: number | null
          id: string
          is_primary: boolean
          owner_id: string
          pet_id: string
          position: number
          storage_path: string
          thumb_path: string
          width: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          owner_id: string
          pet_id: string
          position?: number
          storage_path: string
          thumb_path: string
          width?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          owner_id?: string
          pet_id?: string
          position?: number
          storage_path?: string
          thumb_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_photos_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_photos_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_private_details: {
        Row: {
          created_at: string
          hidden_marks: string | null
          microchip_number: string | null
          owner_id: string
          ownership_notes: string | null
          pet_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hidden_marks?: string | null
          microchip_number?: string | null
          owner_id: string
          ownership_notes?: string | null
          pet_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hidden_marks?: string | null
          microchip_number?: string | null
          owner_id?: string
          ownership_notes?: string | null
          pet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_private_details_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_private_details_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          age_estimate_months: number | null
          birth_date: string | null
          breed: string | null
          city: string | null
          color_primary: string | null
          colors_secondary: string[]
          created_at: string
          description: string | null
          has_microchip: boolean | null
          id: string
          is_public: boolean
          mel_id: string
          name: string
          neutered: boolean | null
          owner_id: string
          sex: Database["public"]["Enums"]["pet_sex"]
          size: Database["public"]["Enums"]["pet_size"] | null
          species: Database["public"]["Enums"]["species"]
          state: string | null
          unique_marks: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          age_estimate_months?: number | null
          birth_date?: string | null
          breed?: string | null
          city?: string | null
          color_primary?: string | null
          colors_secondary?: string[]
          created_at?: string
          description?: string | null
          has_microchip?: boolean | null
          id?: string
          is_public?: boolean
          mel_id?: string
          name: string
          neutered?: boolean | null
          owner_id: string
          sex?: Database["public"]["Enums"]["pet_sex"]
          size?: Database["public"]["Enums"]["pet_size"] | null
          species: Database["public"]["Enums"]["species"]
          state?: string | null
          unique_marks?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          age_estimate_months?: number | null
          birth_date?: string | null
          breed?: string | null
          city?: string | null
          color_primary?: string | null
          colors_secondary?: string[]
          created_at?: string
          description?: string | null
          has_microchip?: boolean | null
          id?: string
          is_public?: boolean
          mel_id?: string
          name?: string
          neutered?: boolean | null
          owner_id?: string
          sex?: Database["public"]["Enums"]["pet_sex"]
          size?: Database["public"]["Enums"]["pet_size"] | null
          species?: Database["public"]["Enums"]["species"]
          state?: string | null
          unique_marks?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          display_name: string | null
          id: string
          is_anonymous: boolean
          onboarded_at: string | null
          phone_private: string | null
          role: Database["public"]["Enums"]["user_role"]
          state: string | null
          suspended_at: string | null
          updated_at: string
          whatsapp_private: string | null
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_anonymous?: boolean
          onboarded_at?: string | null
          phone_private?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          suspended_at?: string | null
          updated_at?: string
          whatsapp_private?: string | null
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_anonymous?: boolean
          onboarded_at?: string | null
          phone_private?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          suspended_at?: string | null
          updated_at?: string
          whatsapp_private?: string | null
        }
        Relationships: []
      }
      sightings: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["sighting_direction"]
          id: string
          lat: number
          lng: number
          lost_case_id: string
          notes: string | null
          photo_path: string | null
          place_label: string | null
          point: unknown
          reporter_id: string | null
          seen_at: string
          states: Database["public"]["Enums"]["sighting_state"][]
          status: Database["public"]["Enums"]["sighting_status"]
        }
        Insert: {
          created_at?: string
          direction?: Database["public"]["Enums"]["sighting_direction"]
          id?: string
          lat: number
          lng: number
          lost_case_id: string
          notes?: string | null
          photo_path?: string | null
          place_label?: string | null
          point?: unknown
          reporter_id?: string | null
          seen_at: string
          states?: Database["public"]["Enums"]["sighting_state"][]
          status?: Database["public"]["Enums"]["sighting_status"]
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["sighting_direction"]
          id?: string
          lat?: number
          lng?: number
          lost_case_id?: string
          notes?: string | null
          photo_path?: string | null
          place_label?: string | null
          point?: unknown
          reporter_id?: string | null
          seen_at?: string
          states?: Database["public"]["Enums"]["sighting_state"][]
          status?: Database["public"]["Enums"]["sighting_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sightings_lost_case_id_fkey"
            columns: ["lost_case_id"]
            isOneToOne: false
            referencedRelation: "lost_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sightings_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      debug_fuzz_point: { Args: { lat: number; lng: number }; Returns: Json }
      get_lost_case_timeline: { Args: { p_code: string }; Returns: Json }
      get_public_lost_case: { Args: { p_code: string }; Returns: Json }
      health_check: { Args: never; Returns: Json }
      nearby_lost_cases: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_m?: number
        }
        Returns: {
          area_label: string
          breed: string
          code: string
          distance_m: number
          lost_at: string
          pet_name: string
          photo_thumb_path: string
          public_lat: number
          public_lng: number
          size: Database["public"]["Enums"]["pet_size"]
          species: Database["public"]["Enums"]["species"]
        }[]
      }
      submit_sighting: {
        Args: {
          p_code: string
          p_direction?: Database["public"]["Enums"]["sighting_direction"]
          p_lat: number
          p_lng: number
          p_notes?: string
          p_photo_path?: string
          p_place_label?: string
          p_seen_at: string
          p_states?: Database["public"]["Enums"]["sighting_state"][]
        }
        Returns: string
      }
    }
    Enums: {
      lost_case_status: "DRAFT" | "ACTIVE" | "FOUND" | "CLOSED" | "REMOVED"
      pet_sex: "male" | "female" | "unknown"
      pet_size: "mini" | "small" | "medium" | "large" | "giant"
      sighting_direction: "N" | "S" | "E" | "W" | "unknown"
      sighting_state:
        | "walking"
        | "running"
        | "stopped"
        | "with_person"
        | "injured"
        | "scared"
        | "other"
      sighting_status: "VISIBLE" | "HIDDEN"
      species: "dog" | "cat" | "other"
      user_role: "user" | "moderator" | "admin"
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
      lost_case_status: ["DRAFT", "ACTIVE", "FOUND", "CLOSED", "REMOVED"],
      pet_sex: ["male", "female", "unknown"],
      pet_size: ["mini", "small", "medium", "large", "giant"],
      sighting_direction: ["N", "S", "E", "W", "unknown"],
      sighting_state: [
        "walking",
        "running",
        "stopped",
        "with_person",
        "injured",
        "scared",
        "other",
      ],
      sighting_status: ["VISIBLE", "HIDDEN"],
      species: ["dog", "cat", "other"],
      user_role: ["user", "moderator", "admin"],
    },
  },
} as const
