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
      activities: {
        Row: {
          actor_id: string | null
          campaign_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          meta: Json | null
          summary: string
          type: Database["public"]["Enums"]["activity_type"]
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          campaign_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          summary: string
          type: Database["public"]["Enums"]["activity_type"]
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          campaign_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          summary?: string
          type?: Database["public"]["Enums"]["activity_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          name: string
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["attachment_kind"]
          name: string
          size_bytes?: number
          storage_path: string
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["attachment_kind"]
          name?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string | null
          require_approval: boolean
          sending_account_ids: string[]
          sending_window: Json
          sequence_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          stop_on_reply: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          require_approval?: boolean
          sending_account_ids?: string[]
          sending_window?: Json
          sequence_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          stop_on_reply?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          require_approval?: boolean
          sending_account_ids?: string[]
          sending_window?: Json
          sequence_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          stop_on_reply?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          domain: string
          enrichment: Json
          id: string
          industry: string | null
          name: string
          notes: string | null
          owner_id: string | null
          status: Database["public"]["Enums"]["company_status"]
          tags: string[]
          updated_at: string
          website: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          enrichment?: Json
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          tags?: string[]
          updated_at?: string
          website?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          enrichment?: Json
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          tags?: string[]
          updated_at?: string
          website?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          bounced: boolean
          campaign_id: string | null
          company_id: string
          created_at: string
          email: string
          email_validity: Database["public"]["Enums"]["email_validity"]
          first_name: string
          id: string
          job_title: string | null
          last_contacted_at: string | null
          last_name: string
          linkedin_notes: string | null
          linkedin_status: Database["public"]["Enums"]["linkedin_status"]
          linkedin_url: string | null
          next_follow_up_at: string | null
          owner_id: string | null
          phone: string | null
          score: number
          score_breakdown: Json | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
          stage_entered_at: string
          tags: string[]
          unsubscribed: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bounced?: boolean
          campaign_id?: string | null
          company_id: string
          created_at?: string
          email: string
          email_validity?: Database["public"]["Enums"]["email_validity"]
          first_name: string
          id?: string
          job_title?: string | null
          last_contacted_at?: string | null
          last_name: string
          linkedin_notes?: string | null
          linkedin_status?: Database["public"]["Enums"]["linkedin_status"]
          linkedin_url?: string | null
          next_follow_up_at?: string | null
          owner_id?: string | null
          phone?: string | null
          score?: number
          score_breakdown?: Json | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          stage_entered_at?: string
          tags?: string[]
          unsubscribed?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bounced?: boolean
          campaign_id?: string | null
          company_id?: string
          created_at?: string
          email?: string
          email_validity?: Database["public"]["Enums"]["email_validity"]
          first_name?: string
          id?: string
          job_title?: string | null
          last_contacted_at?: string | null
          last_name?: string
          linkedin_notes?: string | null
          linkedin_status?: Database["public"]["Enums"]["linkedin_status"]
          linkedin_url?: string | null
          next_follow_up_at?: string | null
          owner_id?: string | null
          phone?: string | null
          score?: number
          score_breakdown?: Json | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          stage_entered_at?: string
          tags?: string[]
          unsubscribed?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_campaign_fk"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_results: {
        Row: {
          company_id: string | null
          domain: string
          emails_found: string[]
          error: string | null
          finished_at: string | null
          id: string
          pages: Json
          pages_crawled: number
          social_links: Json
          started_at: string
          status: string
          tech_stack: Json
          workspace_id: string
        }
        Insert: {
          company_id?: string | null
          domain: string
          emails_found?: string[]
          error?: string | null
          finished_at?: string | null
          id?: string
          pages?: Json
          pages_crawled?: number
          social_links?: Json
          started_at?: string
          status?: string
          tech_stack?: Json
          workspace_id: string
        }
        Update: {
          company_id?: string | null
          domain?: string
          emails_found?: string[]
          error?: string | null
          finished_at?: string | null
          id?: string
          pages?: Json
          pages_crawled?: number
          social_links?: Json
          started_at?: string
          status?: string
          tech_stack?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_results_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_results_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          ab_variant: string | null
          attempts: number
          body: string
          bounce_reason: string | null
          campaign_id: string | null
          company_id: string
          contact_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          from_email: string
          id: string
          opened_at: string | null
          clicked_at: string | null
          provider_message_id: string | null
          replied_at: string | null
          scheduled_at: string | null
          sending_account_id: string | null
          sent_at: string | null
          sequence_step_id: string | null
          status: Database["public"]["Enums"]["message_status"]
          subject: string
          template_id: string | null
          thread_id: string
          to_email: string
          word_count: number
          workspace_id: string
        }
        Insert: {
          ab_variant?: string | null
          attempts?: number
          body: string
          bounce_reason?: string | null
          campaign_id?: string | null
          company_id: string
          contact_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          from_email: string
          id?: string
          opened_at?: string | null
          clicked_at?: string | null
          provider_message_id?: string | null
          replied_at?: string | null
          scheduled_at?: string | null
          sending_account_id?: string | null
          sent_at?: string | null
          sequence_step_id?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject: string
          template_id?: string | null
          thread_id: string
          to_email: string
          word_count?: number
          workspace_id: string
        }
        Update: {
          ab_variant?: string | null
          attempts?: number
          body?: string
          bounce_reason?: string | null
          campaign_id?: string | null
          company_id?: string
          contact_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          from_email?: string
          id?: string
          opened_at?: string | null
          clicked_at?: string | null
          provider_message_id?: string | null
          replied_at?: string | null
          scheduled_at?: string | null
          sending_account_id?: string | null
          sent_at?: string | null
          sequence_step_id?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string
          template_id?: string | null
          thread_id?: string
          to_email?: string
          word_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_sending_account_id_fkey"
            columns: ["sending_account_id"]
            isOneToOne: false
            referencedRelation: "sending_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          message_id: string
          send_after: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          message_id: string
          send_after?: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          message_id?: string
          send_after?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          campaign_id: string | null
          confidence: number | null
          created_at: string
          dimension: string
          id: string
          min_sample_per_variant: number
          name: string
          status: string
          variants: Json
          winner_key: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          confidence?: number | null
          created_at?: string
          dimension: string
          id?: string
          min_sample_per_variant?: number
          name: string
          status?: string
          variants?: Json
          winner_key?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          confidence?: number | null
          created_at?: string
          dimension?: string
          id?: string
          min_sample_per_variant?: number
          name?: string
          status?: string
          variants?: Json
          winner_key?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          campaign_id: string | null
          company_id: string
          contact_id: string
          created_at: string
          draft_body: string
          draft_subject: string
          due_at: string
          id: string
          reason: string
          status: Database["public"]["Enums"]["follow_up_status"]
          template_id: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          company_id: string
          contact_id: string
          created_at?: string
          draft_body?: string
          draft_subject?: string
          due_at: string
          id?: string
          reason?: string
          status?: Database["public"]["Enums"]["follow_up_status"]
          template_id?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          company_id?: string
          contact_id?: string
          created_at?: string
          draft_body?: string
          draft_subject?: string
          due_at?: string
          id?: string
          reason?: string
          status?: Database["public"]["Enums"]["follow_up_status"]
          template_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: string | null
          attendees: string[]
          company_id: string
          contact_id: string
          created_at: string
          duration_minutes: number
          id: string
          next_action: string | null
          notes: string | null
          outcome: Database["public"]["Enums"]["meeting_outcome"]
          owner_id: string | null
          scheduled_at: string
          title: string
          workspace_id: string
        }
        Insert: {
          agenda?: string | null
          attendees?: string[]
          company_id: string
          contact_id: string
          created_at?: string
          duration_minutes?: number
          id?: string
          next_action?: string | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["meeting_outcome"]
          owner_id?: string | null
          scheduled_at: string
          title: string
          workspace_id: string
        }
        Update: {
          agenda?: string | null
          attendees?: string[]
          company_id?: string
          contact_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          next_action?: string | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["meeting_outcome"]
          owner_id?: string | null
          scheduled_at?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string | null
          body: string
          company_id: string
          created_at: string
          id: string
          pinned: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          company_id: string
          created_at?: string
          id?: string
          pinned?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          pinned?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string | null
          created_at: string
          email: string
          id: string
          last_active_at: string | null
          name: string
          title: string | null
        }
        Insert: {
          avatar_color?: string | null
          created_at?: string
          email: string
          id: string
          last_active_at?: string | null
          name: string
          title?: string | null
        }
        Update: {
          avatar_color?: string | null
          created_at?: string
          email?: string
          id?: string
          last_active_at?: string | null
          name?: string
          title?: string | null
        }
        Relationships: []
      }
      saved_views: {
        Row: {
          entity: string
          filters: Json
          icon: string | null
          id: string
          name: string
          sort: Json | null
          system: boolean
          workspace_id: string
        }
        Insert: {
          entity: string
          filters?: Json
          icon?: string | null
          id?: string
          name: string
          sort?: Json | null
          system?: boolean
          workspace_id: string
        }
        Update: {
          entity?: string
          filters?: Json
          icon?: string | null
          id?: string
          name?: string
          sort?: Json | null
          system?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_config: {
        Row: {
          max_score: number
          rules: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          max_score?: number
          rules?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          max_score?: number
          rules?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sending_accounts: {
        Row: {
          active: boolean
          created_at: string
          daily_limit: number
          dkim: string
          dmarc: string
          from_email: string
          from_name: string
          id: string
          label: string
          provider: Database["public"]["Enums"]["sending_provider"]
          reputation_score: number
          smtp_host: string | null
          smtp_pass: string | null
          smtp_port: number | null
          smtp_user: string | null
          spf: string
          warmup_enabled: boolean
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_limit?: number
          dkim?: string
          dmarc?: string
          from_email: string
          from_name: string
          id?: string
          label: string
          provider?: Database["public"]["Enums"]["sending_provider"]
          reputation_score?: number
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          spf?: string
          warmup_enabled?: boolean
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_limit?: number
          dkim?: string
          dmarc?: string
          from_email?: string
          from_name?: string
          id?: string
          label?: string
          provider?: Database["public"]["Enums"]["sending_provider"]
          reputation_score?: number
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          spf?: string
          warmup_enabled?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sending_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string
          id: string
          name: string
          steps: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          steps?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          steps?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      snippets: {
        Row: {
          content: string
          id: string
          label: string
          trigger: string
          workspace_id: string
        }
        Insert: {
          content: string
          id?: string
          label: string
          trigger: string
          workspace_id: string
        }
        Update: {
          content?: string
          id?: string
          label?: string
          trigger?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "snippets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          archived: boolean
          body: string
          category: Database["public"]["Enums"]["template_category"]
          created_at: string
          id: string
          name: string
          owner_id: string | null
          subject: string
          tags: string[]
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          body?: string
          category?: Database["public"]["Enums"]["template_category"]
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          subject?: string
          tags?: string[]
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          archived?: boolean
          body?: string
          category?: Database["public"]["Enums"]["template_category"]
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          subject?: string
          tags?: string[]
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          workspace_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          workspace_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          campaign_id: string | null
          company_id: string
          contact_id: string
          created_at: string
          id: string
          interested: boolean | null
          last_message_at: string
          meeting_booked: boolean
          owner_id: string | null
          sentiment: Database["public"]["Enums"]["reply_sentiment"]
          snoozed_until: string | null
          state: Database["public"]["Enums"]["thread_state"]
          subject: string
          unread: boolean
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          company_id: string
          contact_id: string
          created_at?: string
          id?: string
          interested?: boolean | null
          last_message_at?: string
          meeting_booked?: boolean
          owner_id?: string | null
          sentiment?: Database["public"]["Enums"]["reply_sentiment"]
          snoozed_until?: string | null
          state?: Database["public"]["Enums"]["thread_state"]
          subject: string
          unread?: boolean
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          company_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          interested?: boolean | null
          last_message_at?: string
          meeting_booked?: boolean
          owner_id?: string | null
          sentiment?: Database["public"]["Enums"]["reply_sentiment"]
          snoozed_until?: string | null
          state?: Database["public"]["Enums"]["thread_state"]
          subject?: string
          unread?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          domain: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_workspaces: { Args: never; Returns: string[] }
    }
    Enums: {
      activity_type:
        | "email_sent"
        | "email_scheduled"
        | "email_delivered"
        | "email_bounced"
        | "reply_received"
        | "positive_reply"
        | "campaign_created"
        | "campaign_paused"
        | "campaign_resumed"
        | "meeting_booked"
        | "meeting_completed"
        | "lead_imported"
        | "lead_created"
        | "template_edited"
        | "stage_changed"
        | "note_added"
        | "crawl_completed"
        | "user_login"
      attachment_kind:
        | "pdf"
        | "deck"
        | "one_pager"
        | "contract"
        | "meeting_notes"
        | "other"
      campaign_status: "draft" | "active" | "paused" | "completed"
      company_status:
        | "prospect"
        | "engaged"
        | "opportunity"
        | "customer"
        | "lost"
      email_validity: "valid" | "risky" | "invalid" | "unknown"
      follow_up_status: "due" | "approved" | "skipped" | "sent"
      linkedin_status:
        | "none"
        | "not_connected"
        | "request_sent"
        | "connected"
        | "messaged"
        | "replied"
      meeting_outcome:
        | "scheduled"
        | "completed"
        | "no_show"
        | "cancelled"
        | "won"
        | "lost"
      message_direction: "outbound" | "inbound"
      message_status:
        | "draft"
        | "queued"
        | "scheduled"
        | "pending_approval"
        | "sent"
        | "delivered"
        | "bounced"
        | "failed"
        | "opened"
        | "replied"
        | "received"
      pipeline_stage:
        | "new"
        | "contacted"
        | "replied"
        | "qualified"
        | "meeting_scheduled"
        | "demo_completed"
        | "proposal_sent"
        | "customer"
        | "closed_lost"
      reply_sentiment: "positive" | "neutral" | "negative" | "unclassified"
      sending_provider: "resend" | "smtp"
      template_category:
        | "initial"
        | "follow_up"
        | "breakup"
        | "referral"
        | "meeting_confirmation"
        | "custom"
      thread_state: "open" | "snoozed" | "archived"
      user_role: "owner" | "admin" | "member" | "viewer"
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
      activity_type: [
        "email_sent",
        "email_scheduled",
        "email_delivered",
        "email_bounced",
        "reply_received",
        "positive_reply",
        "campaign_created",
        "campaign_paused",
        "campaign_resumed",
        "meeting_booked",
        "meeting_completed",
        "lead_imported",
        "lead_created",
        "template_edited",
        "stage_changed",
        "note_added",
        "crawl_completed",
        "user_login",
      ],
      attachment_kind: [
        "pdf",
        "deck",
        "one_pager",
        "contract",
        "meeting_notes",
        "other",
      ],
      campaign_status: ["draft", "active", "paused", "completed"],
      company_status: [
        "prospect",
        "engaged",
        "opportunity",
        "customer",
        "lost",
      ],
      email_validity: ["valid", "risky", "invalid", "unknown"],
      follow_up_status: ["due", "approved", "skipped", "sent"],
      linkedin_status: [
        "none",
        "not_connected",
        "request_sent",
        "connected",
        "messaged",
        "replied",
      ],
      meeting_outcome: [
        "scheduled",
        "completed",
        "no_show",
        "cancelled",
        "won",
        "lost",
      ],
      message_direction: ["outbound", "inbound"],
      message_status: [
        "draft",
        "queued",
        "scheduled",
        "pending_approval",
        "sent",
        "delivered",
        "bounced",
        "failed",
        "opened",
        "replied",
        "received",
      ],
      pipeline_stage: [
        "new",
        "contacted",
        "replied",
        "qualified",
        "meeting_scheduled",
        "demo_completed",
        "proposal_sent",
        "customer",
        "closed_lost",
      ],
      reply_sentiment: ["positive", "neutral", "negative", "unclassified"],
      sending_provider: ["resend", "smtp"],
      template_category: [
        "initial",
        "follow_up",
        "breakup",
        "referral",
        "meeting_confirmation",
        "custom",
      ],
      thread_state: ["open", "snoozed", "archived"],
      user_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const
