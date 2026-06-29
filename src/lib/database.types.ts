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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      payroll_status: ["pending", "paid", "cancelled", "adjusted"],
      user_role: ["admin", "supervisor", "agent", "client"],
    },
  },
} as const
