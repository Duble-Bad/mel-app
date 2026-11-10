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
      adoption_interests: {
        Row: {
          children: boolean | null
          created_at: string
          housing: string
          id: string
          listing_id: string
          message: string
          other_pets: boolean
          user_id: string
        }
        Insert: {
          children?: boolean | null
          created_at?: string
          housing: string
          id?: string
          listing_id: string
          message: string
          other_pets: boolean
          user_id: string
        }
        Update: {
          children?: boolean | null
          created_at?: string
          housing?: string
          id?: string
          listing_id?: string
          message?: string
          other_pets?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adoption_interests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "adoption_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adoption_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      adoption_listings: {
        Row: {
          age_months: number | null
          breed: string | null
          closed_at: string | null
          color_primary: string | null
          created_at: string
          description: string
          dewormed: boolean | null
          id: string
          lat: number
          lng: number
          name: string
          neutered: boolean | null
          owner_id: string
          photo_paths: string[]
          public_area_label: string | null
          public_lat: number | null
          public_lng: number | null
          published_at: string | null
          requirements: string | null
          review_note: string | null
          sex: Database["public"]["Enums"]["pet_sex"]
          short_code: string
          size: Database["public"]["Enums"]["pet_size"] | null
          species: Database["public"]["Enums"]["species"]
          status: Database["public"]["Enums"]["adoption_status"]
          temperament: string[]
          updated_at: string
          vaccinated: boolean | null
        }
        Insert: {
          age_months?: number | null
          breed?: string | null
          closed_at?: string | null
          color_primary?: string | null
          created_at?: string
          description: string
          dewormed?: boolean | null
          id?: string
          lat: number
          lng: number
          name: string
          neutered?: boolean | null
          owner_id: string
          photo_paths?: string[]
          public_area_label?: string | null
          public_lat?: number | null
          public_lng?: number | null
          published_at?: string | null
          requirements?: string | null
          review_note?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          short_code: string
          size?: Database["public"]["Enums"]["pet_size"] | null
          species: Database["public"]["Enums"]["species"]
          status?: Database["public"]["Enums"]["adoption_status"]
          temperament?: string[]
          updated_at?: string
          vaccinated?: boolean | null
        }
        Update: {
          age_months?: number | null
          breed?: string | null
          closed_at?: string | null
          color_primary?: string | null
          created_at?: string
          description?: string
          dewormed?: boolean | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          neutered?: boolean | null
          owner_id?: string
          photo_paths?: string[]
          public_area_label?: string | null
          public_lat?: number | null
          public_lng?: number | null
          published_at?: string | null
          requirements?: string | null
          review_note?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          short_code?: string
          size?: Database["public"]["Enums"]["pet_size"] | null
          species?: Database["public"]["Enums"]["species"]
          status?: Database["public"]["Enums"]["adoption_status"]
          temperament?: string[]
          updated_at?: string
          vaccinated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "adoption_listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      adoption_seekers: {
        Row: {
          ages: string[]
          area_label: string
          area_lat: number
          area_lng: number
          area_point: unknown
          children: boolean | null
          consented_at: string
          contact_ok: boolean
          contact_ref: string
          created_at: string
          edits_count: number
          edits_day: string | null
          expires_at: string
          expiry_reminded_at: string | null
          housing: string
          id: string
          notify: boolean
          other_pets: string
          radius_m: number
          review_note: string | null
          reviewed_at: string | null
          routine: string
          show_public: boolean
          sizes: Database["public"]["Enums"]["pet_size"][]
          species: string
          status: string
          updated_at: string
          user_id: string
          whatsapp_private: string | null
        }
        Insert: {
          ages?: string[]
          area_label: string
          area_lat: number
          area_lng: number
          area_point?: unknown
          children?: boolean | null
          consented_at: string
          contact_ok?: boolean
          contact_ref?: string
          created_at?: string
          edits_count?: number
          edits_day?: string | null
          expires_at: string
          expiry_reminded_at?: string | null
          housing: string
          id?: string
          notify?: boolean
          other_pets: string
          radius_m?: number
          review_note?: string | null
          reviewed_at?: string | null
          routine: string
          show_public?: boolean
          sizes?: Database["public"]["Enums"]["pet_size"][]
          species: string
          status?: string
          updated_at?: string
          user_id: string
          whatsapp_private?: string | null
        }
        Update: {
          ages?: string[]
          area_label?: string
          area_lat?: number
          area_lng?: number
          area_point?: unknown
          children?: boolean | null
          consented_at?: string
          contact_ok?: boolean
          contact_ref?: string
          created_at?: string
          edits_count?: number
          edits_day?: string | null
          expires_at?: string
          expiry_reminded_at?: string | null
          housing?: string
          id?: string
          notify?: boolean
          other_pets?: string
          radius_m?: number
          review_note?: string | null
          reviewed_at?: string | null
          routine?: string
          show_public?: boolean
          sizes?: Database["public"]["Enums"]["pet_size"][]
          species?: string
          status?: string
          updated_at?: string
          user_id?: string
          whatsapp_private?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adoption_seekers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_setting_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          key: string
          value: Json
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          key: string
          value: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          key?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_setting_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_cnpj_checks: {
        Row: {
          attempts: number
          business_id: string
          checked_at: string | null
          cnpj: string
          last_error: string | null
          next_attempt_at: string | null
          official_name: string | null
          registration_status: string | null
          source: string | null
          status: Database["public"]["Enums"]["cnpj_check_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          business_id: string
          checked_at?: string | null
          cnpj: string
          last_error?: string | null
          next_attempt_at?: string | null
          official_name?: string | null
          registration_status?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["cnpj_check_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          business_id?: string
          checked_at?: string | null
          cnpj?: string
          last_error?: string | null
          next_attempt_at?: string | null
          official_name?: string | null
          registration_status?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["cnpj_check_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_cnpj_checks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_offers: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_sponsored: boolean
          starts_at: string | null
          title: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_sponsored?: boolean
          starts_at?: string | null
          title: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_sponsored?: boolean
          starts_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_offers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          activity_area: string | null
          address_label: string
          address_public_consent: boolean
          address_public_verified_at: string | null
          address_public_verified_by: string | null
          approved_at: string | null
          category: Database["public"]["Enums"]["business_category"]
          city: string | null
          cnpj: string | null
          created_at: string
          description: string
          helps_lost: boolean
          hours: string | null
          id: string
          instagram: string | null
          lat: number
          legal_name: string | null
          lng: number
          logo_path: string | null
          name: string
          neighborhood: string | null
          owner_id: string
          partner_kind: Database["public"]["Enums"]["partner_kind"]
          phone: string | null
          plan_code: string
          point: unknown
          responsible_name: string | null
          review_note: string | null
          short_code: string
          status: Database["public"]["Enums"]["business_status"]
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          activity_area?: string | null
          address_label: string
          address_public_consent?: boolean
          address_public_verified_at?: string | null
          address_public_verified_by?: string | null
          approved_at?: string | null
          category: Database["public"]["Enums"]["business_category"]
          city?: string | null
          cnpj?: string | null
          created_at?: string
          description: string
          helps_lost?: boolean
          hours?: string | null
          id?: string
          instagram?: string | null
          lat: number
          legal_name?: string | null
          lng: number
          logo_path?: string | null
          name: string
          neighborhood?: string | null
          owner_id: string
          partner_kind?: Database["public"]["Enums"]["partner_kind"]
          phone?: string | null
          plan_code?: string
          point?: unknown
          responsible_name?: string | null
          review_note?: string | null
          short_code: string
          status?: Database["public"]["Enums"]["business_status"]
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          activity_area?: string | null
          address_label?: string
          address_public_consent?: boolean
          address_public_verified_at?: string | null
          address_public_verified_by?: string | null
          approved_at?: string | null
          category?: Database["public"]["Enums"]["business_category"]
          city?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string
          helps_lost?: boolean
          hours?: string | null
          id?: string
          instagram?: string | null
          lat?: number
          legal_name?: string | null
          lng?: number
          logo_path?: string | null
          name?: string
          neighborhood?: string | null
          owner_id?: string
          partner_kind?: Database["public"]["Enums"]["partner_kind"]
          phone?: string | null
          plan_code?: string
          point?: unknown
          responsible_name?: string | null
          review_note?: string | null
          short_code?: string
          status?: Database["public"]["Enums"]["business_status"]
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_address_public_verified_by_fkey"
            columns: ["address_public_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
        ]
      }
      case_matches: {
        Row: {
          algorithm_version: string
          created_at: string
          finder_dismissed: boolean
          found_case_id: string
          id: string
          lost_case_id: string
          owner_dismissed: boolean
          reasons: Json
          score: number
        }
        Insert: {
          algorithm_version?: string
          created_at?: string
          finder_dismissed?: boolean
          found_case_id: string
          id?: string
          lost_case_id: string
          owner_dismissed?: boolean
          reasons?: Json
          score: number
        }
        Update: {
          algorithm_version?: string
          created_at?: string
          finder_dismissed?: boolean
          found_case_id?: string
          id?: string
          lost_case_id?: string
          owner_dismissed?: boolean
          reasons?: Json
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_matches_found_case_id_fkey"
            columns: ["found_case_id"]
            isOneToOne: false
            referencedRelation: "found_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_matches_lost_case_id_fkey"
            columns: ["lost_case_id"]
            isOneToOne: false
            referencedRelation: "lost_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          created_at: string
          granted: boolean
          id: number
          kind: string
          user_id: string
          version: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: never
          kind: string
          user_id: string
          version: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: never
          kind?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          adoption_listing_id: string | null
          adoption_seeker_id: string | null
          created_at: string
          created_by: string
          found_case_id: string | null
          helper_id: string
          helper_last_read_at: string | null
          id: string
          last_message_at: string | null
          lost_case_id: string | null
          owner_id: string
          owner_last_read_at: string | null
          sighting_id: string | null
        }
        Insert: {
          adoption_listing_id?: string | null
          adoption_seeker_id?: string | null
          created_at?: string
          created_by: string
          found_case_id?: string | null
          helper_id: string
          helper_last_read_at?: string | null
          id?: string
          last_message_at?: string | null
          lost_case_id?: string | null
          owner_id: string
          owner_last_read_at?: string | null
          sighting_id?: string | null
        }
        Update: {
          adoption_listing_id?: string | null
          adoption_seeker_id?: string | null
          created_at?: string
          created_by?: string
          found_case_id?: string | null
          helper_id?: string
          helper_last_read_at?: string | null
          id?: string
          last_message_at?: string | null
          lost_case_id?: string | null
          owner_id?: string
          owner_last_read_at?: string | null
          sighting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_adoption_listing_id_fkey"
            columns: ["adoption_listing_id"]
            isOneToOne: false
            referencedRelation: "adoption_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_adoption_seeker_id_fkey"
            columns: ["adoption_seeker_id"]
            isOneToOne: false
            referencedRelation: "adoption_seekers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_found_case_id_fkey"
            columns: ["found_case_id"]
            isOneToOne: false
            referencedRelation: "found_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lost_case_id_fkey"
            columns: ["lost_case_id"]
            isOneToOne: false
            referencedRelation: "lost_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_sighting_id_fkey"
            columns: ["sighting_id"]
            isOneToOne: false
            referencedRelation: "sightings"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: number
          name: string
          props: Json
          subject_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          props?: Json
          subject_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          props?: Json
          subject_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      found_cases: {
        Row: {
          breed_guess: string | null
          closed_at: string | null
          color_primary: string | null
          colors_secondary: string[]
          created_at: string
          custody: Database["public"]["Enums"]["found_custody"]
          custody_notes: string | null
          description: string | null
          found_at: string
          id: string
          lat: number
          lng: number
          photo_path: string | null
          point: unknown
          public_area_label: string | null
          public_lat: number | null
          public_lng: number | null
          public_point: unknown
          reporter_id: string
          sex: Database["public"]["Enums"]["pet_sex"]
          short_code: string
          size: Database["public"]["Enums"]["pet_size"] | null
          species: Database["public"]["Enums"]["species"]
          status: Database["public"]["Enums"]["found_case_status"]
          verification_hint: string | null
        }
        Insert: {
          breed_guess?: string | null
          closed_at?: string | null
          color_primary?: string | null
          colors_secondary?: string[]
          created_at?: string
          custody: Database["public"]["Enums"]["found_custody"]
          custody_notes?: string | null
          description?: string | null
          found_at: string
          id?: string
          lat: number
          lng: number
          photo_path?: string | null
          point?: unknown
          public_area_label?: string | null
          public_lat?: number | null
          public_lng?: number | null
          public_point?: unknown
          reporter_id: string
          sex?: Database["public"]["Enums"]["pet_sex"]
          short_code?: string
          size?: Database["public"]["Enums"]["pet_size"] | null
          species: Database["public"]["Enums"]["species"]
          status?: Database["public"]["Enums"]["found_case_status"]
          verification_hint?: string | null
        }
        Update: {
          breed_guess?: string | null
          closed_at?: string | null
          color_primary?: string | null
          colors_secondary?: string[]
          created_at?: string
          custody?: Database["public"]["Enums"]["found_custody"]
          custody_notes?: string | null
          description?: string | null
          found_at?: string
          id?: string
          lat?: number
          lng?: number
          photo_path?: string | null
          point?: unknown
          public_area_label?: string | null
          public_lat?: number | null
          public_lng?: number | null
          public_point?: unknown
          reporter_id?: string
          sex?: Database["public"]["Enums"]["pet_sex"]
          short_code?: string
          size?: Database["public"]["Enums"]["pet_size"] | null
          species?: Database["public"]["Enums"]["species"]
          status?: Database["public"]["Enums"]["found_case_status"]
          verification_hint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "found_cases_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_settings: {
        Row: {
          alert_found: boolean
          alert_lost: boolean
          area_label: string | null
          area_lat: number
          area_lng: number
          area_point: unknown
          created_at: string
          enabled: boolean
          max_per_day: number
          quiet_night: boolean
          radius_m: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_found?: boolean
          alert_lost?: boolean
          area_label?: string | null
          area_lat: number
          area_lng: number
          area_point?: unknown
          created_at?: string
          enabled?: boolean
          max_per_day?: number
          quiet_night?: boolean
          radius_m?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_found?: boolean
          alert_lost?: boolean
          area_label?: string | null
          area_lat?: number
          area_lng?: number
          area_point?: unknown
          created_at?: string
          enabled?: boolean
          max_per_day?: number
          quiet_night?: boolean
          radius_m?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_cases: {
        Row: {
          city: string | null
          closed_at: string | null
          contact_chat: boolean
          contact_phone: string | null
          contact_phone_public: boolean
          contact_whatsapp_public: boolean
          created_at: string
          found_area_label: string | null
          found_at: string | null
          found_how: string | null
          helpful_sighting_id: string | null
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
          closed_at?: string | null
          contact_chat?: boolean
          contact_phone?: string | null
          contact_phone_public?: boolean
          contact_whatsapp_public?: boolean
          created_at?: string
          found_area_label?: string | null
          found_at?: string | null
          found_how?: string | null
          helpful_sighting_id?: string | null
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
          closed_at?: string | null
          contact_chat?: boolean
          contact_phone?: string | null
          contact_phone_public?: boolean
          contact_whatsapp_public?: boolean
          created_at?: string
          found_area_label?: string | null
          found_at?: string | null
          found_how?: string | null
          helpful_sighting_id?: string | null
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
            foreignKeyName: "lost_cases_helpful_sighting_id_fkey"
            columns: ["helpful_sighting_id"]
            isOneToOne: false
            referencedRelation: "sightings"
            referencedColumns: ["id"]
          },
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
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          hidden_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          created_at: string
          id: number
          moderator_id: string | null
          reason: string | null
          report_id: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          moderator_id?: string | null
          reason?: string | null
          report_id?: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          moderator_id?: string | null
          reason?: string | null
          report_id?: string | null
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
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
      partner_document_access_log: {
        Row: {
          action: string
          actor_id: string | null
          business_code: string | null
          business_id: string | null
          created_at: string
          full_value: boolean
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          business_code?: string | null
          business_id?: string | null
          created_at?: string
          full_value?: boolean
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          business_code?: string | null
          business_id?: string | null
          created_at?: string
          full_value?: boolean
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "partner_document_access_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_document_access_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_documents: {
        Row: {
          auth_tag: string
          business_id: string
          ciphertext: string
          created_at: string
          doc_type: string
          hmac_key_version: number
          iv: string
          key_version: number
          lookup_hmac: string
          owner_id: string
          read_state: string
          read_state_at: string | null
          updated_at: string
        }
        Insert: {
          auth_tag: string
          business_id: string
          ciphertext: string
          created_at?: string
          doc_type?: string
          hmac_key_version?: number
          iv: string
          key_version: number
          lookup_hmac: string
          owner_id: string
          read_state?: string
          read_state_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_tag?: string
          business_id?: string
          ciphertext?: string
          created_at?: string
          doc_type?: string
          hmac_key_version?: number
          iv?: string
          key_version?: number
          lookup_hmac?: string
          owner_id?: string
          read_state?: string
          read_state_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_data_changes: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          field: string
          id: number
          subject: string
          subject_ref: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          field: string
          id?: never
          subject: string
          subject_ref?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          field?: string
          id?: never
          subject?: string
          subject_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_data_changes_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_photos: {
        Row: {
          created_at: string
          focus_x: number | null
          focus_y: number | null
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
          focus_x?: number | null
          focus_y?: number | null
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
          focus_x?: number | null
          focus_y?: number | null
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
      pii_access_grants: {
        Row: {
          granted_at: string
          note: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          note?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pii_access_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          code: string
          features: Json
          name: string
          price_cents: number | null
          sort: number
        }
        Insert: {
          active?: boolean
          code: string
          features?: Json
          name: string
          price_cents?: number | null
          sort?: number
        }
        Update: {
          active?: boolean
          code?: string
          features?: Json
          name?: string
          price_cents?: number | null
          sort?: number
        }
        Relationships: []
      }
      poster_designs: {
        Row: {
          focus_x: number | null
          focus_y: number | null
          format: string
          lost_case_id: string
          model: number
          photo_ids: string[]
          updated_at: string
          zoom: number | null
        }
        Insert: {
          focus_x?: number | null
          focus_y?: number | null
          format: string
          lost_case_id: string
          model: number
          photo_ids?: string[]
          updated_at?: string
          zoom?: number | null
        }
        Update: {
          focus_x?: number | null
          focus_y?: number | null
          format?: string
          lost_case_id?: string
          model?: number
          photo_ids?: string[]
          updated_at?: string
          zoom?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "poster_designs_lost_case_id_fkey"
            columns: ["lost_case_id"]
            isOneToOne: false
            referencedRelation: "lost_cases"
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
      push_outbox: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          id: number
          notification_id: string
          processed_at: string | null
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          id?: never
          notification_id: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          id?: never
          notification_id?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_success_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_success_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_success_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          conversation_id: string | null
          created_at: string
          details: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          public_lat: number
          public_lng: number
          public_place_label: string | null
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
          public_lat: number
          public_lng: number
          public_place_label?: string | null
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
          public_lat?: number
          public_lng?: number
          public_place_label?: string | null
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
      admin_audit_log: { Args: { p_limit?: number }; Returns: Json }
      admin_list_adoption_seekers_for_review: { Args: never; Returns: Json }
      admin_list_adoptions_for_review: { Args: never; Returns: Json }
      admin_list_businesses_for_review: { Args: never; Returns: Json }
      admin_list_reports: {
        Args: { p_limit?: number; p_open?: boolean }
        Returns: Json
      }
      admin_moderate: {
        Args: { p_action: string; p_reason?: string; p_report_id: string }
        Returns: undefined
      }
      admin_overview: { Args: never; Returns: Json }
      admin_review_adoption: {
        Args: { p_approve: boolean; p_code: string; p_note?: string }
        Returns: undefined
      }
      admin_review_adoption_seeker: {
        Args: { p_approve: boolean; p_id: string; p_note?: string }
        Returns: undefined
      }
      admin_review_business: {
        Args: { p_approve: boolean; p_code: string; p_note?: string }
        Returns: undefined
      }
      admin_set_business_public_address: {
        Args: { p_code: string; p_public: boolean }
        Returns: undefined
      }
      admin_set_map_setting: {
        Args: { p_key: string; p_value: boolean }
        Returns: Json
      }
      claim_push_batch: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          kind: string
          notification_id: string
          outbox_id: number
          payload: Json
          quiet_night: boolean
          read_at: string
          subscriptions: Json
          user_id: string
        }[]
      }
      close_found_case: {
        Args: {
          p_code: string
          p_status: Database["public"]["Enums"]["found_case_status"]
        }
        Returns: undefined
      }
      confirm_reunion: {
        Args: {
          p_code: string
          p_found_area_label?: string
          p_helpful_sighting_id?: string
          p_how: string
          p_story?: string
        }
        Returns: undefined
      }
      debug_fuzz_point: { Args: { lat: number; lng: number }; Returns: Json }
      debug_match_score: { Args: { p: Json }; Returns: Json }
      dismiss_match: { Args: { p_id: string }; Returns: undefined }
      export_my_data: { Args: never; Returns: Json }
      finish_push: {
        Args: {
          p_dead_subscriptions?: string[]
          p_ok_subscriptions?: string[]
          p_outbox_id: number
          p_reason?: string
          p_status: string
        }
        Returns: undefined
      }
      get_business: { Args: { p_code: string }; Returns: Json }
      get_conversation: { Args: { p_id: string }; Returns: Json }
      get_lost_case_timeline: { Args: { p_code: string }; Returns: Json }
      get_map_settings: { Args: never; Returns: Json }
      get_my_adoption_seeker: { Args: never; Returns: Json }
      get_my_conversations: { Args: never; Returns: Json }
      get_my_matches: { Args: { p_found_code?: string }; Returns: Json }
      get_poster_designs: {
        Args: { p_code: string }
        Returns: {
          focus_x: number
          focus_y: number
          format: string
          model: number
          photo_ids: string[]
          updated_at: string
          zoom: number
        }[]
      }
      get_public_adoption: { Args: { p_code: string }; Returns: Json }
      get_public_found_case: { Args: { p_code: string }; Returns: Json }
      get_public_lost_case: { Args: { p_code: string }; Returns: Json }
      health_check: { Args: never; Returns: Json }
      list_adoptions: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_size?: Database["public"]["Enums"]["pet_size"][]
          p_species?: Database["public"]["Enums"]["species"][]
        }
        Returns: Json
      }
      list_businesses: {
        Args: {
          p_categories?: Database["public"]["Enums"]["business_category"][]
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_m?: number
        }
        Returns: Json
      }
      list_my_listings_for_seeker_contact: { Args: never; Returns: Json }
      list_orphan_sighting_media: {
        Args: { p_limit?: number; p_min_age?: string }
        Returns: string[]
      }
      list_public_adoption_seekers: {
        Args: { p_limit?: number; p_offset?: number; p_species?: string }
        Returns: Json
      }
      mark_conversation_read: { Args: { p_id: string }; Returns: undefined }
      mark_partner_document_state: {
        Args: { p_actor?: string; p_business_id: string; p_state: string }
        Returns: boolean
      }
      my_conversation_for_case: { Args: { p_code: string }; Returns: string }
      my_personal_data: { Args: never; Returns: Json }
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
      open_conversation_from_match: { Args: { p_id: string }; Returns: string }
      open_conversation_from_sighting: {
        Args: { p_sighting_id: string }
        Returns: string
      }
      reencrypt_partner_document: {
        Args: {
          p_auth_tag: string
          p_business_id: string
          p_ciphertext: string
          p_expected_ciphertext: string
          p_hmac_key_version: number
          p_iv: string
          p_key_version: number
          p_lookup_hmac: string
        }
        Returns: boolean
      }
      renew_my_adoption_seeker: { Args: never; Returns: string }
      report_content: {
        Args: {
          p_details?: string
          p_reason: Database["public"]["Enums"]["report_reason"]
          p_target: string
          p_target_type: Database["public"]["Enums"]["report_target"]
        }
        Returns: string
      }
      report_conversation: {
        Args: {
          p_block?: boolean
          p_details?: string
          p_id: string
          p_reason: Database["public"]["Enums"]["report_reason"]
        }
        Returns: string
      }
      reset_poster_design: {
        Args: { p_code: string; p_format: string }
        Returns: undefined
      }
      run_adoption_retention: { Args: { p_limit?: number }; Returns: Json }
      save_my_adoption_seeker: {
        Args: {
          p_ages: string[]
          p_area_label: string
          p_area_lat: number
          p_area_lng: number
          p_children: boolean
          p_consent: boolean
          p_housing: string
          p_notify: boolean
          p_other_pets: string
          p_radius_m: number
          p_routine: string
          p_show_public: boolean
          p_sizes: Database["public"]["Enums"]["pet_size"][]
          p_species: string
          p_whatsapp: string
        }
        Returns: Json
      }
      save_partner_document: {
        Args: {
          p_actor: string
          p_auth_tag: string
          p_business_id: string
          p_ciphertext: string
          p_iv: string
          p_key_version: number
          p_lookups: Json
          p_mode: string
        }
        Returns: string
      }
      save_poster_design: {
        Args: {
          p_code: string
          p_focus_x?: number
          p_focus_y?: number
          p_format: string
          p_model: number
          p_photo_ids: string[]
          p_zoom?: number
        }
        Returns: undefined
      }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      search_adoptions_on_map: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_m?: number
          p_species?: Database["public"]["Enums"]["species"][]
        }
        Returns: Json
      }
      search_public_cases: {
        Args: {
          p_kinds?: string[]
          p_lat: number
          p_limit?: number
          p_lng: number
          p_offset?: number
          p_radius_m?: number
          p_since?: string
          p_species?: Database["public"]["Enums"]["species"][]
        }
        Returns: Json
      }
      set_conversation_block: {
        Args: { p_blocked: boolean; p_id: string }
        Returns: undefined
      }
      set_my_adoption_seeker_contact: {
        Args: { p_enabled: boolean }
        Returns: undefined
      }
      set_my_adoption_seeker_notify: {
        Args: { p_enabled: boolean }
        Returns: undefined
      }
      set_my_adoption_seeker_whatsapp: {
        Args: { p_whatsapp: string }
        Returns: undefined
      }
      start_adoption_seeker_conversation: {
        Args: { p_body: string; p_listing_code: string; p_seeker_ref: string }
        Returns: string
      }
      start_conversation: {
        Args: { p_body: string; p_code: string }
        Returns: string
      }
      submit_adoption_interest: {
        Args: {
          p_children: boolean
          p_code: string
          p_housing: string
          p_message: string
          p_other_pets: boolean
        }
        Returns: string
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
      withdraw_adoption_interest: { Args: { p_code: string }; Returns: boolean }
      withdraw_my_adoption_seeker: { Args: never; Returns: boolean }
    }
    Enums: {
      adoption_status:
        | "PENDING_REVIEW"
        | "AVAILABLE"
        | "IN_PROCESS"
        | "ADOPTED"
        | "REJECTED"
        | "REMOVED"
      business_category:
        | "vet"
        | "petshop"
        | "grooming"
        | "hotel"
        | "trainer"
        | "ngo"
        | "other"
      business_status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED"
      cnpj_check_status:
        | "PENDING"
        | "VERIFIED"
        | "NOT_FOUND"
        | "INACTIVE"
        | "ERROR"
      found_case_status: "ACTIVE" | "REUNITED" | "CLOSED" | "REMOVED"
      found_custody: "with_me" | "safe_place" | "clinic" | "street" | "other"
      lost_case_status: "DRAFT" | "ACTIVE" | "FOUND" | "CLOSED" | "REMOVED"
      partner_kind: "company" | "ngo" | "independent"
      pet_sex: "male" | "female" | "unknown"
      pet_size: "mini" | "small" | "medium" | "large" | "giant"
      report_reason:
        | "scam"
        | "harassment"
        | "spam"
        | "fake"
        | "inappropriate"
        | "other"
      report_status: "OPEN" | "REVIEWING" | "ACTIONED" | "DISMISSED"
      report_target:
        | "user"
        | "lost_case"
        | "found_case"
        | "sighting"
        | "adoption"
        | "message"
        | "business"
        | "adoption_seeker"
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
      adoption_status: [
        "PENDING_REVIEW",
        "AVAILABLE",
        "IN_PROCESS",
        "ADOPTED",
        "REJECTED",
        "REMOVED",
      ],
      business_category: [
        "vet",
        "petshop",
        "grooming",
        "hotel",
        "trainer",
        "ngo",
        "other",
      ],
      business_status: ["PENDING_REVIEW", "APPROVED", "REJECTED", "SUSPENDED"],
      cnpj_check_status: [
        "PENDING",
        "VERIFIED",
        "NOT_FOUND",
        "INACTIVE",
        "ERROR",
      ],
      found_case_status: ["ACTIVE", "REUNITED", "CLOSED", "REMOVED"],
      found_custody: ["with_me", "safe_place", "clinic", "street", "other"],
      lost_case_status: ["DRAFT", "ACTIVE", "FOUND", "CLOSED", "REMOVED"],
      partner_kind: ["company", "ngo", "independent"],
      pet_sex: ["male", "female", "unknown"],
      pet_size: ["mini", "small", "medium", "large", "giant"],
      report_reason: [
        "scam",
        "harassment",
        "spam",
        "fake",
        "inappropriate",
        "other",
      ],
      report_status: ["OPEN", "REVIEWING", "ACTIONED", "DISMISSED"],
      report_target: [
        "user",
        "lost_case",
        "found_case",
        "sighting",
        "adoption",
        "message",
        "business",
        "adoption_seeker",
      ],
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
