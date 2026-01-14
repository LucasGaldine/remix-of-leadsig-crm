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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          lead_id: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          lead_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          created_at: string
          description: string | null
          estimate_id: string
          id: string
          name: string
          quantity: number
          sort_order: number
          total: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimate_id: string
          id?: string
          name: string
          quantity?: number
          sort_order?: number
          total?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          estimate_id?: string
          id?: string
          name?: string
          quantity?: number
          sort_order?: number
          total?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string
          customer_id: string
          discount: number
          expires_at: string | null
          id: string
          job_id: string | null
          notes: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["estimate_status"]
          subtotal: number
          tax: number
          tax_rate: number
          total: number
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          discount?: number
          expires_at?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          discount?: number
          expires_at?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["interaction_direction"]
          id: string
          lead_id: string
          metadata: Json | null
          summary: string | null
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["interaction_direction"]
          id?: string
          lead_id: string
          metadata?: Json | null
          summary?: string | null
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["interaction_direction"]
          id?: string
          lead_id?: string
          metadata?: Json | null
          summary?: string | null
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          name: string
          quantity: number
          sort_order: number
          total: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          name: string
          quantity?: number
          sort_order?: number
          total?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          name?: string
          quantity?: number
          sort_order?: number
          total?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_due: number
          created_at: string
          created_by: string
          customer_id: string
          discount: number
          due_date: string | null
          estimate_id: string | null
          id: string
          job_id: string | null
          notes: string | null
          paid_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          tax_rate: number
          total: number
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          balance_due?: number
          created_at?: string
          created_by: string
          customer_id: string
          discount?: number
          due_date?: string | null
          estimate_id?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          balance_due?: number
          created_at?: string
          created_by?: string
          customer_id?: string
          discount?: number
          due_date?: string | null
          estimate_id?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          actual_value: number | null
          address: string | null
          created_at: string
          created_by: string
          crew_lead_id: string | null
          customer_id: string
          description: string | null
          estimated_value: number | null
          id: string
          lead_id: string | null
          name: string
          notes: string | null
          scheduled_date: string | null
          scheduled_time_end: string | null
          scheduled_time_start: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          actual_value?: number | null
          address?: string | null
          created_at?: string
          created_by: string
          crew_lead_id?: string | null
          customer_id: string
          description?: string | null
          estimated_value?: number | null
          id?: string
          lead_id?: string | null
          name: string
          notes?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          actual_value?: number | null
          address?: string | null
          created_at?: string
          created_by?: string
          crew_lead_id?: string | null
          customer_id?: string
          description?: string | null
          estimated_value?: number | null
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_qualifications: {
        Row: {
          budget_confirmed: boolean
          created_at: string
          decision_maker_confirmed: boolean
          disqualify_reason:
            | Database["public"]["Enums"]["disqualify_reason"]
            | null
          fit_score: number | null
          id: string
          lead_id: string
          notes: string | null
          service_area_fit: boolean
          timeline: Database["public"]["Enums"]["timeline_period"] | null
          updated_at: string
        }
        Insert: {
          budget_confirmed?: boolean
          created_at?: string
          decision_maker_confirmed?: boolean
          disqualify_reason?:
            | Database["public"]["Enums"]["disqualify_reason"]
            | null
          fit_score?: number | null
          id?: string
          lead_id: string
          notes?: string | null
          service_area_fit?: boolean
          timeline?: Database["public"]["Enums"]["timeline_period"] | null
          updated_at?: string
        }
        Update: {
          budget_confirmed?: boolean
          created_at?: string
          decision_maker_confirmed?: boolean
          disqualify_reason?:
            | Database["public"]["Enums"]["disqualify_reason"]
            | null
          fit_score?: number | null
          id?: string
          lead_id?: string
          notes?: string | null
          service_area_fit?: boolean
          timeline?: Database["public"]["Enums"]["timeline_period"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_qualifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_source_connections: {
        Row: {
          api_key_id: string | null
          connected_at: string | null
          connection_method: string | null
          created_at: string
          id: string
          inbound_email: string | null
          last_sync_at: string | null
          platform: string
          settings_json: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_id?: string | null
          connected_at?: string | null
          connection_method?: string | null
          created_at?: string
          id?: string
          inbound_email?: string | null
          last_sync_at?: string | null
          platform: string
          settings_json?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_id?: string | null
          connected_at?: string | null
          connection_method?: string | null
          created_at?: string
          id?: string
          inbound_email?: string | null
          last_sync_at?: string | null
          platform?: string
          settings_json?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_source_connections_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          approval_reason: string | null
          approval_status: string
          approved_at: string | null
          approved_by_user_id: string | null
          assigned_to: string | null
          city: string | null
          created_at: string
          created_by: string
          email: string | null
          estimated_budget: number | null
          external_payload: Json | null
          external_source_id: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          qualification_score: number | null
          rejected_at: string | null
          rejected_by_user_id: string | null
          service_type: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          approval_reason?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by_user_id?: string | null
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          estimated_budget?: number | null
          external_payload?: Json | null
          external_source_id?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          qualification_score?: number | null
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          service_type?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          approval_reason?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by_user_id?: string | null
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          estimated_budget?: number | null
          external_payload?: Json | null
          external_source_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          qualification_score?: number | null
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          service_type?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      material_items: {
        Row: {
          category: Database["public"]["Enums"]["material_category"]
          created_at: string
          id: string
          material_list_id: string
          name: string
          notes: string | null
          quantity: number
          sort_order: number
          supplier_category: string | null
          unit: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["material_category"]
          created_at?: string
          id?: string
          material_list_id: string
          name: string
          notes?: string | null
          quantity?: number
          sort_order?: number
          supplier_category?: string | null
          unit?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["material_category"]
          created_at?: string
          id?: string
          material_list_id?: string
          name?: string
          notes?: string | null
          quantity?: number
          sort_order?: number
          supplier_category?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_items_material_list_id_fkey"
            columns: ["material_list_id"]
            isOneToOne: false
            referencedRelation: "material_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      material_lists: {
        Row: {
          created_at: string
          created_by: string
          id: string
          job_id: string
          measurements: Json | null
          notes: string | null
          template_type: Database["public"]["Enums"]["template_type"]
          updated_at: string
          wastage_factor: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          job_id: string
          measurements?: Json | null
          notes?: string | null
          template_type?: Database["public"]["Enums"]["template_type"]
          updated_at?: string
          wastage_factor?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          job_id?: string
          measurements?: Json | null
          notes?: string | null
          template_type?: Database["public"]["Enums"]["template_type"]
          updated_at?: string
          wastage_factor?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_lists_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          invoice_id: string
          job_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          processed_by: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_account_id: string | null
          stripe_payment_intent_id: string | null
          transaction_ref: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          invoice_id: string
          job_id?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          processed_by?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_account_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_ref?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string
          job_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          processed_by?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_account_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          base_labor_rate: number
          created_at: string
          id: string
          material_rate: number
          notes: string | null
          overhead_multiplier: number
          profit_margin: number
          service_type: string
          unit_type: string
          updated_at: string
          user_id: string
          waste_factor: number
        }
        Insert: {
          base_labor_rate?: number
          created_at?: string
          id?: string
          material_rate?: number
          notes?: string | null
          overhead_multiplier?: number
          profit_margin?: number
          service_type: string
          unit_type?: string
          updated_at?: string
          user_id: string
          waste_factor?: number
        }
        Update: {
          base_labor_rate?: number
          created_at?: string
          id?: string
          material_rate?: number
          notes?: string | null
          overhead_multiplier?: number
          profit_margin?: number
          service_type?: string
          unit_type?: string
          updated_at?: string
          user_id?: string
          waste_factor?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_estimates: {
        Row: {
          converted_to_estimate_id: string | null
          created_at: string
          created_by: string
          id: string
          labor_total: number
          lead_id: string
          material_total: number
          measurements: Json
          notes: string | null
          service_type: string
          total_high: number
          total_low: number
          total_mid: number
          updated_at: string
        }
        Insert: {
          converted_to_estimate_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          labor_total?: number
          lead_id: string
          material_total?: number
          measurements?: Json
          notes?: string | null
          service_type: string
          total_high?: number
          total_low?: number
          total_mid?: number
          updated_at?: string
        }
        Update: {
          converted_to_estimate_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          labor_total?: number
          lead_id?: string
          material_total?: number
          measurements?: Json
          notes?: string | null
          service_type?: string
          total_high?: number
          total_low?: number
          total_mid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_estimates_converted_to_estimate_id_fkey"
            columns: ["converted_to_estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_estimates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connect_accounts: {
        Row: {
          account_status: string
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          id: string
          onboarding_completed: boolean
          payouts_enabled: boolean
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          id?: string
          onboarding_completed?: boolean
          payouts_enabled?: boolean
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          id?: string
          onboarding_completed?: boolean
          payouts_enabled?: boolean
          stripe_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supply_order_items: {
        Row: {
          created_at: string
          id: string
          material_item_id: string | null
          name: string
          notes: string | null
          quantity: number
          received_qty: number | null
          sort_order: number
          supply_order_id: string
          total: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          material_item_id?: string | null
          name: string
          notes?: string | null
          quantity?: number
          received_qty?: number | null
          sort_order?: number
          supply_order_id: string
          total?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          material_item_id?: string | null
          name?: string
          notes?: string | null
          quantity?: number
          received_qty?: number | null
          sort_order?: number
          supply_order_id?: string
          total?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supply_order_items_material_item_id_fkey"
            columns: ["material_item_id"]
            isOneToOne: false
            referencedRelation: "material_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_order_items_supply_order_id_fkey"
            columns: ["supply_order_id"]
            isOneToOne: false
            referencedRelation: "supply_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_orders: {
        Row: {
          created_at: string
          created_by: string
          expected_delivery: string | null
          id: string
          job_id: string | null
          material_list_id: string | null
          notes: string | null
          order_number: string | null
          ordered_at: string | null
          received_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          supplier_name: string
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expected_delivery?: string | null
          id?: string
          job_id?: string | null
          material_list_id?: string | null
          notes?: string | null
          order_number?: string | null
          ordered_at?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          supplier_name: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expected_delivery?: string | null
          id?: string
          job_id?: string | null
          material_list_id?: string | null
          notes?: string | null
          order_number?: string | null
          ordered_at?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          supplier_name?: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_orders_material_list_id_fkey"
            columns: ["material_list_id"]
            isOneToOne: false
            referencedRelation: "material_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          invoice_id: string | null
          payload: Json
          payment_id: string | null
          processed_at: string
          status: string
        }
        Insert: {
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          invoice_id?: string | null
          payload: Json
          payment_id?: string | null
          processed_at?: string
          status?: string
        }
        Update: {
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          invoice_id?: string | null
          payload?: Json
          payment_id?: string | null
          processed_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "sales" | "crew_lead"
      disqualify_reason:
        | "low_budget"
        | "outside_area"
        | "not_ready"
        | "price_shopping"
        | "ghosted"
        | "other"
      estimate_status: "draft" | "sent" | "viewed" | "accepted" | "expired"
      interaction_direction: "inbound" | "outbound" | "na"
      interaction_type:
        | "call"
        | "text"
        | "note"
        | "status_change"
        | "booking"
        | "system"
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "partial"
        | "paid"
        | "overdue"
      job_status:
        | "scheduled"
        | "in-progress"
        | "completed"
        | "cancelled"
        | "on-hold"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "scheduled"
        | "unqualified"
        | "converted"
        | "in_progress"
        | "won"
        | "lost"
      material_category:
        | "base"
        | "surface"
        | "accessories"
        | "fasteners"
        | "other"
      order_status: "draft" | "ordered" | "partial" | "received" | "cancelled"
      payment_method: "cash" | "check" | "card" | "ach" | "tap-to-pay" | "other"
      payment_status: "pending" | "completed" | "failed" | "refunded"
      template_type:
        | "pavers"
        | "concrete"
        | "sod"
        | "decks"
        | "fencing"
        | "retaining-wall"
        | "other"
      timeline_period:
        | "asap"
        | "1_2_weeks"
        | "2_4_weeks"
        | "1_3_months"
        | "3_months_plus"
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
      app_role: ["owner", "admin", "sales", "crew_lead"],
      disqualify_reason: [
        "low_budget",
        "outside_area",
        "not_ready",
        "price_shopping",
        "ghosted",
        "other",
      ],
      estimate_status: ["draft", "sent", "viewed", "accepted", "expired"],
      interaction_direction: ["inbound", "outbound", "na"],
      interaction_type: [
        "call",
        "text",
        "note",
        "status_change",
        "booking",
        "system",
      ],
      invoice_status: ["draft", "sent", "viewed", "partial", "paid", "overdue"],
      job_status: [
        "scheduled",
        "in-progress",
        "completed",
        "cancelled",
        "on-hold",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "scheduled",
        "unqualified",
        "converted",
        "in_progress",
        "won",
        "lost",
      ],
      material_category: [
        "base",
        "surface",
        "accessories",
        "fasteners",
        "other",
      ],
      order_status: ["draft", "ordered", "partial", "received", "cancelled"],
      payment_method: ["cash", "check", "card", "ach", "tap-to-pay", "other"],
      payment_status: ["pending", "completed", "failed", "refunded"],
      template_type: [
        "pavers",
        "concrete",
        "sod",
        "decks",
        "fencing",
        "retaining-wall",
        "other",
      ],
      timeline_period: [
        "asap",
        "1_2_weeks",
        "2_4_weeks",
        "1_3_months",
        "3_months_plus",
      ],
    },
  },
} as const
