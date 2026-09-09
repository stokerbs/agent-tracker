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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_location_history: {
        Row: {
          agent_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string
          speed_kmh: number | null
        }
        Insert: {
          agent_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          speed_kmh?: number | null
        }
        Update: {
          agent_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          speed_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_location_history_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_payments: {
        Row: {
          agent_id: string | null
          amount: number
          case_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          status: Database["public"]["Enums"]["payroll_status"]
          updated_at: string
          work_date: string
        }
        Insert: {
          agent_id?: string | null
          amount: number
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          updated_at?: string
          work_date: string
        }
        Update: {
          agent_id?: string | null
          amount?: number
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_payments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_payments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          agent_code: string
          agent_role: string | null
          area: string | null
          battery_pct: number | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          email: string | null
          full_name: string
          heading: number | null
          id: string
          is_charging: boolean | null
          last_active: string | null
          nickname: string | null
          phone: string | null
          photo_url: string | null
          position: string | null
          profile_id: string | null
          speed_kmh: number | null
          status: string
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          agent_code: string
          agent_role?: string | null
          area?: string | null
          battery_pct?: number | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          email?: string | null
          full_name: string
          heading?: number | null
          id?: string
          is_charging?: boolean | null
          last_active?: string | null
          nickname?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          profile_id?: string | null
          speed_kmh?: number | null
          status?: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          agent_code?: string
          agent_role?: string | null
          area?: string | null
          battery_pct?: number | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          email?: string | null
          full_name?: string
          heading?: number | null
          id?: string
          is_charging?: boolean | null
          last_active?: string | null
          nickname?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          profile_id?: string | null
          speed_kmh?: number | null
          status?: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_versions: {
        Row: {
          id: string
          prompt_id: string
          prompt_text: string
          saved_at: string
          saved_by: string | null
        }
        Insert: {
          id?: string
          prompt_id: string
          prompt_text: string
          saved_at?: string
          saved_by?: string | null
        }
        Update: {
          id?: string
          prompt_id?: string
          prompt_text?: string
          saved_at?: string
          saved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompt_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompts: {
        Row: {
          created_at: string
          default_text: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          prompt_key: string
          prompt_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_text: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          prompt_key: string
          prompt_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_text?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          prompt_key?: string
          prompt_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      air_tag_positions: {
        Row: {
          accuracy_m: number | null
          air_tag_id: string
          created_at: string
          entered_by: string
          id: string
          lat: number
          lng: number
          note: string | null
          recorded_at: string
          source: string
        }
        Insert: {
          accuracy_m?: number | null
          air_tag_id: string
          created_at?: string
          entered_by: string
          id?: string
          lat: number
          lng: number
          note?: string | null
          recorded_at: string
          source?: string
        }
        Update: {
          accuracy_m?: number | null
          air_tag_id?: string
          created_at?: string
          entered_by?: string
          id?: string
          lat?: number
          lng?: number
          note?: string | null
          recorded_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "air_tag_positions_air_tag_id_fkey"
            columns: ["air_tag_id"]
            isOneToOne: false
            referencedRelation: "air_tag_trackers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "air_tag_positions_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      air_tag_trackers: {
        Row: {
          apple_serial: string | null
          case_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          label: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          apple_serial?: string | null
          case_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          label: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          apple_serial?: string | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          label?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "air_tag_trackers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "air_tag_trackers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      air_tag_webhook_tokens: {
        Row: {
          air_tag_id: string
          created_at: string
          created_by: string
          id: string
          label: string | null
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
        }
        Insert: {
          air_tag_id: string
          created_at?: string
          created_by: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
        }
        Update: {
          air_tag_id?: string
          created_at?: string
          created_by?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "air_tag_webhook_tokens_air_tag_id_fkey"
            columns: ["air_tag_id"]
            isOneToOne: false
            referencedRelation: "air_tag_trackers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "air_tag_webhook_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          ip_address: unknown
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: number
          ip_address?: unknown
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: number
          ip_address?: unknown
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_agents: {
        Row: {
          agent_id: string
          assigned_at: string
          assigned_by: string | null
          case_id: string
        }
        Insert: {
          agent_id: string
          assigned_at?: string
          assigned_by?: string | null
          case_id: string
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          assigned_by?: string | null
          case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_agents_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_agents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_claims: {
        Row: {
          agent_id: string
          case_id: string
          decided_at: string | null
          decided_by: string | null
          id: string
          note: string | null
          reminded_at: string | null
          requested_at: string
          status: Database["public"]["Enums"]["claim_status"]
        }
        Insert: {
          agent_id: string
          case_id: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          reminded_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["claim_status"]
        }
        Update: {
          agent_id?: string
          case_id?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          reminded_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["claim_status"]
        }
        Relationships: [
          {
            foreignKeyName: "case_claims_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_claims_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_claims_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_message_views: {
        Row: {
          case_id: string
          last_seen_at: string
          profile_id: string
        }
        Insert: {
          case_id: string
          last_seen_at?: string
          profile_id: string
        }
        Update: {
          case_id?: string
          last_seen_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_message_views_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_message_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_messages: {
        Row: {
          body: string
          case_id: string
          created_at: string
          id: string
          is_internal: boolean
          sender_id: string
        }
        Insert: {
          body: string
          case_id: string
          created_at?: string
          id?: string
          is_internal?: boolean
          sender_id: string
        }
        Update: {
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          archived_at: string | null
          board_duration: string | null
          board_location: string | null
          board_pay: number | null
          board_posted_at: string | null
          board_posted_by: string | null
          board_slots: number | null
          board_start_at: string | null
          case_number: string
          case_type: string | null
          checkin_interval_minutes: number | null
          checkin_stage: string
          client_id: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          license_plate_bidx: string | null
          license_plate_enc: string | null
          on_board: boolean
          priority: Database["public"]["Enums"]["case_priority"]
          start_date: string | null
          status: Database["public"]["Enums"]["case_status"]
          target_address_enc: string | null
          target_age: number | null
          target_alias_enc: string | null
          target_dob_enc: string | null
          target_email_enc: string | null
          target_gender: string | null
          target_name_bidx: string | null
          target_name_enc: string | null
          target_nationality: string | null
          target_notes_enc: string | null
          target_occupation: string | null
          target_phone_bidx: string | null
          target_phone_enc: string | null
          target_socials_enc: string | null
          target_vehicle_enc: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          board_duration?: string | null
          board_location?: string | null
          board_pay?: number | null
          board_posted_at?: string | null
          board_posted_by?: string | null
          board_slots?: number | null
          board_start_at?: string | null
          case_number: string
          case_type?: string | null
          checkin_interval_minutes?: number | null
          checkin_stage?: string
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          license_plate_bidx?: string | null
          license_plate_enc?: string | null
          on_board?: boolean
          priority?: Database["public"]["Enums"]["case_priority"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          target_address_enc?: string | null
          target_age?: number | null
          target_alias_enc?: string | null
          target_dob_enc?: string | null
          target_email_enc?: string | null
          target_gender?: string | null
          target_name_bidx?: string | null
          target_name_enc?: string | null
          target_nationality?: string | null
          target_notes_enc?: string | null
          target_occupation?: string | null
          target_phone_bidx?: string | null
          target_phone_enc?: string | null
          target_socials_enc?: string | null
          target_vehicle_enc?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          board_duration?: string | null
          board_location?: string | null
          board_pay?: number | null
          board_posted_at?: string | null
          board_posted_by?: string | null
          board_slots?: number | null
          board_start_at?: string | null
          case_number?: string
          case_type?: string | null
          checkin_interval_minutes?: number | null
          checkin_stage?: string
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          license_plate_bidx?: string | null
          license_plate_enc?: string | null
          on_board?: boolean
          priority?: Database["public"]["Enums"]["case_priority"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          target_address_enc?: string | null
          target_age?: number | null
          target_alias_enc?: string | null
          target_dob_enc?: string | null
          target_email_enc?: string | null
          target_gender?: string | null
          target_name_bidx?: string | null
          target_name_enc?: string | null
          target_nationality?: string | null
          target_notes_enc?: string | null
          target_occupation?: string | null
          target_phone_bidx?: string | null
          target_phone_enc?: string | null
          target_socials_enc?: string | null
          target_vehicle_enc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_board_posted_by_fkey"
            columns: ["board_posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_accounts: {
        Row: {
          analysis_id: string
          confidence: number | null
          created_at: string
          exists_flag: boolean | null
          id: number
          platform: string
          url: string | null
        }
        Insert: {
          analysis_id: string
          confidence?: number | null
          created_at?: string
          exists_flag?: boolean | null
          id?: number
          platform: string
          url?: string | null
        }
        Update: {
          analysis_id?: string
          confidence?: number | null
          created_at?: string
          exists_flag?: boolean | null
          id?: number
          platform?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_accounts_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "contact_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_analysis: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          input_bidx: string
          input_enc: string
          input_type: Database["public"]["Enums"]["contact_input_type"]
          stage_status: Json
          status: Database["public"]["Enums"]["osint_status"]
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          input_bidx: string
          input_enc: string
          input_type: Database["public"]["Enums"]["contact_input_type"]
          stage_status?: Json
          status?: Database["public"]["Enums"]["osint_status"]
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          input_bidx?: string
          input_enc?: string
          input_type?: Database["public"]["Enums"]["contact_input_type"]
          stage_status?: Json
          status?: Database["public"]["Enums"]["osint_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_analysis_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_analysis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_breaches: {
        Row: {
          analysis_id: string
          breach_date: string | null
          created_at: string
          data_classes: Json | null
          id: number
          name: string | null
          source: string
        }
        Insert: {
          analysis_id: string
          breach_date?: string | null
          created_at?: string
          data_classes?: Json | null
          id?: number
          name?: string | null
          source: string
        }
        Update: {
          analysis_id?: string
          breach_date?: string | null
          created_at?: string
          data_classes?: Json | null
          id?: number
          name?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_breaches_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "contact_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_phone: {
        Row: {
          analysis_id: string
          country: string | null
          created_at: string
          e164_enc: string | null
          line_type: string | null
          national_fmt_enc: string | null
          possible: boolean | null
          raw: Json | null
          valid: boolean | null
        }
        Insert: {
          analysis_id: string
          country?: string | null
          created_at?: string
          e164_enc?: string | null
          line_type?: string | null
          national_fmt_enc?: string | null
          possible?: boolean | null
          raw?: Json | null
          valid?: boolean | null
        }
        Update: {
          analysis_id?: string
          country?: string | null
          created_at?: string
          e164_enc?: string | null
          line_type?: string | null
          national_fmt_enc?: string | null
          possible?: boolean | null
          raw?: Json | null
          valid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_phone_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "contact_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_reports: {
        Row: {
          analysis_id: string
          confidence: number | null
          created_at: string
          leads: Json | null
          model: string
          recommendations: Json | null
          risk_score: number | null
          summary: string | null
        }
        Insert: {
          analysis_id: string
          confidence?: number | null
          created_at?: string
          leads?: Json | null
          model: string
          recommendations?: Json | null
          risk_score?: number | null
          summary?: string | null
        }
        Update: {
          analysis_id?: string
          confidence?: number | null
          created_at?: string
          leads?: Json | null
          model?: string
          recommendations?: Json | null
          risk_score?: number | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_reports_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "contact_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          profile_id: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform: string
          profile_id: string
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          profile_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          agent_id: string | null
          case_id: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          status: Database["public"]["Enums"]["alert_status"]
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agent_id?: string | null
          case_id?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agent_id?: string | null
          case_id?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_alerts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_alerts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          case_id: string
          category: string | null
          file_name: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          storage_path: string
          timeline_entry_id: string | null
          type: Database["public"]["Enums"]["evidence_type"]
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          case_id: string
          category?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path: string
          timeline_entry_id?: string | null
          type?: Database["public"]["Enums"]["evidence_type"]
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string
          category?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path?: string
          timeline_entry_id?: string | null
          type?: Database["public"]["Enums"]["evidence_type"]
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_timeline_entry_id_fkey"
            columns: ["timeline_entry_id"]
            isOneToOne: false
            referencedRelation: "timeline_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          agent_id: string | null
          amount: number
          case_id: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          expense_date: string
          expense_time: string | null
          id: string
          notes: string | null
          ocr_confidence: number | null
          ocr_raw: Json | null
          paid_at: string | null
          paid_by: string | null
          receipt_number: string | null
          receipt_url: string | null
          source: string
          status: Database["public"]["Enums"]["expense_status"]
          vat_amount: number | null
          vendor_name: string | null
        }
        Insert: {
          agent_id?: string | null
          amount: number
          case_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          expense_date?: string
          expense_time?: string | null
          id?: string
          notes?: string | null
          ocr_confidence?: number | null
          ocr_raw?: Json | null
          paid_at?: string | null
          paid_by?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          source?: string
          status?: Database["public"]["Enums"]["expense_status"]
          vat_amount?: number | null
          vendor_name?: string | null
        }
        Update: {
          agent_id?: string | null
          amount?: number
          case_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          expense_date?: string
          expense_time?: string | null
          id?: string
          notes?: string | null
          ocr_confidence?: number | null
          ocr_raw?: Json | null
          paid_at?: string | null
          paid_by?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          source?: string
          status?: Database["public"]["Enums"]["expense_status"]
          vat_amount?: number | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_events: {
        Row: {
          agent_id: string | null
          event_type: string
          geofence_id: string
          gps_device_id: string | null
          id: string
          lat: number
          lng: number
          occurred_at: string
        }
        Insert: {
          agent_id?: string | null
          event_type: string
          geofence_id: string
          gps_device_id?: string | null
          id?: string
          lat: number
          lng: number
          occurred_at?: string
        }
        Update: {
          agent_id?: string | null
          event_type?: string
          geofence_id?: string
          gps_device_id?: string | null
          id?: string
          lat?: number
          lng?: number
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_geofence_id_fkey"
            columns: ["geofence_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_gps_device_id_fkey"
            columns: ["gps_device_id"]
            isOneToOne: false
            referencedRelation: "gps_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      geofences: {
        Row: {
          active: boolean
          color: string
          coordinates: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          coordinates?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          coordinates?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_device_access: {
        Row: {
          created_at: string
          gps_device_id: string
          granted_by: string | null
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          gps_device_id: string
          granted_by?: string | null
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          gps_device_id?: string
          granted_by?: string | null
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_device_access_gps_device_id_fkey"
            columns: ["gps_device_id"]
            isOneToOne: false
            referencedRelation: "gps_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_device_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_device_access_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_device_positions: {
        Row: {
          battery_pct: number | null
          gps_device_id: string
          heading: number
          id: string
          lat: number
          lng: number
          locate_mode: string | null
          recorded_at: string
          speed_kmh: number
        }
        Insert: {
          battery_pct?: number | null
          gps_device_id: string
          heading?: number
          id?: string
          lat: number
          lng: number
          locate_mode?: string | null
          recorded_at?: string
          speed_kmh?: number
        }
        Update: {
          battery_pct?: number | null
          gps_device_id?: string
          heading?: number
          id?: string
          lat?: number
          lng?: number
          locate_mode?: string | null
          recorded_at?: string
          speed_kmh?: number
        }
        Relationships: [
          {
            foreignKeyName: "gps_device_positions_gps_device_id_fkey"
            columns: ["gps_device_id"]
            isOneToOne: false
            referencedRelation: "gps_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_devices: {
        Row: {
          agent_id: string | null
          anomaly_notified_at: string | null
          anomaly_signature: string | null
          anomaly_watch_enabled: boolean
          case_id: string
          created_at: string
          created_by: string | null
          credential_id: string | null
          deleted_at: string | null
          geofence_alerted_at: string | null
          geofence_id: string | null
          gps903_device_id: number | null
          id: string
          imei: string | null
          last_battery_pct: number | null
          last_heading: number | null
          last_ignition: boolean | null
          last_lat: number | null
          last_lng: number | null
          last_locate_mode: string | null
          last_poll_ok: boolean | null
          last_polled_at: string | null
          last_position_time: string | null
          last_seen_at: string | null
          last_speed_kmh: number | null
          last_stop_minutes: number | null
          notes: string | null
          phone_number: string | null
          provider: Database["public"]["Enums"]["gps_provider"] | null
          stopped_since: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          anomaly_notified_at?: string | null
          anomaly_signature?: string | null
          anomaly_watch_enabled?: boolean
          case_id: string
          created_at?: string
          created_by?: string | null
          credential_id?: string | null
          deleted_at?: string | null
          geofence_alerted_at?: string | null
          geofence_id?: string | null
          gps903_device_id?: number | null
          id?: string
          imei?: string | null
          last_battery_pct?: number | null
          last_heading?: number | null
          last_ignition?: boolean | null
          last_lat?: number | null
          last_lng?: number | null
          last_locate_mode?: string | null
          last_poll_ok?: boolean | null
          last_polled_at?: string | null
          last_position_time?: string | null
          last_seen_at?: string | null
          last_speed_kmh?: number | null
          last_stop_minutes?: number | null
          notes?: string | null
          phone_number?: string | null
          provider?: Database["public"]["Enums"]["gps_provider"] | null
          stopped_since?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          anomaly_notified_at?: string | null
          anomaly_signature?: string | null
          anomaly_watch_enabled?: boolean
          case_id?: string
          created_at?: string
          created_by?: string | null
          credential_id?: string | null
          deleted_at?: string | null
          geofence_alerted_at?: string | null
          geofence_id?: string | null
          gps903_device_id?: number | null
          id?: string
          imei?: string | null
          last_battery_pct?: number | null
          last_heading?: number | null
          last_ignition?: boolean | null
          last_lat?: number | null
          last_lng?: number | null
          last_locate_mode?: string | null
          last_poll_ok?: boolean | null
          last_polled_at?: string | null
          last_position_time?: string | null
          last_seen_at?: string | null
          last_speed_kmh?: number | null
          last_stop_minutes?: number | null
          notes?: string | null
          phone_number?: string | null
          provider?: Database["public"]["Enums"]["gps_provider"] | null
          stopped_since?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_devices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_devices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_devices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_devices_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "gps903_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_devices_geofence_id_fkey"
            columns: ["geofence_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          profile_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          profile_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          profile_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gps903_credential_sessions: {
        Row: {
          credential_id: string
          expires_at: string
          session_cookie: string
          updated_at: string
        }
        Insert: {
          credential_id: string
          expires_at: string
          session_cookie: string
          updated_at?: string
        }
        Update: {
          credential_id?: string
          expires_at?: string
          session_cookie?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps903_credential_sessions_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: true
            referencedRelation: "gps903_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      gps903_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          device_name: string
          device_password: string
          gps903_device_id: number | null
          id: string
          imei: string
          is_active: boolean
          last_sync_ok: boolean | null
          last_synced_at: string | null
          phone_number: string | null
          provider: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_name: string
          device_password: string
          gps903_device_id?: number | null
          id?: string
          imei: string
          is_active?: boolean
          last_sync_ok?: boolean | null
          last_synced_at?: string | null
          phone_number?: string | null
          provider?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_name?: string
          device_password?: string
          gps903_device_id?: number | null
          id?: string
          imei?: string
          is_active?: boolean
          last_sync_ok?: boolean | null
          last_synced_at?: string | null
          phone_number?: string | null
          provider?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps903_credentials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gps903_devices: {
        Row: {
          created_at: string
          device_name: string | null
          gps903_device_id: number
          id: string
          imei: string | null
          last_seen: string | null
          model: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          gps903_device_id: number
          id?: string
          imei?: string | null
          last_seen?: string | null
          model?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          gps903_device_id?: number
          id?: string
          imei?: string | null
          last_seen?: string | null
          model?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps903_devices_imei_fkey"
            columns: ["imei"]
            isOneToOne: false
            referencedRelation: "gps903_credentials"
            referencedColumns: ["imei"]
          },
        ]
      }
      image_analysis: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string | null
          dpi: number | null
          error: string | null
          filesize: number | null
          format: string | null
          height: number | null
          id: string
          integrity: Json | null
          mime: string | null
          source_ref: string | null
          source_type: Database["public"]["Enums"]["osint_source_type"]
          stage_status: Json
          status: Database["public"]["Enums"]["osint_status"]
          storage_path: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          dpi?: number | null
          error?: string | null
          filesize?: number | null
          format?: string | null
          height?: number | null
          id?: string
          integrity?: Json | null
          mime?: string | null
          source_ref?: string | null
          source_type: Database["public"]["Enums"]["osint_source_type"]
          stage_status?: Json
          status?: Database["public"]["Enums"]["osint_status"]
          storage_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          dpi?: number | null
          error?: string | null
          filesize?: number | null
          format?: string | null
          height?: number | null
          id?: string
          integrity?: Json | null
          mime?: string | null
          source_ref?: string | null
          source_type?: Database["public"]["Enums"]["osint_source_type"]
          stage_status?: Json
          status?: Database["public"]["Enums"]["osint_status"]
          storage_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "image_analysis_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_analysis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      image_faces: {
        Row: {
          analysis_id: string
          bbox: Json | null
          blur_score: number | null
          confidence: number | null
          created_at: string
          face_index: number
          has_glasses: boolean | null
          has_mask: boolean | null
          id: number
          pitch: number | null
          roll: number | null
          yaw: number | null
        }
        Insert: {
          analysis_id: string
          bbox?: Json | null
          blur_score?: number | null
          confidence?: number | null
          created_at?: string
          face_index: number
          has_glasses?: boolean | null
          has_mask?: boolean | null
          id?: number
          pitch?: number | null
          roll?: number | null
          yaw?: number | null
        }
        Update: {
          analysis_id?: string
          bbox?: Json | null
          blur_score?: number | null
          confidence?: number | null
          created_at?: string
          face_index?: number
          has_glasses?: boolean | null
          has_mask?: boolean | null
          id?: number
          pitch?: number | null
          roll?: number | null
          yaw?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "image_faces_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "image_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      image_geolocation: {
        Row: {
          ai_lat: number | null
          ai_lon: number | null
          analysis_id: string
          city: string | null
          confidence: number | null
          country: string | null
          created_at: string
          predictions: Json | null
          provider: string
          province: string | null
        }
        Insert: {
          ai_lat?: number | null
          ai_lon?: number | null
          analysis_id: string
          city?: string | null
          confidence?: number | null
          country?: string | null
          created_at?: string
          predictions?: Json | null
          provider?: string
          province?: string | null
        }
        Update: {
          ai_lat?: number | null
          ai_lon?: number | null
          analysis_id?: string
          city?: string | null
          confidence?: number | null
          country?: string | null
          created_at?: string
          predictions?: Json | null
          provider?: string
          province?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "image_geolocation_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "image_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      image_hashes: {
        Row: {
          ahash: string | null
          analysis_id: string
          created_at: string
          dhash: string | null
          md5: string | null
          phash: string | null
          sha1: string | null
          sha256: string | null
        }
        Insert: {
          ahash?: string | null
          analysis_id: string
          created_at?: string
          dhash?: string | null
          md5?: string | null
          phash?: string | null
          sha1?: string | null
          sha256?: string | null
        }
        Update: {
          ahash?: string | null
          analysis_id?: string
          created_at?: string
          dhash?: string | null
          md5?: string | null
          phash?: string | null
          sha1?: string | null
          sha256?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "image_hashes_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "image_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      image_metadata: {
        Row: {
          analysis_id: string
          camera_make: string | null
          camera_model: string | null
          created_at: string
          gps_altitude: number | null
          gps_lat: number | null
          gps_lng: number | null
          lens: string | null
          orientation: number | null
          raw_exif: Json | null
          software: string | null
          taken_at: string | null
        }
        Insert: {
          analysis_id: string
          camera_make?: string | null
          camera_model?: string | null
          created_at?: string
          gps_altitude?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          lens?: string | null
          orientation?: number | null
          raw_exif?: Json | null
          software?: string | null
          taken_at?: string | null
        }
        Update: {
          analysis_id?: string
          camera_make?: string | null
          camera_model?: string | null
          created_at?: string
          gps_altitude?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          lens?: string | null
          orientation?: number | null
          raw_exif?: Json | null
          software?: string | null
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "image_metadata_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "image_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      image_objects: {
        Row: {
          analysis_id: string
          bbox: Json | null
          category: string | null
          confidence: number | null
          created_at: string
          id: number
          label: string
        }
        Insert: {
          analysis_id: string
          bbox?: Json | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: number
          label: string
        }
        Update: {
          analysis_id?: string
          bbox?: Json | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: number
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_objects_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "image_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      image_ocr: {
        Row: {
          analysis_id: string
          bbox: Json | null
          category: string | null
          confidence: number | null
          created_at: string
          id: number
          text: string
        }
        Insert: {
          analysis_id: string
          bbox?: Json | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: number
          text: string
        }
        Update: {
          analysis_id?: string
          bbox?: Json | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_ocr_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "image_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      image_redirects: {
        Row: {
          analysis_id: string
          created_at: string
          hop_index: number
          id: number
          kind: Database["public"]["Enums"]["osint_redirect_kind"]
          resolved_host: string | null
          resolved_ip: string | null
          status_code: number | null
          url: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          hop_index: number
          id?: number
          kind: Database["public"]["Enums"]["osint_redirect_kind"]
          resolved_host?: string | null
          resolved_ip?: string | null
          status_code?: number | null
          url: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          hop_index?: number
          id?: number
          kind?: Database["public"]["Enums"]["osint_redirect_kind"]
          resolved_host?: string | null
          resolved_ip?: string | null
          status_code?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_redirects_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "image_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      image_reports: {
        Row: {
          analysis_id: string
          confidence: number | null
          created_at: string
          leads: Json | null
          likely_origin: string | null
          model: string
          recommendations: Json | null
          risk_score: number | null
          summary: string | null
        }
        Insert: {
          analysis_id: string
          confidence?: number | null
          created_at?: string
          leads?: Json | null
          likely_origin?: string | null
          model: string
          recommendations?: Json | null
          risk_score?: number | null
          summary?: string | null
        }
        Update: {
          analysis_id?: string
          confidence?: number | null
          created_at?: string
          leads?: Json | null
          likely_origin?: string | null
          model?: string
          recommendations?: Json | null
          risk_score?: number | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "image_reports_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "image_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          case_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issued_date: string
          line_items: Json
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_ref: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          case_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issued_date?: string
          line_items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          case_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issued_date?: string
          line_items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      line_accounts: {
        Row: {
          agent_id: string | null
          created_at: string
          id: string
          line_user_id: string
          linked_at: string | null
          otp_attempts: number
          otp_code_hash: string | null
          otp_expires_at: string | null
          otp_requested_at: string | null
          pending_attachment_case_id: string | null
          pending_attachment_entry_id: string | null
          pending_attachment_expires_at: string | null
          phone_at_link_time: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          id?: string
          line_user_id: string
          linked_at?: string | null
          otp_attempts?: number
          otp_code_hash?: string | null
          otp_expires_at?: string | null
          otp_requested_at?: string | null
          pending_attachment_case_id?: string | null
          pending_attachment_entry_id?: string | null
          pending_attachment_expires_at?: string | null
          phone_at_link_time?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          id?: string
          line_user_id?: string
          linked_at?: string | null
          otp_attempts?: number
          otp_code_hash?: string | null
          otp_expires_at?: string | null
          otp_requested_at?: string | null
          pending_attachment_case_id?: string | null
          pending_attachment_entry_id?: string | null
          pending_attachment_expires_at?: string | null
          phone_at_link_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_accounts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_accounts_pending_attachment_case_id_fkey"
            columns: ["pending_attachment_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_accounts_pending_attachment_entry_id_fkey"
            columns: ["pending_attachment_entry_id"]
            isOneToOne: false
            referencedRelation: "timeline_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_articles: {
        Row: {
          approve_token: string
          cover_category: string | null
          created_at: string
          en_body: string
          en_description: string
          en_slug: string
          en_title: string
          id: string
          model: string | null
          published_at: string | null
          status: string
          th_body: string
          th_description: string
          th_slug: string
          th_title: string
          topic: string
          zh_body: string | null
          zh_description: string | null
          zh_slug: string | null
          zh_title: string | null
        }
        Insert: {
          approve_token: string
          cover_category?: string | null
          created_at?: string
          en_body: string
          en_description: string
          en_slug: string
          en_title: string
          id?: string
          model?: string | null
          published_at?: string | null
          status?: string
          th_body: string
          th_description: string
          th_slug: string
          th_title: string
          topic: string
          zh_body?: string | null
          zh_description?: string | null
          zh_slug?: string | null
          zh_title?: string | null
        }
        Update: {
          approve_token?: string
          cover_category?: string | null
          created_at?: string
          en_body?: string
          en_description?: string
          en_slug?: string
          en_title?: string
          id?: string
          model?: string | null
          published_at?: string | null
          status?: string
          th_body?: string
          th_description?: string
          th_slug?: string
          th_title?: string
          topic?: string
          zh_body?: string | null
          zh_description?: string | null
          zh_slug?: string | null
          zh_title?: string | null
        }
        Relationships: []
      }
      marketing_leads: {
        Row: {
          case_type: string | null
          consent_at: string | null
          created_at: string
          email: string | null
          id: string
          locale: string
          message: string | null
          name: string
          phone: string
          source: string
          status: string
          user_agent: string | null
        }
        Insert: {
          case_type?: string | null
          consent_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          locale?: string
          message?: string | null
          name: string
          phone: string
          source?: string
          status?: string
          user_agent?: string | null
        }
        Update: {
          case_type?: string | null
          consent_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          locale?: string
          message?: string | null
          name?: string
          phone?: string
          source?: string
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      recruitment_applications: {
        Row: {
          consent_at: string | null
          created_at: string
          email: string | null
          experience: string | null
          id: string
          locale: string
          message: string | null
          name: string
          phone: string
          position: string | null
          source: string
          status: string
          user_agent: string | null
        }
        Insert: {
          consent_at?: string | null
          created_at?: string
          email?: string | null
          experience?: string | null
          id?: string
          locale?: string
          message?: string | null
          name: string
          phone: string
          position?: string | null
          source?: string
          status?: string
          user_agent?: string | null
        }
        Update: {
          consent_at?: string | null
          created_at?: string
          email?: string | null
          experience?: string | null
          id?: string
          locale?: string
          message?: string | null
          name?: string
          phone?: string
          position?: string | null
          source?: string
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      studio_ai_generations: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          input_refs: Json
          input_tokens: number | null
          model: string
          output: Json | null
          output_tokens: number | null
          provider: string
          purpose: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          input_refs?: Json
          input_tokens?: number | null
          model: string
          output?: Json | null
          output_tokens?: number | null
          provider: string
          purpose: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          input_refs?: Json
          input_tokens?: number | null
          model?: string
          output?: Json | null
          output_tokens?: number | null
          provider?: string
          purpose?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_ai_generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_analytics: {
        Row: {
          avg_watch_sec: number | null
          comments: number | null
          completion_rate: number | null
          conversions: number | null
          created_at: string
          created_by: string | null
          dms: number | null
          id: string
          leads: number | null
          likes: number | null
          master_id: string
          note: string | null
          platform: string
          profile_visits: number | null
          qualified_leads: number | null
          reach: number | null
          recorded_at: string
          saves: number | null
          shares: number | null
          source: string
          variant_id: string | null
          views: number | null
        }
        Insert: {
          avg_watch_sec?: number | null
          comments?: number | null
          completion_rate?: number | null
          conversions?: number | null
          created_at?: string
          created_by?: string | null
          dms?: number | null
          id?: string
          leads?: number | null
          likes?: number | null
          master_id: string
          note?: string | null
          platform: string
          profile_visits?: number | null
          qualified_leads?: number | null
          reach?: number | null
          recorded_at?: string
          saves?: number | null
          shares?: number | null
          source?: string
          variant_id?: string | null
          views?: number | null
        }
        Update: {
          avg_watch_sec?: number | null
          comments?: number | null
          completion_rate?: number | null
          conversions?: number | null
          created_at?: string
          created_by?: string | null
          dms?: number | null
          id?: string
          leads?: number | null
          likes?: number | null
          master_id?: string
          note?: string | null
          platform?: string
          profile_visits?: number | null
          qualified_leads?: number | null
          reach?: number | null
          recorded_at?: string
          saves?: number | null
          shares?: number | null
          source?: string
          variant_id?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_analytics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_analytics_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "studio_content_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_analytics_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "studio_content_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_campaigns: {
        Row: {
          audience: string | null
          brief: Json
          created_at: string
          created_by: string | null
          cta: string | null
          id: string
          objective: string | null
          pillar: string | null
          platforms: string[]
          post_count: number | null
          status: string
          title: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          audience?: string | null
          brief?: Json
          created_at?: string
          created_by?: string | null
          cta?: string | null
          id?: string
          objective?: string | null
          pillar?: string | null
          platforms?: string[]
          post_count?: number | null
          status?: string
          title: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string | null
          brief?: Json
          created_at?: string
          created_by?: string | null
          cta?: string | null
          id?: string
          objective?: string | null
          pillar?: string | null
          platforms?: string[]
          post_count?: number | null
          status?: string
          title?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_case_insights: {
        Row: {
          approved_for_content: boolean
          case_id: string
          content_angle: string | null
          created_at: string
          created_by: string | null
          generated_by: string
          generation_id: string | null
          id: string
          insight: string
          lesson: string | null
          pillar: string | null
          privacy_status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_for_content?: boolean
          case_id: string
          content_angle?: string | null
          created_at?: string
          created_by?: string | null
          generated_by?: string
          generation_id?: string | null
          id?: string
          insight: string
          lesson?: string | null
          pillar?: string | null
          privacy_status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_for_content?: boolean
          case_id?: string
          content_angle?: string | null
          created_at?: string
          created_by?: string | null
          generated_by?: string
          generation_id?: string | null
          id?: string
          insight?: string
          lesson?: string | null
          pillar?: string | null
          privacy_status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_case_insights_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "studio_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_case_insights_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_cases: {
        Row: {
          anonymized_version: string | null
          approved_for_content: boolean
          case_code: string
          case_type: string
          content_potential: string
          created_at: string
          created_by: string | null
          id: string
          interesting_insight: string | null
          is_demo: boolean
          lessons: string | null
          linked_case_id: string | null
          method: string | null
          objective: string | null
          observations: string | null
          outcome: string | null
          sensitivity: string
          situation: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          anonymized_version?: string | null
          approved_for_content?: boolean
          case_code: string
          case_type?: string
          content_potential?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interesting_insight?: string | null
          is_demo?: boolean
          lessons?: string | null
          linked_case_id?: string | null
          method?: string | null
          objective?: string | null
          observations?: string | null
          outcome?: string | null
          sensitivity?: string
          situation?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          anonymized_version?: string | null
          approved_for_content?: boolean
          case_code?: string
          case_type?: string
          content_potential?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interesting_insight?: string | null
          is_demo?: boolean
          lessons?: string | null
          linked_case_id?: string | null
          method?: string | null
          objective?: string | null
          observations?: string | null
          outcome?: string | null
          sensitivity?: string
          situation?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_cases_linked_case_id_fkey"
            columns: ["linked_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_content_claims: {
        Row: {
          claim: string
          created_at: string
          id: string
          master_id: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string | null
          source_kind: string | null
          support_status: string
          updated_at: string
        }
        Insert: {
          claim: string
          created_at?: string
          id?: string
          master_id: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          source_kind?: string | null
          support_status?: string
          updated_at?: string
        }
        Update: {
          claim?: string
          created_at?: string
          id?: string
          master_id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          source_kind?: string | null
          support_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_content_claims_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "studio_content_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_content_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_content_masters: {
        Row: {
          ai_notes: string | null
          approved_at: string | null
          approved_by: string | null
          campaign_id: string | null
          caption: string | null
          created_at: string
          created_by: string | null
          creative_plan: Json | null
          cta: string | null
          estimated_duration_sec: number | null
          hook: string | null
          id: string
          idea_id: string | null
          notes: string | null
          pillar: string
          primary_platform: string | null
          published_at: string | null
          published_url: string | null
          scheduled_at: string | null
          script: string | null
          status: string
          tags: string[]
          target_duration_sec: number | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          campaign_id?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          creative_plan?: Json | null
          cta?: string | null
          estimated_duration_sec?: number | null
          hook?: string | null
          id?: string
          idea_id?: string | null
          notes?: string | null
          pillar?: string
          primary_platform?: string | null
          published_at?: string | null
          published_url?: string | null
          scheduled_at?: string | null
          script?: string | null
          status?: string
          tags?: string[]
          target_duration_sec?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          campaign_id?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          creative_plan?: Json | null
          cta?: string | null
          estimated_duration_sec?: number | null
          hook?: string | null
          id?: string
          idea_id?: string | null
          notes?: string | null
          pillar?: string
          primary_platform?: string | null
          published_at?: string | null
          published_url?: string | null
          scheduled_at?: string | null
          script?: string | null
          status?: string
          tags?: string[]
          target_duration_sec?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_content_masters_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_content_masters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "studio_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_content_masters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_content_masters_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "studio_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_content_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          master_id: string
          note: string | null
          reviewer_id: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          master_id: string
          note?: string | null
          reviewer_id?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          master_id?: string
          note?: string | null
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_content_reviews_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "studio_content_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_content_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_content_sources: {
        Row: {
          created_at: string
          id: string
          label: string
          master_id: string
          note: string | null
          source_id: string | null
          source_kind: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          master_id: string
          note?: string | null
          source_id?: string | null
          source_kind: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          master_id?: string
          note?: string | null
          source_id?: string | null
          source_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_content_sources_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "studio_content_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_content_variants: {
        Row: {
          caption: string | null
          char_count: number | null
          created_at: string
          creative_plan: Json | null
          cta: string | null
          format: string
          generation_id: string | null
          hook: string | null
          id: string
          master_id: string
          platform: string
          script: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          char_count?: number | null
          created_at?: string
          creative_plan?: Json | null
          cta?: string | null
          format?: string
          generation_id?: string | null
          hook?: string | null
          id?: string
          master_id: string
          platform: string
          script?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          char_count?: number | null
          created_at?: string
          creative_plan?: Json | null
          cta?: string | null
          format?: string
          generation_id?: string | null
          hook?: string | null
          id?: string
          master_id?: string
          platform?: string
          script?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_content_variants_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "studio_content_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_creative_assets: {
        Row: {
          created_at: string
          created_by: string | null
          external_url: string | null
          id: string
          kind: string
          master_id: string
          meta: Json
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          kind?: string
          master_id: string
          meta?: Json
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          kind?: string
          master_id?: string
          meta?: Json
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_creative_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_creative_assets_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "studio_content_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_customer_questions: {
        Row: {
          answer_hint: string | null
          approved_for_content: boolean
          created_at: string
          created_by: string | null
          frequency: number
          id: string
          is_demo: boolean
          question: string
          source: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          answer_hint?: string | null
          approved_for_content?: boolean
          created_at?: string
          created_by?: string | null
          frequency?: number
          id?: string
          is_demo?: boolean
          question: string
          source?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          answer_hint?: string | null
          approved_for_content?: boolean
          created_at?: string
          created_by?: string | null
          frequency?: number
          id?: string
          is_demo?: boolean
          question?: string
          source?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_customer_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_ideas: {
        Row: {
          ai_scores: Json | null
          campaign_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          format: string | null
          generation_id: string | null
          hook: string | null
          id: string
          origin: string
          pillar: string
          platforms: string[]
          source_refs: Json
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          ai_scores?: Json | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          format?: string | null
          generation_id?: string | null
          hook?: string | null
          id?: string
          origin?: string
          pillar?: string
          platforms?: string[]
          source_refs?: Json
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          ai_scores?: Json | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          format?: string | null
          generation_id?: string | null
          hook?: string | null
          id?: string
          origin?: string
          pillar?: string
          platforms?: string[]
          source_refs?: Json
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_ideas_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "studio_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_ideas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          source_id: string
          token_count: number | null
          updated_at: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_id: string
          token_count?: number | null
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_id?: string
          token_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "studio_knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_knowledge_sources: {
        Row: {
          approved_for_content: boolean
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          origin_ref: string | null
          sensitivity: string
          source_type: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          approved_for_content?: boolean
          category?: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          origin_ref?: string | null
          sensitivity?: string
          source_type?: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          approved_for_content?: boolean
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          origin_ref?: string | null
          sensitivity?: string
          source_type?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_knowledge_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_privacy_checks: {
        Row: {
          checked_by: string
          created_at: string
          created_by: string | null
          findings: Json
          id: string
          master_id: string
          model: string | null
          status: string
        }
        Insert: {
          checked_by?: string
          created_at?: string
          created_by?: string | null
          findings?: Json
          id?: string
          master_id: string
          model?: string | null
          status: string
        }
        Update: {
          checked_by?: string
          created_at?: string
          created_by?: string | null
          findings?: Json
          id?: string
          master_id?: string
          model?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_privacy_checks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_privacy_checks_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "studio_content_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_settings: {
        Row: {
          ai_model: string | null
          ai_provider: string
          approval_rules: Json
          brand_voice: Json
          created_at: string
          default_language: string
          default_platforms: string[]
          id: string
          knowledge_prefs: Json
          pillars: Json
          privacy_rules: Json
          social_connections: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string
          approval_rules?: Json
          brand_voice?: Json
          created_at?: string
          default_language?: string
          default_platforms?: string[]
          id?: string
          knowledge_prefs?: Json
          pillars?: Json
          privacy_rules?: Json
          social_connections?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string
          approval_rules?: Json
          brand_voice?: Json
          created_at?: string
          default_language?: string
          default_platforms?: string[]
          id?: string
          knowledge_prefs?: Json
          pillars?: Json
          privacy_rules?: Json
          social_connections?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      target_locations: {
        Row: {
          address_enc: string | null
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          lat: number | null
          lng: number | null
          location_name: string | null
          location_type: string
          maps_url: string | null
          notes: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          address_enc?: string | null
          case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          location_type?: string
          maps_url?: string | null
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          address_enc?: string | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          location_type?: string
          maps_url?: string | null
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_locations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      target_photos: {
        Row: {
          caption: string | null
          case_id: string
          created_at: string
          id: string
          is_primary: boolean
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          case_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          case_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "target_photos_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      target_relationships: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          name_enc: string | null
          notes: string | null
          relation: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name_enc?: string | null
          notes?: string | null
          relation?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name_enc?: string | null
          notes?: string | null
          relation?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_relationships_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_relationships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      target_vehicles: {
        Row: {
          case_id: string
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          license_plate_bidx: string | null
          license_plate_enc: string | null
          make: string | null
          model: string | null
          notes: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          case_id: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          license_plate_bidx?: string | null
          license_plate_enc?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          license_plate_bidx?: string | null
          license_plate_enc?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_vehicles_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_vehicles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_entries: {
        Row: {
          agent_id: string | null
          case_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          entry: string
          entry_date: string
          entry_time: string
          id: string
          lat: number | null
          lng: number | null
          location: string | null
          photo_url: string | null
          updated_at: string | null
          updated_by: string | null
          video_url: string | null
        }
        Insert: {
          agent_id?: string | null
          case_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          entry: string
          entry_date?: string
          entry_time?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location?: string | null
          photo_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
          video_url?: string | null
        }
        Update: {
          agent_id?: string | null
          case_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          entry?: string
          entry_date?: string
          entry_time?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location?: string | null
          photo_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_entries_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_entries_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pins: {
        Row: {
          pin_hash: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          pin_hash: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          pin_hash?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_photos: {
        Row: {
          case_id: string
          created_at: string
          id: string
          is_primary: boolean
          storage_path: string
          uploaded_by: string | null
          vehicle_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          storage_path: string
          uploaded_by?: string | null
          vehicle_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          storage_path?: string
          uploaded_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_photos_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_photos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "target_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_case_claim: {
        Args: { p_claim_id: string; p_decided_by: string }
        Returns: {
          agent_id: string
          case_id: string
          case_number: string
          outcome: string
          quota_filled: boolean
        }[]
      }
      can_access_case: { Args: { target_case: string }; Returns: boolean }
      can_read_contact_analysis: { Args: { target: string }; Returns: boolean }
      can_read_image_analysis: { Args: { target: string }; Returns: boolean }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      monthly_expense_summary: {
        Args: { p_month?: string }
        Returns: {
          agent_id: string
          agent_name: string
          category: Database["public"]["Enums"]["expense_category"]
          entries: number
          total: number
        }[]
      }
      my_agent_id: { Args: never; Returns: string }
      next_invoice_number: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      alert_status: "active" | "acknowledged" | "resolved"
      case_priority: "low" | "medium" | "high" | "critical"
      case_status:
        | "new"
        | "assigned"
        | "active"
        | "pending"
        | "closed"
        | "cancelled"
      claim_status: "pending" | "approved" | "rejected"
      contact_input_type: "phone" | "email" | "username"
      evidence_type: "photo" | "video" | "pdf" | "document" | "audio"
      expense_category:
        | "fuel"
        | "toll"
        | "parking"
        | "misc"
        | "meals"
        | "accommodation"
        | "transportation"
        | "office"
      expense_status: "pending" | "paid" | "reimbursed" | "cancelled"
      gps_provider: "AIS" | "TRUE" | "DTAC" | "GPS903"
      invoice_status: "draft" | "sent" | "paid" | "overdue"
      notification_type:
        | "emergency"
        | "case"
        | "report"
        | "assignment"
        | "system"
      osint_redirect_kind: "http" | "meta" | "js" | "origin"
      osint_source_type: "upload" | "url" | "base64" | "redirect"
      osint_status: "pending" | "processing" | "complete" | "failed"
      payroll_status: "pending" | "paid" | "cancelled" | "adjusted"
      user_role: "admin" | "supervisor" | "agent" | "client"
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
      alert_status: ["active", "acknowledged", "resolved"],
      case_priority: ["low", "medium", "high", "critical"],
      case_status: [
        "new",
        "assigned",
        "active",
        "pending",
        "closed",
        "cancelled",
      ],
      claim_status: ["pending", "approved", "rejected"],
      contact_input_type: ["phone", "email", "username"],
      evidence_type: ["photo", "video", "pdf", "document", "audio"],
      expense_category: [
        "fuel",
        "toll",
        "parking",
        "misc",
        "meals",
        "accommodation",
        "transportation",
        "office",
      ],
      expense_status: ["pending", "paid", "reimbursed", "cancelled"],
      gps_provider: ["AIS", "TRUE", "DTAC", "GPS903"],
      invoice_status: ["draft", "sent", "paid", "overdue"],
      notification_type: [
        "emergency",
        "case",
        "report",
        "assignment",
        "system",
      ],
      osint_redirect_kind: ["http", "meta", "js", "origin"],
      osint_source_type: ["upload", "url", "base64", "redirect"],
      osint_status: ["pending", "processing", "complete", "failed"],
      payroll_status: ["pending", "paid", "cancelled", "adjusted"],
      user_role: ["admin", "supervisor", "agent", "client"],
    },
  },
} as const
