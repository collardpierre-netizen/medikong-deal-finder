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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_login: string | null
          name: string
          role: Database["public"]["Enums"]["admin_role"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          name: string
          role?: Database["public"]["Enums"]["admin_role"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          name?: string
          role?: Database["public"]["Enums"]["admin_role"]
          user_id?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          customer_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: string[]
          rate_limit_per_day: number
          rate_limit_per_minute: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: string[]
          rate_limit_per_day?: number
          rate_limit_per_minute?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: string[]
          rate_limit_per_day?: number
          rate_limit_per_minute?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string
          created_at: string
          id: string
          ip_address: string | null
          method: string
          path: string
          response_time_ms: number | null
          status_code: number
        }
        Insert: {
          api_key_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          method: string
          path: string
          response_time_ms?: number | null
          status_code: number
        }
        Update: {
          api_key_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          method?: string
          path?: string
          response_time_ms?: number | null
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          detail: string | null
          id: string
          ip_address: string | null
          module: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string | null
          id?: string
          ip_address?: string | null
          module?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string | null
          id?: string
          ip_address?: string | null
          module?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          country_of_origin: string | null
          description: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          logo_url: string | null
          manufacturer_id: string | null
          name: string
          product_count: number
          qogita_qid: string | null
          slug: string
          synced_at: string | null
          website_url: string | null
        }
        Insert: {
          country_of_origin?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          logo_url?: string | null
          manufacturer_id?: string | null
          name: string
          product_count?: number
          qogita_qid?: string | null
          slug: string
          synced_at?: string | null
          website_url?: string | null
        }
        Update: {
          country_of_origin?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          logo_url?: string | null
          manufacturer_id?: string | null
          name?: string
          product_count?: number
          qogita_qid?: string | null
          slug?: string
          synced_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_action_limits: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_deactivations_per_window: number
          notes: string | null
          table_name: string
          updated_at: string
          window_minutes: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_deactivations_per_window: number
          notes?: string | null
          table_name: string
          updated_at?: string
          window_minutes?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_deactivations_per_window?: number
          notes?: string | null
          table_name?: string
          updated_at?: string
          window_minutes?: number
        }
        Relationships: []
      }
      bulk_action_violations: {
        Row: {
          attempted_count: number
          context: Json | null
          created_at: string
          id: string
          table_name: string
          threshold: number
          user_email: string | null
          user_id: string | null
          was_blocked: boolean
          was_forced: boolean
          window_minutes: number
        }
        Insert: {
          attempted_count: number
          context?: Json | null
          created_at?: string
          id?: string
          table_name: string
          threshold: number
          user_email?: string | null
          user_id?: string | null
          was_blocked?: boolean
          was_forced?: boolean
          window_minutes: number
        }
        Update: {
          attempted_count?: number
          context?: Json | null
          created_at?: string
          id?: string
          table_name?: string
          threshold?: number
          user_email?: string | null
          user_id?: string | null
          was_blocked?: boolean
          was_forced?: boolean
          window_minutes?: number
        }
        Relationships: []
      }
      bulk_deactivation_events: {
        Row: {
          created_at: string
          id: number
          row_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          row_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          row_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          offer_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          offer_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          offer_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          description: string | null
          display_order: number
          hs_code: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          name_de: string | null
          name_fr: string | null
          name_nl: string | null
          parent_id: string | null
          qogita_qid: string | null
          slug: string
          synced_at: string | null
          vat_rate: number | null
        }
        Insert: {
          description?: string | null
          display_order?: number
          hs_code?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          name_de?: string | null
          name_fr?: string | null
          name_nl?: string | null
          parent_id?: string | null
          qogita_qid?: string | null
          slug: string
          synced_at?: string | null
          vat_rate?: number | null
        }
        Update: {
          description?: string | null
          display_order?: number
          hs_code?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          name_de?: string | null
          name_fr?: string | null
          name_nl?: string | null
          parent_id?: string | null
          qogita_qid?: string | null
          slug?: string
          synced_at?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_bulk_actions: {
        Row: {
          action: string
          cascade_products: boolean
          category_count: number
          category_ids: string[]
          created_at: string
          id: string
          notes: string | null
          performed_by: string | null
          performed_by_email: string | null
          product_count: number
          product_ids: string[]
          scope: string
          scope_params: Json
          undo_action_id: string | null
          undone_at: string | null
          undone_by: string | null
        }
        Insert: {
          action: string
          cascade_products?: boolean
          category_count?: number
          category_ids?: string[]
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          performed_by_email?: string | null
          product_count?: number
          product_ids?: string[]
          scope: string
          scope_params?: Json
          undo_action_id?: string | null
          undone_at?: string | null
          undone_by?: string | null
        }
        Update: {
          action?: string
          cascade_products?: boolean
          category_count?: number
          category_ids?: string[]
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          performed_by_email?: string | null
          product_count?: number
          product_ids?: string[]
          scope?: string
          scope_params?: Json
          undo_action_id?: string | null
          undone_at?: string | null
          undone_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_bulk_actions_undo_action_id_fkey"
            columns: ["undo_action_id"]
            isOneToOne: false
            referencedRelation: "category_bulk_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      client_error_logs: {
        Row: {
          component: string | null
          created_at: string
          fingerprint: string | null
          id: string
          level: string
          message: string
          metadata: Json | null
          route: string | null
          source: string
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component?: string | null
          created_at?: string
          fingerprint?: string | null
          id?: string
          level?: string
          message: string
          metadata?: Json | null
          route?: string | null
          source?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component?: string | null
          created_at?: string
          fingerprint?: string | null
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          route?: string | null
          source?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cms_featured_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_featured_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_hero_images: {
        Row: {
          alt_text: string | null
          created_at: string
          cta_text: string | null
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          sort_order: number
          subtitle: string | null
          title: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          cta_text?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          cta_text?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string | null
        }
        Relationships: []
      }
      cms_page_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_url: string
          page_key: string
          section_key: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url: string
          page_key: string
          section_key: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url?: string
          page_key?: string
          section_key?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          created_at: string | null
          currency: string | null
          default_language: string | null
          default_vat_rate: number | null
          display_order: number | null
          flag_emoji: string | null
          is_active: boolean | null
          last_sync_at: string | null
          name: string
          name_local: string | null
          qogita_sync_enabled: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          currency?: string | null
          default_language?: string | null
          default_vat_rate?: number | null
          display_order?: number | null
          flag_emoji?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          name: string
          name_local?: string | null
          qogita_sync_enabled?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          currency?: string | null
          default_language?: string | null
          default_vat_rate?: number | null
          display_order?: number | null
          flag_emoji?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          name?: string
          name_local?: string | null
          qogita_sync_enabled?: boolean | null
        }
        Relationships: []
      }
      crm_campaigns: {
        Row: {
          clicked_count: number
          created_at: string
          id: string
          name: string
          opened_count: number
          scheduled_at: string | null
          segment: string | null
          sent_at: string | null
          sent_count: number
          status: string
          updated_at: string
        }
        Insert: {
          clicked_count?: number
          created_at?: string
          id?: string
          name: string
          opened_count?: number
          scheduled_at?: string | null
          segment?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          clicked_count?: number
          created_at?: string
          id?: string
          name?: string
          opened_count?: number
          scheduled_at?: string | null
          segment?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          received_at: string
          sender_email: string | null
          sender_name: string
          subject: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          received_at?: string
          sender_email?: string | null
          sender_name: string
          subject: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          received_at?: string
          sender_email?: string | null
          sender_name?: string
          subject?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address_line1: string
          address_line2: string | null
          auth_user_id: string | null
          city: string
          company_name: string
          country_code: string
          created_at: string
          credit_limit: number | null
          customer_type: Database["public"]["Enums"]["customer_type"]
          email: string
          id: string
          is_professional: boolean
          is_verified: boolean
          payment_terms_days: number
          phone: string | null
          postal_code: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          auth_user_id?: string | null
          city: string
          company_name: string
          country_code?: string
          created_at?: string
          credit_limit?: number | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email: string
          id?: string
          is_professional?: boolean
          is_verified?: boolean
          payment_terms_days?: number
          phone?: string | null
          postal_code: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          auth_user_id?: string | null
          city?: string
          company_name?: string
          country_code?: string
          created_at?: string
          credit_limit?: number | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string
          id?: string
          is_professional?: boolean
          is_verified?: boolean
          payment_terms_days?: number
          phone?: string | null
          postal_code?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      delegate_assignments: {
        Row: {
          created_at: string
          delegate_id: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["delegate_entity_type"]
          id: string
          is_primary: boolean
        }
        Insert: {
          created_at?: string
          delegate_id: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["delegate_entity_type"]
          id?: string
          is_primary?: boolean
        }
        Update: {
          created_at?: string
          delegate_id?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["delegate_entity_type"]
          id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "delegate_assignments_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
        ]
      }
      delegates: {
        Row: {
          bio: string | null
          created_at: string
          delegate_type: Database["public"]["Enums"]["delegate_type"]
          email: string | null
          full_name: string
          id: string
          is_visible: boolean
          phone: string | null
          photo_url: string | null
          specialties: string[] | null
          updated_at: string
          zones: string[] | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          delegate_type?: Database["public"]["Enums"]["delegate_type"]
          email?: string | null
          full_name: string
          id?: string
          is_visible?: boolean
          phone?: string | null
          photo_url?: string | null
          specialties?: string[] | null
          updated_at?: string
          zones?: string[] | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          delegate_type?: Database["public"]["Enums"]["delegate_type"]
          email?: string | null
          full_name?: string
          id?: string
          is_visible?: boolean
          phone?: string | null
          photo_url?: string | null
          specialties?: string[] | null
          updated_at?: string
          zones?: string[] | null
        }
        Relationships: []
      }
      discount_tiers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          mov_amount: number
          mov_currency: string | null
          mov_progress: number | null
          offer_id: string
          price_currency: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mov_amount: number
          mov_currency?: string | null
          mov_progress?: number | null
          offer_id: string
          price_currency?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mov_amount?: number
          mov_currency?: string | null
          mov_progress?: number | null
          offer_id?: string
          price_currency?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "discount_tiers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_tiers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      external_leads: {
        Row: {
          clicked_at: string | null
          external_offer_id: string
          external_vendor_id: string
          id: string
          ip_address: string | null
          product_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          clicked_at?: string | null
          external_offer_id: string
          external_vendor_id: string
          id?: string
          ip_address?: string | null
          product_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          clicked_at?: string | null
          external_offer_id?: string
          external_vendor_id?: string
          id?: string
          ip_address?: string | null
          product_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_leads_external_offer_id_fkey"
            columns: ["external_offer_id"]
            isOneToOne: false
            referencedRelation: "external_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_leads_external_vendor_id_fkey"
            columns: ["external_vendor_id"]
            isOneToOne: false
            referencedRelation: "external_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      external_offers: {
        Row: {
          created_at: string | null
          currency: string | null
          delivery_days: number | null
          external_vendor_id: string
          id: string
          is_active: boolean | null
          mov_amount: number | null
          notes: string | null
          product_id: string
          product_url: string
          stock_status: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          delivery_days?: number | null
          external_vendor_id: string
          id?: string
          is_active?: boolean | null
          mov_amount?: number | null
          notes?: string | null
          product_id: string
          product_url: string
          stock_status?: string | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          delivery_days?: number | null
          external_vendor_id?: string
          id?: string
          is_active?: boolean | null
          mov_amount?: number | null
          notes?: string | null
          product_id?: string
          product_url?: string
          stock_status?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_offers_external_vendor_id_fkey"
            columns: ["external_vendor_id"]
            isOneToOne: false
            referencedRelation: "external_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      external_offers_import_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          errors: Json | null
          external_vendor_id: string
          id: string
          rows_failed: number
          rows_matched: number
          rows_received: number
          rows_unmatched: number
          rows_upserted: number
          source: string
          unmatched_gtins: Json | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          errors?: Json | null
          external_vendor_id: string
          id?: string
          rows_failed?: number
          rows_matched?: number
          rows_received?: number
          rows_unmatched?: number
          rows_upserted?: number
          source?: string
          unmatched_gtins?: Json | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          errors?: Json | null
          external_vendor_id?: string
          id?: string
          rows_failed?: number
          rows_matched?: number
          rows_received?: number
          rows_unmatched?: number
          rows_upserted?: number
          source?: string
          unmatched_gtins?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "external_offers_import_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "external_vendor_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_offers_import_logs_external_vendor_id_fkey"
            columns: ["external_vendor_id"]
            isOneToOne: false
            referencedRelation: "external_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      external_vendor_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          external_vendor_id: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          label: string | null
          last_used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_vendor_id: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          label?: string | null
          last_used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_vendor_id?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          label?: string | null
          last_used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_vendor_api_keys_external_vendor_id_fkey"
            columns: ["external_vendor_id"]
            isOneToOne: false
            referencedRelation: "external_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      external_vendors: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          country_code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          notes: string | null
          slug: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          notes?: string | null
          slug?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          slug?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          answer_html: string
          category: string
          created_at: string
          display_order: number
          id: string
          is_published: boolean
          question: string
          updated_at: string
          version: string | null
          view_count: number
        }
        Insert: {
          answer_html: string
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean
          question: string
          updated_at?: string
          version?: string | null
          view_count?: number
        }
        Update: {
          answer_html?: string
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean
          question?: string
          updated_at?: string
          version?: string | null
          view_count?: number
        }
        Relationships: []
      }
      favorite_list_items: {
        Row: {
          added_at: string
          id: string
          list_id: string
          product_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          list_id: string
          product_id: string
        }
        Update: {
          added_at?: string
          id?: string
          list_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "favorite_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_deals: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          discount_price_incl_vat: number
          ends_at: string
          id: string
          is_active: boolean
          label: string | null
          original_price_incl_vat: number
          product_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_price_incl_vat: number
          ends_at: string
          id?: string
          is_active?: boolean
          label?: string | null
          original_price_incl_vat: number
          product_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_price_incl_vat?: number
          ends_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          original_price_incl_vat?: number
          product_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_deals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promotion_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturers: {
        Row: {
          brand_count: number | null
          certifications: string[] | null
          country_of_origin: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          legal_name: string | null
          logo_url: string | null
          name: string
          product_count: number | null
          qogita_qid: string | null
          slug: string
          specialties: string[] | null
          synced_at: string | null
          updated_at: string | null
          website_url: string | null
          year_founded: number | null
        }
        Insert: {
          brand_count?: number | null
          certifications?: string[] | null
          country_of_origin?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          product_count?: number | null
          qogita_qid?: string | null
          slug: string
          specialties?: string[] | null
          synced_at?: string | null
          updated_at?: string | null
          website_url?: string | null
          year_founded?: number | null
        }
        Update: {
          brand_count?: number | null
          certifications?: string[] | null
          country_of_origin?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          product_count?: number | null
          qogita_qid?: string | null
          slug?: string
          specialties?: string[] | null
          synced_at?: string | null
          updated_at?: string | null
          website_url?: string | null
          year_founded?: number | null
        }
        Relationships: []
      }
      margin_rules: {
        Row: {
          brand_id: string | null
          category_id: string | null
          created_at: string
          extra_delay_days: number
          id: string
          is_active: boolean
          margin_percentage: number
          max_base_price: number | null
          min_base_price: number | null
          name: string
          priority: number
          round_price_to: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          extra_delay_days?: number
          id?: string
          is_active?: boolean
          margin_percentage?: number
          max_base_price?: number | null
          min_base_price?: number | null
          name: string
          priority?: number
          round_price_to?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          extra_delay_days?: number
          id?: string
          is_active?: boolean
          margin_percentage?: number
          max_base_price?: number | null
          min_base_price?: number | null
          name?: string
          priority?: number
          round_price_to?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "margin_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "margin_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "margin_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "margin_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "margin_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      market_code_types: {
        Row: {
          code: string
          country_code: string
          country_name: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
          validation_regex: string | null
        }
        Insert: {
          code: string
          country_code: string
          country_name: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
          validation_regex?: string | null
        }
        Update: {
          code?: string
          country_code?: string
          country_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
          validation_regex?: string | null
        }
        Relationships: []
      }
      market_price_sources: {
        Row: {
          country_code: string | null
          created_at: string | null
          file_format: string | null
          id: string
          is_active: boolean | null
          last_import_at: string | null
          name: string
          slug: string
          source_type: string
          total_products: number | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          file_format?: string | null
          id?: string
          is_active?: boolean | null
          last_import_at?: string | null
          name: string
          slug: string
          source_type?: string
          total_products?: number | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          file_format?: string | null
          id?: string
          is_active?: boolean | null
          last_import_at?: string | null
          name?: string
          slug?: string
          source_type?: string
          total_products?: number | null
        }
        Relationships: []
      }
      market_prices: {
        Row: {
          cnk: string | null
          ean: string | null
          id: string
          imported_at: string | null
          is_matched: boolean | null
          prix_grossiste: number | null
          prix_pharmacien: number | null
          prix_public: number | null
          product_id: string | null
          product_name_source: string | null
          product_url: string | null
          remise_pct: number | null
          source_id: string
          stock_source: string | null
          supplier_code: string | null
          supplier_name: string | null
          tva_rate: number | null
        }
        Insert: {
          cnk?: string | null
          ean?: string | null
          id?: string
          imported_at?: string | null
          is_matched?: boolean | null
          prix_grossiste?: number | null
          prix_pharmacien?: number | null
          prix_public?: number | null
          product_id?: string | null
          product_name_source?: string | null
          product_url?: string | null
          remise_pct?: number | null
          source_id: string
          stock_source?: string | null
          supplier_code?: string | null
          supplier_name?: string | null
          tva_rate?: number | null
        }
        Update: {
          cnk?: string | null
          ean?: string | null
          id?: string
          imported_at?: string | null
          is_matched?: boolean | null
          prix_grossiste?: number | null
          prix_pharmacien?: number | null
          prix_public?: number | null
          product_id?: string | null
          product_name_source?: string | null
          product_url?: string | null
          remise_pct?: number | null
          source_id?: string
          stock_source?: string | null
          supplier_code?: string | null
          supplier_name?: string | null
          tva_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_prices_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "market_price_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          offer_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          offer_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_categories_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_categories_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_margin_snapshots: {
        Row: {
          commission_amount: number
          commission_model: string
          commission_pct: number | null
          commission_rate: number | null
          computed_at: string
          fixed_commission_amount: number | null
          gross_margin: number | null
          id: string
          margin_split_pct: number | null
          net_margin: number | null
          net_margin_pct: number | null
          net_revenue: number
          offer_id: string
          product_id: string
          purchase_price_excl_vat: number | null
          sell_price_excl_vat: number
          trigger_source: string
          vendor_id: string
        }
        Insert: {
          commission_amount: number
          commission_model: string
          commission_pct?: number | null
          commission_rate?: number | null
          computed_at?: string
          fixed_commission_amount?: number | null
          gross_margin?: number | null
          id?: string
          margin_split_pct?: number | null
          net_margin?: number | null
          net_margin_pct?: number | null
          net_revenue: number
          offer_id: string
          product_id: string
          purchase_price_excl_vat?: number | null
          sell_price_excl_vat: number
          trigger_source?: string
          vendor_id: string
        }
        Update: {
          commission_amount?: number
          commission_model?: string
          commission_pct?: number | null
          commission_rate?: number | null
          computed_at?: string
          fixed_commission_amount?: number | null
          gross_margin?: number | null
          id?: string
          margin_split_pct?: number | null
          net_margin?: number | null
          net_margin_pct?: number | null
          net_revenue?: number
          offer_id?: string
          product_id?: string
          purchase_price_excl_vat?: number | null
          sell_price_excl_vat?: number
          trigger_source?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_margin_snapshots_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_price_tiers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          margin_amount: number | null
          mov_currency: string | null
          mov_progress: number | null
          mov_threshold: number
          offer_id: string | null
          price_excl_vat: number
          price_incl_vat: number
          qogita_unit_price: number
          tier_index: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          margin_amount?: number | null
          mov_currency?: string | null
          mov_progress?: number | null
          mov_threshold: number
          offer_id?: string | null
          price_excl_vat: number
          price_incl_vat: number
          qogita_unit_price: number
          tier_index: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          margin_amount?: number | null
          mov_currency?: string | null
          mov_progress?: number | null
          mov_threshold?: number
          offer_id?: string | null
          price_excl_vat?: number
          price_incl_vat?: number
          qogita_unit_price?: number
          tier_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "offer_price_tiers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_price_tiers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_price_tiers_shadow: {
        Row: {
          cohort: string
          created_at: string | null
          id: string
          is_active: boolean | null
          margin_amount: number | null
          mov_currency: string | null
          mov_progress: number | null
          mov_threshold: number
          offer_id: string
          price_excl_vat: number
          price_incl_vat: number
          qogita_payload_sample: Json | null
          qogita_unit_price: number
          tier_index: number
        }
        Insert: {
          cohort: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          margin_amount?: number | null
          mov_currency?: string | null
          mov_progress?: number | null
          mov_threshold: number
          offer_id: string
          price_excl_vat: number
          price_incl_vat: number
          qogita_payload_sample?: Json | null
          qogita_unit_price: number
          tier_index: number
        }
        Update: {
          cohort?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          margin_amount?: number | null
          mov_currency?: string | null
          mov_progress?: number | null
          mov_threshold?: number
          offer_id?: string
          price_excl_vat?: number
          price_incl_vat?: number
          qogita_payload_sample?: Json | null
          qogita_unit_price?: number
          tier_index?: number
        }
        Relationships: []
      }
      offer_profile_rules: {
        Row: {
          country_code: string | null
          created_at: string | null
          custom_price_excl_vat: number | null
          discount_percentage: number | null
          id: string
          is_active: boolean | null
          moq: number | null
          mov_amount: number | null
          mov_currency: string | null
          offer_id: string
          profile_type: string
          updated_at: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          custom_price_excl_vat?: number | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          moq?: number | null
          mov_amount?: number | null
          mov_currency?: string | null
          offer_id: string
          profile_type: string
          updated_at?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          custom_price_excl_vat?: number | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          moq?: number | null
          mov_amount?: number | null
          mov_currency?: string | null
          offer_id?: string
          profile_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_profile_rules_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_profile_rules_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          applied_margin_percentage: number | null
          applied_margin_rule_id: string | null
          country_code: string | null
          created_at: string
          delivery_days: number | null
          down_payment_pct: number | null
          estimated_delivery_days: number | null
          has_extended_delivery: boolean | null
          id: string
          is_active: boolean
          is_qogita_backed: boolean
          is_top_seller: boolean | null
          is_traceable: boolean | null
          margin_amount: number | null
          max_delivery_days: number | null
          min_delivery_days: number | null
          moq: number
          mov: number | null
          mov_amount: number | null
          mov_currency: string | null
          price_excl_vat: number
          price_incl_vat: number
          price_tiers: Json | null
          product_id: string
          purchase_price: number | null
          purchase_price_excl_vat: number | null
          qogita_base_delay_days: number | null
          qogita_base_price: number | null
          qogita_offer_qid: string | null
          qogita_seller_fid: string | null
          shipping_from_country: string | null
          stock_quantity: number
          stock_status: Database["public"]["Enums"]["stock_status_enum"]
          synced_at: string | null
          updated_at: string
          vat_rate: number
          vendor_id: string
        }
        Insert: {
          applied_margin_percentage?: number | null
          applied_margin_rule_id?: string | null
          country_code?: string | null
          created_at?: string
          delivery_days?: number | null
          down_payment_pct?: number | null
          estimated_delivery_days?: number | null
          has_extended_delivery?: boolean | null
          id?: string
          is_active?: boolean
          is_qogita_backed?: boolean
          is_top_seller?: boolean | null
          is_traceable?: boolean | null
          margin_amount?: number | null
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          moq?: number
          mov?: number | null
          mov_amount?: number | null
          mov_currency?: string | null
          price_excl_vat: number
          price_incl_vat: number
          price_tiers?: Json | null
          product_id: string
          purchase_price?: number | null
          purchase_price_excl_vat?: number | null
          qogita_base_delay_days?: number | null
          qogita_base_price?: number | null
          qogita_offer_qid?: string | null
          qogita_seller_fid?: string | null
          shipping_from_country?: string | null
          stock_quantity?: number
          stock_status?: Database["public"]["Enums"]["stock_status_enum"]
          synced_at?: string | null
          updated_at?: string
          vat_rate?: number
          vendor_id: string
        }
        Update: {
          applied_margin_percentage?: number | null
          applied_margin_rule_id?: string | null
          country_code?: string | null
          created_at?: string
          delivery_days?: number | null
          down_payment_pct?: number | null
          estimated_delivery_days?: number | null
          has_extended_delivery?: boolean | null
          id?: string
          is_active?: boolean
          is_qogita_backed?: boolean
          is_top_seller?: boolean | null
          is_traceable?: boolean | null
          margin_amount?: number | null
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          moq?: number
          mov?: number | null
          mov_amount?: number | null
          mov_currency?: string | null
          price_excl_vat?: number
          price_incl_vat?: number
          price_tiers?: Json | null
          product_id?: string
          purchase_price?: number | null
          purchase_price_excl_vat?: number | null
          qogita_base_delay_days?: number | null
          qogita_base_price?: number | null
          qogita_offer_qid?: string | null
          qogita_seller_fid?: string | null
          shipping_from_country?: string | null
          stock_quantity?: number
          stock_status?: Database["public"]["Enums"]["stock_status_enum"]
          synced_at?: string | null
          updated_at?: string
          vat_rate?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_applied_margin_rule_id_fkey"
            columns: ["applied_margin_rule_id"]
            isOneToOne: false
            referencedRelation: "margin_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_testimonials: {
        Row: {
          background_url: string | null
          created_at: string
          gradient: string
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          quote: string
          role_visibility: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          background_url?: string | null
          created_at?: string
          gradient?: string
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          quote: string
          role_visibility?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          background_url?: string | null
          created_at?: string
          gradient?: string
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          quote?: string
          role_visibility?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total_excl_vat: number
          line_total_incl_vat: number
          offer_id: string | null
          order_id: string
          product_id: string | null
          qogita_base_price: number | null
          qogita_offer_qid: string | null
          qogita_seller_fid: string | null
          quantity: number
          unit_price_excl_vat: number
          unit_price_incl_vat: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_excl_vat?: number
          line_total_incl_vat?: number
          offer_id?: string | null
          order_id: string
          product_id?: string | null
          qogita_base_price?: number | null
          qogita_offer_qid?: string | null
          qogita_seller_fid?: string | null
          quantity?: number
          unit_price_excl_vat?: number
          unit_price_incl_vat?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total_excl_vat?: number
          line_total_incl_vat?: number
          offer_id?: string | null
          order_id?: string
          product_id?: string | null
          qogita_base_price?: number | null
          qogita_offer_qid?: string | null
          qogita_seller_fid?: string | null
          quantity?: number
          unit_price_excl_vat?: number
          unit_price_incl_vat?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_line_sub_orders: {
        Row: {
          order_line_id: string
          sub_order_id: string
        }
        Insert: {
          order_line_id: string
          sub_order_id: string
        }
        Update: {
          order_line_id?: string
          sub_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_line_sub_orders_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: true
            referencedRelation: "customer_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_sub_orders_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: true
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_sub_orders_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          cost_price: number | null
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          line_cost: number | null
          line_margin: number | null
          line_total_excl_vat: number
          line_total_incl_vat: number
          offer_id: string
          order_id: string
          product_id: string
          qogita_offer_qid: string | null
          qogita_order_status: string
          qogita_seller_fid: string | null
          quantity: number
          tracking_number: string | null
          tracking_url: string | null
          unit_price_excl_vat: number
          unit_price_incl_vat: number
          vat_rate: number
          vendor_id: string
        }
        Insert: {
          cost_price?: number | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          line_cost?: number | null
          line_margin?: number | null
          line_total_excl_vat: number
          line_total_incl_vat: number
          offer_id: string
          order_id: string
          product_id: string
          qogita_offer_qid?: string | null
          qogita_order_status?: string
          qogita_seller_fid?: string | null
          quantity: number
          tracking_number?: string | null
          tracking_url?: string | null
          unit_price_excl_vat: number
          unit_price_incl_vat: number
          vat_rate: number
          vendor_id: string
        }
        Update: {
          cost_price?: number | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          line_cost?: number | null
          line_margin?: number | null
          line_total_excl_vat?: number
          line_total_incl_vat?: number
          offer_id?: string
          order_id?: string
          product_id?: string
          qogita_offer_qid?: string | null
          qogita_order_status?: string
          qogita_seller_fid?: string | null
          quantity?: number
          tracking_number?: string | null
          tracking_url?: string | null
          unit_price_excl_vat?: number
          unit_price_incl_vat?: number
          vat_rate?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_transfers: {
        Row: {
          amount: number
          commission_amount: number
          commission_rate: number
          created_at: string
          id: string
          order_id: string
          status: string
          stripe_transfer_id: string | null
          vendor_id: string
        }
        Insert: {
          amount?: number
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          order_id: string
          status?: string
          stripe_transfer_id?: string | null
          vendor_id: string
        }
        Update: {
          amount?: number
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          order_id?: string
          status?: string
          stripe_transfer_id?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_transfers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_transfers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_transfers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_transfers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_notes: string | null
          api_key_id: string | null
          billing_address: Json
          created_at: string
          customer_id: string
          estimated_delivery_date: string | null
          id: string
          notes: string | null
          order_number: string
          payment_due_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          shipping_address: Json
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          subtotal_excl_vat: number
          total_cost: number | null
          total_incl_vat: number
          total_margin: number | null
          updated_at: string
          vat_amount: number
        }
        Insert: {
          admin_notes?: string | null
          api_key_id?: string | null
          billing_address?: Json
          created_at?: string
          customer_id: string
          estimated_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number: string
          payment_due_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          shipping_address?: Json
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          subtotal_excl_vat?: number
          total_cost?: number | null
          total_incl_vat?: number
          total_margin?: number | null
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          admin_notes?: string | null
          api_key_id?: string | null
          billing_address?: Json
          created_at?: string
          customer_id?: string
          estimated_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_due_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          shipping_address?: Json
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          subtotal_excl_vat?: number
          total_cost?: number | null
          total_incl_vat?: number
          total_margin?: number | null
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      price_adjustment_log: {
        Row: {
          adjusted_at: string
          alert_id: string | null
          id: string
          new_price: number
          old_price: number
          product_id: string
          trigger: Database["public"]["Enums"]["adjustment_trigger"]
          vendor_id: string
        }
        Insert: {
          adjusted_at?: string
          alert_id?: string | null
          id?: string
          new_price: number
          old_price: number
          product_id: string
          trigger?: Database["public"]["Enums"]["adjustment_trigger"]
          vendor_id: string
        }
        Update: {
          adjusted_at?: string
          alert_id?: string | null
          id?: string
          new_price?: number
          old_price?: number
          product_id?: string
          trigger?: Database["public"]["Enums"]["adjustment_trigger"]
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_adjustment_log_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "price_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustment_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustment_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustment_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustment_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alert_notifications: {
        Row: {
          alert_vendor_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          id: string
          message_content: string | null
          read_at: string | null
          sent_at: string
          sent_by: Database["public"]["Enums"]["notification_sender"]
        }
        Insert: {
          alert_vendor_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          id?: string
          message_content?: string | null
          read_at?: string | null
          sent_at?: string
          sent_by?: Database["public"]["Enums"]["notification_sender"]
        }
        Update: {
          alert_vendor_id?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          id?: string
          message_content?: string | null
          read_at?: string | null
          sent_at?: string
          sent_by?: Database["public"]["Enums"]["notification_sender"]
        }
        Relationships: [
          {
            foreignKeyName: "price_alert_notifications_alert_vendor_id_fkey"
            columns: ["alert_vendor_id"]
            isOneToOne: false
            referencedRelation: "price_alert_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alert_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      price_alert_vendors: {
        Row: {
          alert_id: string
          created_at: string
          id: string
          new_price: number | null
          notification_read_at: string | null
          notification_sent: boolean
          notification_sent_at: string | null
          old_price: number | null
          price_adjusted: boolean
          price_adjusted_at: string | null
          suggested_price: number | null
          vendor_gap_percentage: number
          vendor_id: string
          vendor_price: number
        }
        Insert: {
          alert_id: string
          created_at?: string
          id?: string
          new_price?: number | null
          notification_read_at?: string | null
          notification_sent?: boolean
          notification_sent_at?: string | null
          old_price?: number | null
          price_adjusted?: boolean
          price_adjusted_at?: string | null
          suggested_price?: number | null
          vendor_gap_percentage?: number
          vendor_id: string
          vendor_price: number
        }
        Update: {
          alert_id?: string
          created_at?: string
          id?: string
          new_price?: number | null
          notification_read_at?: string | null
          notification_sent?: boolean
          notification_sent_at?: string | null
          old_price?: number | null
          price_adjusted?: boolean
          price_adjusted_at?: string | null
          suggested_price?: number | null
          vendor_gap_percentage?: number
          vendor_id?: string
          vendor_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_alert_vendors_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "price_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alert_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alert_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alert_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          best_medikong_price: number
          created_at: string
          gap_amount: number
          gap_percentage: number
          id: string
          product_id: string
          reference_price: number
          resolved_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["alert_status"]
          updated_at: string
        }
        Insert: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          best_medikong_price: number
          created_at?: string
          gap_amount?: number
          gap_percentage?: number
          id?: string
          product_id: string
          reference_price: number
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          updated_at?: string
        }
        Update: {
          alert_type?: Database["public"]["Enums"]["alert_type"]
          best_medikong_price?: number
          created_at?: string
          gap_amount?: number
          gap_percentage?: number
          id?: string
          product_id?: string
          reference_price?: number
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          country_code: string
          id: string
          price_excl_vat: number
          price_incl_vat: number | null
          product_id: string
          recorded_at: string
        }
        Insert: {
          country_code?: string
          id?: string
          price_excl_vat: number
          price_incl_vat?: number | null
          product_id: string
          recorded_at?: string
        }
        Update: {
          country_code?: string
          id?: string
          price_excl_vat?: number
          price_incl_vat?: number | null
          product_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_levels: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          label_en: string | null
          label_fr: string
          sort_order: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          label_en?: string | null
          label_fr: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          label_en?: string | null
          label_fr?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      price_references: {
        Row: {
          category: string | null
          cnk: string | null
          created_at: string
          designation: string
          ean: string | null
          id: string
          pharmacist_price_estimated_eur: number | null
          public_price_eur: number | null
          source: string | null
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          category?: string | null
          cnk?: string | null
          created_at?: string
          designation: string
          ean?: string | null
          id?: string
          pharmacist_price_estimated_eur?: number | null
          public_price_eur?: number | null
          source?: string | null
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          category?: string | null
          cnk?: string | null
          created_at?: string
          designation?: string
          ean?: string | null
          id?: string
          pharmacist_price_estimated_eur?: number | null
          public_price_eur?: number | null
          source?: string | null
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: []
      }
      product_alerts: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_notified_at: string | null
          min_quantity: number | null
          product_id: string
          target_price: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_notified_at?: string | null
          min_quantity?: number | null
          product_id: string
          target_price?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_notified_at?: string | null
          min_quantity?: number | null
          product_id?: string
          target_price?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_country_stats: {
        Row: {
          best_price_excl_vat: number | null
          best_price_incl_vat: number | null
          country_code: string
          is_in_stock: boolean | null
          min_delivery_days: number | null
          offer_count: number | null
          product_id: string
          total_stock: number | null
        }
        Insert: {
          best_price_excl_vat?: number | null
          best_price_incl_vat?: number | null
          country_code: string
          is_in_stock?: boolean | null
          min_delivery_days?: number | null
          offer_count?: number | null
          product_id: string
          total_stock?: number | null
        }
        Update: {
          best_price_excl_vat?: number | null
          best_price_incl_vat?: number | null
          country_code?: string
          is_in_stock?: boolean | null
          min_delivery_days?: number | null
          offer_count?: number | null
          product_id?: string
          total_stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_country_stats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_market_codes: {
        Row: {
          code_value: string
          created_at: string | null
          id: string
          market_code_type_id: string | null
          product_id: string | null
          source: string | null
          updated_at: string | null
          updated_by: string | null
          verified: boolean | null
        }
        Insert: {
          code_value: string
          created_at?: string | null
          id?: string
          market_code_type_id?: string | null
          product_id?: string | null
          source?: string | null
          updated_at?: string | null
          updated_by?: string | null
          verified?: boolean | null
        }
        Update: {
          code_value?: string
          created_at?: string | null
          id?: string
          market_code_type_id?: string | null
          product_id?: string | null
          source?: string | null
          updated_at?: string | null
          updated_by?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "product_market_codes_market_code_type_id_fkey"
            columns: ["market_code_type_id"]
            isOneToOne: false
            referencedRelation: "market_code_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_market_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          created_at: string | null
          currency: string | null
          id: string
          price: number
          price_level_id: string | null
          product_id: string | null
          source: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          id?: string
          price: number
          price_level_id?: string | null
          product_id?: string | null
          source?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          id?: string
          price?: number
          price_level_id?: string | null
          product_id?: string | null
          source?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_price_level_id_fkey"
            columns: ["price_level_id"]
            isOneToOne: false
            referencedRelation: "price_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          best_bundle_size: number | null
          best_price_excl_vat: number | null
          best_price_incl_vat: number | null
          brand: string | null
          brand_id: string | null
          brand_name: string | null
          brand_qid: string | null
          category: string | null
          category_id: string | null
          category_name: string | null
          category_qid: string | null
          cnk_code: string | null
          created_at: string
          delay_days: number | null
          depth: number | null
          description: string | null
          description_de: string | null
          description_fr: string | null
          description_nl: string | null
          dimension_unit: string | null
          dimensions: Json | null
          discount_percentage: number | null
          estimated_delivery_weeks: number | null
          gtin: string | null
          height: number | null
          id: string
          image_url: string | null
          image_urls: string[] | null
          is_active: boolean
          is_in_stock: boolean
          is_preorder: boolean | null
          is_promotion: boolean
          is_published: boolean
          label: string | null
          last_detail_sync: string | null
          last_offers_sync: string | null
          manufacturer_id: string | null
          min_delivery_days: number | null
          name: string
          name_de: string | null
          name_fr: string | null
          name_nl: string | null
          offer_count: number
          origin_country: string | null
          popularity: number | null
          promotion_end_date: string | null
          promotion_label: string | null
          promotion_start_date: string | null
          qogita_fid: string | null
          qogita_qid: string | null
          qogita_slug: string | null
          reference_price: number | null
          seller_count: number | null
          shipping_from: string[] | null
          short_description: string | null
          sku: string | null
          slug: string
          source: Database["public"]["Enums"]["product_source"]
          synced_at: string | null
          total_stock: number
          unit: string | null
          unit_quantity: number
          updated_at: string
          vat_rate_be: number | null
          weight: number | null
          weight_unit: string | null
          width: number | null
        }
        Insert: {
          best_bundle_size?: number | null
          best_price_excl_vat?: number | null
          best_price_incl_vat?: number | null
          brand?: string | null
          brand_id?: string | null
          brand_name?: string | null
          brand_qid?: string | null
          category?: string | null
          category_id?: string | null
          category_name?: string | null
          category_qid?: string | null
          cnk_code?: string | null
          created_at?: string
          delay_days?: number | null
          depth?: number | null
          description?: string | null
          description_de?: string | null
          description_fr?: string | null
          description_nl?: string | null
          dimension_unit?: string | null
          dimensions?: Json | null
          discount_percentage?: number | null
          estimated_delivery_weeks?: number | null
          gtin?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_active?: boolean
          is_in_stock?: boolean
          is_preorder?: boolean | null
          is_promotion?: boolean
          is_published?: boolean
          label?: string | null
          last_detail_sync?: string | null
          last_offers_sync?: string | null
          manufacturer_id?: string | null
          min_delivery_days?: number | null
          name: string
          name_de?: string | null
          name_fr?: string | null
          name_nl?: string | null
          offer_count?: number
          origin_country?: string | null
          popularity?: number | null
          promotion_end_date?: string | null
          promotion_label?: string | null
          promotion_start_date?: string | null
          qogita_fid?: string | null
          qogita_qid?: string | null
          qogita_slug?: string | null
          reference_price?: number | null
          seller_count?: number | null
          shipping_from?: string[] | null
          short_description?: string | null
          sku?: string | null
          slug: string
          source?: Database["public"]["Enums"]["product_source"]
          synced_at?: string | null
          total_stock?: number
          unit?: string | null
          unit_quantity?: number
          updated_at?: string
          vat_rate_be?: number | null
          weight?: number | null
          weight_unit?: string | null
          width?: number | null
        }
        Update: {
          best_bundle_size?: number | null
          best_price_excl_vat?: number | null
          best_price_incl_vat?: number | null
          brand?: string | null
          brand_id?: string | null
          brand_name?: string | null
          brand_qid?: string | null
          category?: string | null
          category_id?: string | null
          category_name?: string | null
          category_qid?: string | null
          cnk_code?: string | null
          created_at?: string
          delay_days?: number | null
          depth?: number | null
          description?: string | null
          description_de?: string | null
          description_fr?: string | null
          description_nl?: string | null
          dimension_unit?: string | null
          dimensions?: Json | null
          discount_percentage?: number | null
          estimated_delivery_weeks?: number | null
          gtin?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_active?: boolean
          is_in_stock?: boolean
          is_preorder?: boolean | null
          is_promotion?: boolean
          is_published?: boolean
          label?: string | null
          last_detail_sync?: string | null
          last_offers_sync?: string | null
          manufacturer_id?: string | null
          min_delivery_days?: number | null
          name?: string
          name_de?: string | null
          name_fr?: string | null
          name_nl?: string | null
          offer_count?: number
          origin_country?: string | null
          popularity?: number | null
          promotion_end_date?: string | null
          promotion_label?: string | null
          promotion_start_date?: string | null
          qogita_fid?: string | null
          qogita_qid?: string | null
          qogita_slug?: string | null
          reference_price?: number | null
          seller_count?: number | null
          shipping_from?: string[] | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          source?: Database["public"]["Enums"]["product_source"]
          synced_at?: string | null
          total_stock?: number
          unit?: string | null
          unit_quantity?: number
          updated_at?: string
          vat_rate_be?: number | null
          weight?: number | null
          weight_unit?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      profession_types: {
        Row: {
          created_at: string
          default_category_ids: string[] | null
          description: string | null
          icon: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          default_category_ids?: string[] | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          default_category_ids?: string[] | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      profile_visibility: {
        Row: {
          created_at: string | null
          feature_key: string
          id: string
          is_visible: boolean | null
          label: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          feature_key: string
          id?: string
          is_visible?: boolean | null
          label?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string | null
          feature_key?: string
          id?: string
          is_visible?: boolean | null
          label?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_visibility_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          category_preferences: Json | null
          company_name: string | null
          country: string | null
          created_at: string
          filter_mode: string
          full_name: string | null
          id: string
          legal_faq_acknowledged_at: string | null
          phone: string | null
          preferred_language: string | null
          price_level_code: string | null
          profession_type_id: string | null
          sector: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          category_preferences?: Json | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          filter_mode?: string
          full_name?: string | null
          id?: string
          legal_faq_acknowledged_at?: string | null
          phone?: string | null
          preferred_language?: string | null
          price_level_code?: string | null
          profession_type_id?: string | null
          sector?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          category_preferences?: Json | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          filter_mode?: string
          full_name?: string | null
          id?: string
          legal_faq_acknowledged_at?: string | null
          phone?: string | null
          preferred_language?: string | null
          price_level_code?: string | null
          profession_type_id?: string | null
          sector?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_profession_type_id_fkey"
            columns: ["profession_type_id"]
            isOneToOne: false
            referencedRelation: "profession_types"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_campaigns: {
        Row: {
          banner_image_url: string | null
          created_at: string
          description: string | null
          ends_at: string
          id: string
          is_active: boolean
          name: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          banner_image_url?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          is_active?: boolean
          name: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          banner_image_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          name?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      qogita_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      qogita_rate_limit: {
        Row: {
          available_tokens: number
          capacity: number
          key: string
          last_refill_at: string
          refill_per_minute: number
          updated_at: string
        }
        Insert: {
          available_tokens?: number
          capacity?: number
          key: string
          last_refill_at?: string
          refill_per_minute?: number
          updated_at?: string
        }
        Update: {
          available_tokens?: number
          capacity?: number
          key?: string
          last_refill_at?: string
          refill_per_minute?: number
          updated_at?: string
        }
        Relationships: []
      }
      qogita_resync_logs: {
        Row: {
          completed_at: string | null
          country_code: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          errors_by_endpoint: Json
          id: string
          metadata: Json
          mode: Database["public"]["Enums"]["qogita_resync_mode"]
          mute_products_detected: number
          offers_created: number
          offers_deactivated: number
          offers_processed: number
          offers_updated: number
          products_processed: number
          products_targeted: number
          started_at: string
          status: Database["public"]["Enums"]["qogita_resync_status"]
          tiers_synced: number
          total_errors: number
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          country_code?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          errors_by_endpoint?: Json
          id?: string
          metadata?: Json
          mode: Database["public"]["Enums"]["qogita_resync_mode"]
          mute_products_detected?: number
          offers_created?: number
          offers_deactivated?: number
          offers_processed?: number
          offers_updated?: number
          products_processed?: number
          products_targeted?: number
          started_at?: string
          status?: Database["public"]["Enums"]["qogita_resync_status"]
          tiers_synced?: number
          total_errors?: number
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          country_code?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          errors_by_endpoint?: Json
          id?: string
          metadata?: Json
          mode?: Database["public"]["Enums"]["qogita_resync_mode"]
          mute_products_detected?: number
          offers_created?: number
          offers_deactivated?: number
          offers_processed?: number
          offers_updated?: number
          products_processed?: number
          products_targeted?: number
          started_at?: string
          status?: Database["public"]["Enums"]["qogita_resync_status"]
          tiers_synced?: number
          total_errors?: number
          triggered_by?: string | null
        }
        Relationships: []
      }
      recent_activity: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          metadata: Json | null
          product_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          product_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          product_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recent_activity_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_buyers: {
        Row: {
          access_token: string | null
          apn_number: string | null
          auth_user_id: string | null
          city: string | null
          created_at: string
          email: string
          flake_count: number
          id: string
          interests: string[] | null
          is_suspended: boolean
          legal_faq_acknowledged_at: string | null
          legal_faq_version_acknowledged: string | null
          pharmacy_name: string
          phone: string | null
          reception_mode: string
          referral_code: string | null
          suspended_until: string | null
          updated_at: string
          verified_at: string | null
          verified_status: string
        }
        Insert: {
          access_token?: string | null
          apn_number?: string | null
          auth_user_id?: string | null
          city?: string | null
          created_at?: string
          email: string
          flake_count?: number
          id?: string
          interests?: string[] | null
          is_suspended?: boolean
          legal_faq_acknowledged_at?: string | null
          legal_faq_version_acknowledged?: string | null
          pharmacy_name: string
          phone?: string | null
          reception_mode?: string
          referral_code?: string | null
          suspended_until?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_status?: string
        }
        Update: {
          access_token?: string | null
          apn_number?: string | null
          auth_user_id?: string | null
          city?: string | null
          created_at?: string
          email?: string
          flake_count?: number
          id?: string
          interests?: string[] | null
          is_suspended?: boolean
          legal_faq_acknowledged_at?: string | null
          legal_faq_version_acknowledged?: string | null
          pharmacy_name?: string
          phone?: string | null
          reception_mode?: string
          referral_code?: string | null
          suspended_until?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_status?: string
        }
        Relationships: []
      }
      restock_campaigns: {
        Row: {
          admin_id: string
          buyer_ids: string[] | null
          created_at: string
          id: string
          offer_ids: string[] | null
          open_count: number | null
          sent_at: string | null
          subject: string
          take_count: number | null
        }
        Insert: {
          admin_id: string
          buyer_ids?: string[] | null
          created_at?: string
          id?: string
          offer_ids?: string[] | null
          open_count?: number | null
          sent_at?: string | null
          subject: string
          take_count?: number | null
        }
        Update: {
          admin_id?: string
          buyer_ids?: string[] | null
          created_at?: string
          id?: string
          offer_ids?: string[] | null
          open_count?: number | null
          sent_at?: string | null
          subject?: string
          take_count?: number | null
        }
        Relationships: []
      }
      restock_counter_offers: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          offer_id: string
          proposed_price: number
          proposed_quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          offer_id: string
          proposed_price: number
          proposed_quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          offer_id?: string
          proposed_price?: number
          proposed_quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restock_counter_offers_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "restock_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_counter_offers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "restock_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_counter_offers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "restock_offers_with_delta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_counter_offers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "restock_public_offers_view"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_drops: {
        Row: {
          created_at: string | null
          ends_at: string
          hero_image_url: string | null
          id: string
          name: string
          offer_ids: string[] | null
          starts_at: string
          status: string
          theme: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          ends_at: string
          hero_image_url?: string | null
          id?: string
          name: string
          offer_ids?: string[] | null
          starts_at: string
          status?: string
          theme?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          ends_at?: string
          hero_image_url?: string | null
          id?: string
          name?: string
          offer_ids?: string[] | null
          starts_at?: string
          status?: string
          theme?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      restock_invoice_sequences: {
        Row: {
          current_value: number
          id: string
          prefix: string
          updated_at: string
        }
        Insert: {
          current_value?: number
          id?: string
          prefix: string
          updated_at?: string
        }
        Update: {
          current_value?: number
          id?: string
          prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      restock_invoices: {
        Row: {
          amount_ht: number
          amount_ttc: number
          commission_amount: number
          created_at: string
          id: string
          invoice_number: string
          invoice_type: string
          issued_at: string
          pdf_url: string | null
          transaction_id: string
          vat_amount: number
        }
        Insert: {
          amount_ht: number
          amount_ttc: number
          commission_amount?: number
          created_at?: string
          id?: string
          invoice_number: string
          invoice_type: string
          issued_at?: string
          pdf_url?: string | null
          transaction_id: string
          vat_amount: number
        }
        Update: {
          amount_ht?: number
          amount_ttc?: number
          commission_amount?: number
          created_at?: string
          id?: string
          invoice_number?: string
          invoice_type?: string
          issued_at?: string
          pdf_url?: string | null
          transaction_id?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "restock_invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "restock_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_offers: {
        Row: {
          allow_partial: boolean
          boxes_per_pallet: number | null
          cnk: string | null
          created_at: string
          delivery_condition: string
          designation: string
          dlu: string | null
          drop_id: string | null
          ean: string | null
          expires_at: string | null
          grade: string
          id: string
          lot_number: string | null
          lot_size: number
          matched_product_id: string | null
          moq: number
          packaging_photos: string[] | null
          packs_per_box: number | null
          photo_url: string | null
          pieces_per_pack: number | null
          price_ht: number
          price_ttc: number | null
          product_image_url: string | null
          product_state: string
          publish_end: string | null
          publish_start: string | null
          quantity: number
          rejection_reason: string | null
          seller_city: string | null
          seller_id: string
          status: string
          unit_weight_g: number | null
          updated_at: string
          vat_rate: number
          views_count: number
        }
        Insert: {
          allow_partial?: boolean
          boxes_per_pallet?: number | null
          cnk?: string | null
          created_at?: string
          delivery_condition?: string
          designation: string
          dlu?: string | null
          drop_id?: string | null
          ean?: string | null
          expires_at?: string | null
          grade?: string
          id?: string
          lot_number?: string | null
          lot_size?: number
          matched_product_id?: string | null
          moq?: number
          packaging_photos?: string[] | null
          packs_per_box?: number | null
          photo_url?: string | null
          pieces_per_pack?: number | null
          price_ht: number
          price_ttc?: number | null
          product_image_url?: string | null
          product_state?: string
          publish_end?: string | null
          publish_start?: string | null
          quantity?: number
          rejection_reason?: string | null
          seller_city?: string | null
          seller_id: string
          status?: string
          unit_weight_g?: number | null
          updated_at?: string
          vat_rate?: number
          views_count?: number
        }
        Update: {
          allow_partial?: boolean
          boxes_per_pallet?: number | null
          cnk?: string | null
          created_at?: string
          delivery_condition?: string
          designation?: string
          dlu?: string | null
          drop_id?: string | null
          ean?: string | null
          expires_at?: string | null
          grade?: string
          id?: string
          lot_number?: string | null
          lot_size?: number
          matched_product_id?: string | null
          moq?: number
          packaging_photos?: string[] | null
          packs_per_box?: number | null
          photo_url?: string | null
          pieces_per_pack?: number | null
          price_ht?: number
          price_ttc?: number | null
          product_image_url?: string | null
          product_state?: string
          publish_end?: string | null
          publish_start?: string | null
          quantity?: number
          rejection_reason?: string | null
          seller_city?: string | null
          seller_id?: string
          status?: string
          unit_weight_g?: number | null
          updated_at?: string
          vat_rate?: number
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "restock_offers_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "restock_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_offers_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          asked_at: string | null
          buyer_id: string | null
          id: string
          offer_id: string
          question: string
          seller_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          asked_at?: string | null
          buyer_id?: string | null
          id?: string
          offer_id: string
          question: string
          seller_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          asked_at?: string | null
          buyer_id?: string | null
          id?: string
          offer_id?: string
          question?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restock_questions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "restock_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_questions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "restock_offers_with_delta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_questions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "restock_public_offers_view"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          ratee_id: string
          rater_id: string
          rater_role: string
          stars: number
          transaction_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          ratee_id: string
          rater_id: string
          rater_role: string
          stars: number
          transaction_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          ratee_id?: string
          rater_id?: string
          rater_role?: string
          stars?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restock_ratings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "restock_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          max_uses: number | null
          owner_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          owner_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          owner_id?: string
          uses_count?: number
        }
        Relationships: []
      }
      restock_referrals: {
        Row: {
          created_at: string
          id: string
          referral_code_id: string
          referred_user_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code_id: string
          referred_user_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code_id?: string
          referred_user_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "restock_referrals_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "restock_referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_rewards: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_claimed: boolean
          referral_id: string | null
          reward_type: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_claimed?: boolean
          referral_id?: string | null
          reward_type: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_claimed?: boolean
          referral_id?: string | null
          reward_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restock_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "restock_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          label: string | null
          rule_type: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          rule_type: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          rule_type?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      restock_sendcloud_api_logs: {
        Row: {
          called_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          operation: string
          status_code: number | null
          user_id: string | null
        }
        Insert: {
          called_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          operation: string
          status_code?: number | null
          user_id?: string | null
        }
        Update: {
          called_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          operation?: string
          status_code?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      restock_sendcloud_invoice_lines: {
        Row: {
          id: string
          line_cost_cents: number | null
          matched: boolean | null
          notes: string | null
          sendcloud_invoice_id: string | null
          sendcloud_parcel_id: string | null
          shipment_id: string | null
          vat_rate: number | null
        }
        Insert: {
          id?: string
          line_cost_cents?: number | null
          matched?: boolean | null
          notes?: string | null
          sendcloud_invoice_id?: string | null
          sendcloud_parcel_id?: string | null
          shipment_id?: string | null
          vat_rate?: number | null
        }
        Update: {
          id?: string
          line_cost_cents?: number | null
          matched?: boolean | null
          notes?: string | null
          sendcloud_invoice_id?: string | null
          sendcloud_parcel_id?: string | null
          shipment_id?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_sendcloud_invoice_lines_sendcloud_invoice_id_fkey"
            columns: ["sendcloud_invoice_id"]
            isOneToOne: false
            referencedRelation: "restock_sendcloud_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_sendcloud_invoice_lines_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "restock_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_sendcloud_invoices: {
        Row: {
          created_at: string | null
          id: string
          invoice_number: string | null
          pdf_url: string | null
          period_end: string | null
          period_start: string | null
          reconciled: boolean | null
          reconciled_at: string | null
          reconciled_by: string | null
          total_cents: number | null
          total_ttc_cents: number | null
          total_vat_cents: number | null
          unmatched_cents: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          total_cents?: number | null
          total_ttc_cents?: number | null
          total_vat_cents?: number | null
          unmatched_cents?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          total_cents?: number | null
          total_ttc_cents?: number | null
          total_vat_cents?: number | null
          unmatched_cents?: number | null
        }
        Relationships: []
      }
      restock_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          label: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          label?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          label?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      restock_shipment_events: {
        Row: {
          event_message: string | null
          event_timestamp: string | null
          event_type: string | null
          id: string
          processed_at: string | null
          raw_payload: Json | null
          sendcloud_event_id: string | null
          sendcloud_parcel_id: string | null
          shipment_id: string | null
        }
        Insert: {
          event_message?: string | null
          event_timestamp?: string | null
          event_type?: string | null
          id?: string
          processed_at?: string | null
          raw_payload?: Json | null
          sendcloud_event_id?: string | null
          sendcloud_parcel_id?: string | null
          shipment_id?: string | null
        }
        Update: {
          event_message?: string | null
          event_timestamp?: string | null
          event_type?: string | null
          id?: string
          processed_at?: string | null
          raw_payload?: Json | null
          sendcloud_event_id?: string | null
          sendcloud_parcel_id?: string | null
          shipment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_shipment_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "restock_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_shipment_incidents: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          incident_type: string | null
          indemnity_cents: number | null
          indemnity_paid_to: string | null
          photos: string[] | null
          reported_by: string | null
          resolved_at: string | null
          sendcloud_claim_id: string | null
          shipment_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          incident_type?: string | null
          indemnity_cents?: number | null
          indemnity_paid_to?: string | null
          photos?: string[] | null
          reported_by?: string | null
          resolved_at?: string | null
          sendcloud_claim_id?: string | null
          shipment_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          incident_type?: string | null
          indemnity_cents?: number | null
          indemnity_paid_to?: string | null
          photos?: string[] | null
          reported_by?: string | null
          resolved_at?: string | null
          sendcloud_claim_id?: string | null
          shipment_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_shipment_incidents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "restock_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_shipments: {
        Row: {
          buyer_id: string
          buyer_shipping_fee_cents: number | null
          carrier: string | null
          created_at: string | null
          declared_value_cents: number | null
          exception_reason: string | null
          id: string
          medikong_margin_cents: number | null
          medikong_margin_pct: number | null
          seller_charge_cents: number | null
          seller_id: string
          sendcloud_cost_cents: number | null
          sendcloud_label_url: string | null
          sendcloud_parcel_id: string | null
          sendcloud_tracking_number: string | null
          sendcloud_tracking_url: string | null
          status: string | null
          status_updated_at: string | null
          transaction_id: string
          weight_g: number | null
        }
        Insert: {
          buyer_id: string
          buyer_shipping_fee_cents?: number | null
          carrier?: string | null
          created_at?: string | null
          declared_value_cents?: number | null
          exception_reason?: string | null
          id?: string
          medikong_margin_cents?: number | null
          medikong_margin_pct?: number | null
          seller_charge_cents?: number | null
          seller_id: string
          sendcloud_cost_cents?: number | null
          sendcloud_label_url?: string | null
          sendcloud_parcel_id?: string | null
          sendcloud_tracking_number?: string | null
          sendcloud_tracking_url?: string | null
          status?: string | null
          status_updated_at?: string | null
          transaction_id: string
          weight_g?: number | null
        }
        Update: {
          buyer_id?: string
          buyer_shipping_fee_cents?: number | null
          carrier?: string | null
          created_at?: string | null
          declared_value_cents?: number | null
          exception_reason?: string | null
          id?: string
          medikong_margin_cents?: number | null
          medikong_margin_pct?: number | null
          seller_charge_cents?: number | null
          seller_id?: string
          sendcloud_cost_cents?: number | null
          sendcloud_label_url?: string | null
          sendcloud_parcel_id?: string | null
          sendcloud_tracking_number?: string | null
          sendcloud_tracking_url?: string | null
          status?: string | null
          status_updated_at?: string | null
          transaction_id?: string
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_shipments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "restock_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_transactions: {
        Row: {
          billing_same_as_shipping: boolean | null
          buyer_city: string | null
          buyer_company: string | null
          buyer_country: string | null
          buyer_email: string | null
          buyer_id: string
          buyer_name: string | null
          buyer_phone: string | null
          buyer_postal_code: string | null
          buyer_street: string | null
          buyer_vat_number: string | null
          commission_amount: number | null
          commission_rate: number | null
          created_at: string
          delivered_at: string | null
          delivery_mode: string
          delivery_notes: string | null
          dispute_reason: string | null
          escrow_released_at: string | null
          final_price: number
          id: string
          invoice_buyer_id: string | null
          invoice_seller_id: string | null
          offer_id: string
          paid_at: string | null
          penalty_applied: boolean
          quantity: number
          seller_id: string
          seller_pickup_address: string | null
          seller_pickup_city: string | null
          seller_pickup_instructions: string | null
          seller_pickup_phone: string | null
          sendcloud_parcel_id: string | null
          shipping_cost: number | null
          status: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          billing_same_as_shipping?: boolean | null
          buyer_city?: string | null
          buyer_company?: string | null
          buyer_country?: string | null
          buyer_email?: string | null
          buyer_id: string
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_postal_code?: string | null
          buyer_street?: string | null
          buyer_vat_number?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          delivered_at?: string | null
          delivery_mode?: string
          delivery_notes?: string | null
          dispute_reason?: string | null
          escrow_released_at?: string | null
          final_price: number
          id?: string
          invoice_buyer_id?: string | null
          invoice_seller_id?: string | null
          offer_id: string
          paid_at?: string | null
          penalty_applied?: boolean
          quantity: number
          seller_id: string
          seller_pickup_address?: string | null
          seller_pickup_city?: string | null
          seller_pickup_instructions?: string | null
          seller_pickup_phone?: string | null
          sendcloud_parcel_id?: string | null
          shipping_cost?: number | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          billing_same_as_shipping?: boolean | null
          buyer_city?: string | null
          buyer_company?: string | null
          buyer_country?: string | null
          buyer_email?: string | null
          buyer_id?: string
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_postal_code?: string | null
          buyer_street?: string | null
          buyer_vat_number?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          delivered_at?: string | null
          delivery_mode?: string
          delivery_notes?: string | null
          dispute_reason?: string | null
          escrow_released_at?: string | null
          final_price?: number
          id?: string
          invoice_buyer_id?: string | null
          invoice_seller_id?: string | null
          offer_id?: string
          paid_at?: string | null
          penalty_applied?: boolean
          quantity?: number
          seller_id?: string
          seller_pickup_address?: string | null
          seller_pickup_city?: string | null
          seller_pickup_instructions?: string | null
          seller_pickup_phone?: string | null
          sendcloud_parcel_id?: string | null
          shipping_cost?: number | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restock_transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "restock_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_transactions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "restock_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_transactions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "restock_offers_with_delta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_transactions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "restock_public_offers_view"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_contracts: {
        Row: {
          contract_type: string
          contract_version: string
          created_at: string
          document_hash: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          pdf_storage_path: string | null
          pdf_url: string | null
          signature_data: string
          signature_method: string
          signed_at: string
          signer_name: string
          signer_role: string | null
          user_agent: string | null
          vendor_id: string
        }
        Insert: {
          contract_type?: string
          contract_version?: string
          created_at?: string
          document_hash?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          pdf_storage_path?: string | null
          pdf_url?: string | null
          signature_data: string
          signature_method: string
          signed_at?: string
          signer_name: string
          signer_role?: string | null
          user_agent?: string | null
          vendor_id: string
        }
        Update: {
          contract_type?: string
          contract_version?: string
          created_at?: string
          document_hash?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          pdf_storage_path?: string | null
          pdf_url?: string | null
          signature_data?: string
          signature_method?: string
          signed_at?: string
          signer_name?: string
          signer_role?: string | null
          user_agent?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_events: {
        Row: {
          created_at: string
          event_message: string
          event_timestamp: string
          event_type: string
          id: string
          raw_payload: Json | null
          sendcloud_event_id: string | null
          shipment_id: string
        }
        Insert: {
          created_at?: string
          event_message?: string
          event_timestamp?: string
          event_type: string
          id?: string
          raw_payload?: Json | null
          sendcloud_event_id?: string | null
          shipment_id: string
        }
        Update: {
          created_at?: string
          event_message?: string
          event_timestamp?: string
          event_type?: string
          id?: string
          raw_payload?: Json | null
          sendcloud_event_id?: string | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          cost_base_cents: number | null
          cost_margin_cents: number | null
          cost_total_cents: number | null
          created_at: string
          dimensions_cm: Json | null
          id: string
          label_url: string | null
          order_reference: string
          parcel_id: number | null
          recipient_address: Json
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          shipping_mode_used: Database["public"]["Enums"]["vendor_shipping_mode"]
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          vendor_id: string
          weight_grams: number | null
        }
        Insert: {
          carrier?: string | null
          cost_base_cents?: number | null
          cost_margin_cents?: number | null
          cost_total_cents?: number | null
          created_at?: string
          dimensions_cm?: Json | null
          id?: string
          label_url?: string | null
          order_reference: string
          parcel_id?: number | null
          recipient_address?: Json
          recipient_email?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          shipping_mode_used: Database["public"]["Enums"]["vendor_shipping_mode"]
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vendor_id: string
          weight_grams?: number | null
        }
        Update: {
          carrier?: string | null
          cost_base_cents?: number | null
          cost_margin_cents?: number | null
          cost_total_cents?: number | null
          created_at?: string
          dimensions_cm?: Json | null
          id?: string
          label_url?: string | null
          order_reference?: string
          parcel_id?: number | null
          recipient_address?: Json
          recipient_email?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          shipping_mode_used?: Database["public"]["Enums"]["vendor_shipping_mode"]
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vendor_id?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_invoices: {
        Row: {
          created_at: string
          id: string
          pdf_url: string | null
          period_end: string
          period_start: string
          sent_at: string | null
          shipment_count: number
          status: Database["public"]["Enums"]["shipping_invoice_status"]
          total_base_cents: number
          total_invoiced_cents: number
          total_margin_cents: number
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pdf_url?: string | null
          period_end: string
          period_start: string
          sent_at?: string | null
          shipment_count?: number
          status?: Database["public"]["Enums"]["shipping_invoice_status"]
          total_base_cents?: number
          total_invoiced_cents?: number
          total_margin_cents?: number
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          sent_at?: string | null
          shipment_count?: number
          status?: Database["public"]["Enums"]["shipping_invoice_status"]
          total_base_cents?: number
          total_invoiced_cents?: number
          total_margin_cents?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_options: {
        Row: {
          country_code: string
          created_at: string
          currency: string
          delivery_max_days: number
          delivery_min_days: number
          description: string | null
          id: string
          is_active: boolean
          is_free: boolean
          name: string
          name_de: string | null
          name_fr: string | null
          name_nl: string | null
          price_adjustment: number
          sendcloud_carrier: string | null
          sendcloud_method_id: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          currency?: string
          delivery_max_days?: number
          delivery_min_days?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          name: string
          name_de?: string | null
          name_fr?: string | null
          name_nl?: string | null
          price_adjustment?: number
          sendcloud_carrier?: string | null
          sendcloud_method_id?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          currency?: string
          delivery_max_days?: number
          delivery_min_days?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          name?: string
          name_de?: string | null
          name_fr?: string | null
          name_nl?: string | null
          price_adjustment?: number
          sendcloud_carrier?: string | null
          sendcloud_method_id?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_config: {
        Row: {
          country: string
          currency: string
          default_vat_rate: number
          display_prices_incl_vat: boolean
          id: number
          investment_banner_enabled: boolean
          investment_banner_text: string | null
          reduced_vat_rate: number
          site_name: string
          tagline: string
        }
        Insert: {
          country?: string
          currency?: string
          default_vat_rate?: number
          display_prices_incl_vat?: boolean
          id?: number
          investment_banner_enabled?: boolean
          investment_banner_text?: string | null
          reduced_vat_rate?: number
          site_name?: string
          tagline?: string
        }
        Update: {
          country?: string
          currency?: string
          default_vat_rate?: number
          display_prices_incl_vat?: boolean
          id?: number
          investment_banner_enabled?: boolean
          investment_banner_text?: string | null
          reduced_vat_rate?: number
          site_name?: string
          tagline?: string
        }
        Relationships: []
      }
      source_profile_config: {
        Row: {
          created_at: string | null
          display_label: string | null
          display_mode: string
          id: string
          profile_id: string
          source_id: string
        }
        Insert: {
          created_at?: string | null
          display_label?: string | null
          display_mode?: string
          id?: string
          profile_id: string
          source_id: string
        }
        Update: {
          created_at?: string | null
          display_label?: string | null
          display_mode?: string
          id?: string
          profile_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_profile_config_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_profile_config_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "market_price_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sourcing_requests: {
        Row: {
          admin_notes: string | null
          budget_max: number | null
          cnk_code: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          customer_id: string | null
          gtin: string | null
          id: string
          product_description: string
          quantity_needed: number | null
          quoted_price: number | null
          request_number: string
          status: Database["public"]["Enums"]["sourcing_status"]
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_enum"]
        }
        Insert: {
          admin_notes?: string | null
          budget_max?: number | null
          cnk_code?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          customer_id?: string | null
          gtin?: string | null
          id?: string
          product_description: string
          quantity_needed?: number | null
          quoted_price?: number | null
          request_number: string
          status?: Database["public"]["Enums"]["sourcing_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_enum"]
        }
        Update: {
          admin_notes?: string | null
          budget_max?: number | null
          cnk_code?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          customer_id?: string | null
          gtin?: string | null
          id?: string
          product_description?: string
          quantity_needed?: number | null
          quoted_price?: number | null
          request_number?: string
          status?: Database["public"]["Enums"]["sourcing_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_orders: {
        Row: {
          cost_total: number | null
          created_at: string
          estimated_delivery_date: string | null
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          margin_total: number | null
          order_id: string
          qogita_cart_qid: string | null
          qogita_checkout_qid: string | null
          qogita_order_qid: string | null
          qogita_order_status: string | null
          qogita_shipping_address: Json | null
          qogita_shipping_mode:
            | Database["public"]["Enums"]["shipping_mode_enum"]
            | null
          reshipment_status:
            | Database["public"]["Enums"]["reshipment_status_enum"]
            | null
          reshipment_tracking_number: string | null
          reshipment_tracking_url: string | null
          status: Database["public"]["Enums"]["fulfillment_status"]
          subtotal_incl_vat: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          cost_total?: number | null
          created_at?: string
          estimated_delivery_date?: string | null
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          margin_total?: number | null
          order_id: string
          qogita_cart_qid?: string | null
          qogita_checkout_qid?: string | null
          qogita_order_qid?: string | null
          qogita_order_status?: string | null
          qogita_shipping_address?: Json | null
          qogita_shipping_mode?:
            | Database["public"]["Enums"]["shipping_mode_enum"]
            | null
          reshipment_status?:
            | Database["public"]["Enums"]["reshipment_status_enum"]
            | null
          reshipment_tracking_number?: string | null
          reshipment_tracking_url?: string | null
          status?: Database["public"]["Enums"]["fulfillment_status"]
          subtotal_incl_vat?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          cost_total?: number | null
          created_at?: string
          estimated_delivery_date?: string | null
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          margin_total?: number | null
          order_id?: string
          qogita_cart_qid?: string | null
          qogita_checkout_qid?: string | null
          qogita_order_qid?: string | null
          qogita_order_status?: string | null
          qogita_shipping_address?: Json | null
          qogita_shipping_mode?:
            | Database["public"]["Enums"]["shipping_mode_enum"]
            | null
          reshipment_status?:
            | Database["public"]["Enums"]["reshipment_status_enum"]
            | null
          reshipment_tracking_number?: string | null
          reshipment_tracking_url?: string | null
          status?: Database["public"]["Enums"]["fulfillment_status"]
          subtotal_incl_vat?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          chunk_state: Json | null
          completed_at: string | null
          error_message: string | null
          id: string
          progress_current: number
          progress_message: string | null
          progress_total: number
          started_at: string
          stats: Json | null
          status: Database["public"]["Enums"]["sync_log_status"]
          sync_type: Database["public"]["Enums"]["sync_type_enum"]
        }
        Insert: {
          chunk_state?: Json | null
          completed_at?: string | null
          error_message?: string | null
          id?: string
          progress_current?: number
          progress_message?: string | null
          progress_total?: number
          started_at?: string
          stats?: Json | null
          status?: Database["public"]["Enums"]["sync_log_status"]
          sync_type: Database["public"]["Enums"]["sync_type_enum"]
        }
        Update: {
          chunk_state?: Json | null
          completed_at?: string | null
          error_message?: string | null
          id?: string
          progress_current?: number
          progress_message?: string | null
          progress_total?: number
          started_at?: string
          stats?: Json | null
          status?: Database["public"]["Enums"]["sync_log_status"]
          sync_type?: Database["public"]["Enums"]["sync_type_enum"]
        }
        Relationships: []
      }
      sync_pipeline_runs: {
        Row: {
          completed_at: string | null
          country_code: string
          created_at: string | null
          current_step: number | null
          error_message: string | null
          id: string
          started_at: string | null
          status: string
          steps_status: Json | null
          total_steps: number | null
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          country_code?: string
          created_at?: string | null
          current_step?: number | null
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          steps_status?: Json | null
          total_steps?: number | null
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          country_code?: string
          created_at?: string | null
          current_step?: number | null
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          steps_status?: Json | null
          total_steps?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      translations: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          field: string
          id: string
          locale: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          field: string
          id?: string
          locale: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          field?: string
          id?: string
          locale?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      user_price_watches: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string
          updated_at: string
          user_id: string
          user_price_excl_vat: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          updated_at?: string
          user_id: string
          user_price_excl_vat: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          updated_at?: string
          user_id?: string
          user_price_excl_vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_price_watches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_prices: {
        Row: {
          created_at: string | null
          id: string
          my_purchase_price: number
          notes: string | null
          product_id: string
          supplier_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          my_purchase_price: number
          notes?: string | null
          product_id: string
          supplier_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          my_purchase_price?: number
          notes?: string | null
          product_id?: string
          supplier_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profile_assignments: {
        Row: {
          assigned_at: string | null
          profile_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          profile_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      vendor_addresses: {
        Row: {
          address_line1: string
          city: string
          country: string
          created_at: string
          house_number: string | null
          id: string
          is_default: boolean
          label: string
          phone: string | null
          postal_code: string
          sendcloud_sender_address_id: number | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          address_line1: string
          city: string
          country?: string
          created_at?: string
          house_number?: string | null
          id?: string
          is_default?: boolean
          label?: string
          phone?: string | null
          postal_code: string
          sendcloud_sender_address_id?: number | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          address_line1?: string
          city?: string
          country?: string
          created_at?: string
          house_number?: string | null
          id?: string
          is_default?: boolean
          label?: string
          phone?: string | null
          postal_code?: string
          sendcloud_sender_address_id?: number | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_addresses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_addresses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_addresses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_commercial_settings: {
        Row: {
          created_at: string
          default_delivery_days: number | null
          default_mov: number | null
          default_mov_currency: string | null
          id: string
          is_dropshipping: boolean | null
          payment_terms_note: string | null
          return_policy: string | null
          shipping_from_country: string | null
          shipping_zones: string[] | null
          target_countries: string[]
          target_customer_types: string[]
          updated_at: string
          vendor_id: string
          warranty_info: string | null
        }
        Insert: {
          created_at?: string
          default_delivery_days?: number | null
          default_mov?: number | null
          default_mov_currency?: string | null
          id?: string
          is_dropshipping?: boolean | null
          payment_terms_note?: string | null
          return_policy?: string | null
          shipping_from_country?: string | null
          shipping_zones?: string[] | null
          target_countries?: string[]
          target_customer_types?: string[]
          updated_at?: string
          vendor_id: string
          warranty_info?: string | null
        }
        Update: {
          created_at?: string
          default_delivery_days?: number | null
          default_mov?: number | null
          default_mov_currency?: string | null
          id?: string
          is_dropshipping?: boolean | null
          payment_terms_note?: string | null
          return_policy?: string | null
          shipping_from_country?: string | null
          shipping_zones?: string[] | null
          target_countries?: string[]
          target_customer_types?: string[]
          updated_at?: string
          vendor_id?: string
          warranty_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_commercial_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_commercial_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_commercial_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_competitor_alerts: {
        Row: {
          competitor_price: number
          competitor_vendor_id: string | null
          country_code: string
          created_at: string
          current_rank: number
          gap_amount: number
          gap_percentage: number
          id: string
          my_offer_id: string | null
          my_price: number
          previous_rank: number | null
          product_id: string
          read_at: string | null
          resolved_at: string | null
          status: string
          suggested_price: number | null
          total_competitors: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          competitor_price: number
          competitor_vendor_id?: string | null
          country_code?: string
          created_at?: string
          current_rank: number
          gap_amount?: number
          gap_percentage?: number
          id?: string
          my_offer_id?: string | null
          my_price: number
          previous_rank?: number | null
          product_id: string
          read_at?: string | null
          resolved_at?: string | null
          status?: string
          suggested_price?: number | null
          total_competitors?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          competitor_price?: number
          competitor_vendor_id?: string | null
          country_code?: string
          created_at?: string
          current_rank?: number
          gap_amount?: number
          gap_percentage?: number
          id?: string
          my_offer_id?: string | null
          my_price?: number
          previous_rank?: number | null
          product_id?: string
          read_at?: string | null
          resolved_at?: string | null
          status?: string
          suggested_price?: number | null
          total_competitors?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_competitor_alerts_competitor_vendor_id_fkey"
            columns: ["competitor_vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_competitor_vendor_id_fkey"
            columns: ["competitor_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_competitor_vendor_id_fkey"
            columns: ["competitor_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_my_offer_id_fkey"
            columns: ["my_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_my_offer_id_fkey"
            columns: ["my_offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_delegates: {
        Row: {
          availability_message: string | null
          availability_status: Database["public"]["Enums"]["delegate_availability"]
          availability_until: string | null
          bio: string | null
          booking_url: string | null
          country_codes: string[]
          created_at: string
          display_order: number
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          job_title: string | null
          languages: string[]
          last_name: string
          phone: string | null
          photo_url: string | null
          postal_codes: string[]
          primary_target_profiles: string[]
          regions: string[]
          target_profiles: string[]
          updated_at: string
          vendor_id: string
        }
        Insert: {
          availability_message?: string | null
          availability_status?: Database["public"]["Enums"]["delegate_availability"]
          availability_until?: string | null
          bio?: string | null
          booking_url?: string | null
          country_codes?: string[]
          created_at?: string
          display_order?: number
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          languages?: string[]
          last_name: string
          phone?: string | null
          photo_url?: string | null
          postal_codes?: string[]
          primary_target_profiles?: string[]
          regions?: string[]
          target_profiles?: string[]
          updated_at?: string
          vendor_id: string
        }
        Update: {
          availability_message?: string | null
          availability_status?: Database["public"]["Enums"]["delegate_availability"]
          availability_until?: string | null
          bio?: string | null
          booking_url?: string | null
          country_codes?: string[]
          created_at?: string
          display_order?: number
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          languages?: string[]
          last_name?: string
          phone?: string | null
          photo_url?: string | null
          postal_codes?: string[]
          primary_target_profiles?: string[]
          regions?: string[]
          target_profiles?: string[]
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_delegates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_delegates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_delegates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invoices: {
        Row: {
          base_cost_cents: number
          created_at: string
          id: string
          invoice_number: string | null
          issued_at: string | null
          margin_cents: number
          period_end: string
          period_start: string
          status: string
          total_cents: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          base_cost_cents?: number
          created_at?: string
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          margin_cents?: number
          period_end: string
          period_start: string
          status?: string
          total_cents?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          base_cost_cents?: number
          created_at?: string
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          margin_cents?: number
          period_end?: string
          period_start?: string
          status?: string
          total_cents?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_kyc_criteria: {
        Row: {
          business_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_required: boolean
          label: string
          requires_document: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          label: string
          requires_document?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          label?: string
          requires_document?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      vendor_kyc_submissions: {
        Row: {
          admin_notes: string | null
          created_at: string
          criteria_id: string
          document_url: string | null
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          criteria_id: string
          document_url?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          criteria_id?: string
          document_url?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_kyc_submissions_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "vendor_kyc_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_kyc_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_kyc_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_kyc_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_notification_preferences: {
        Row: {
          auto_align_enabled: boolean
          created_at: string
          email_enabled: boolean
          email_frequency: Database["public"]["Enums"]["email_frequency"]
          floor_price_enabled: boolean
          min_severity: Database["public"]["Enums"]["alert_severity"]
          push_enabled: boolean
          updated_at: string
          vendor_id: string
        }
        Insert: {
          auto_align_enabled?: boolean
          created_at?: string
          email_enabled?: boolean
          email_frequency?: Database["public"]["Enums"]["email_frequency"]
          floor_price_enabled?: boolean
          min_severity?: Database["public"]["Enums"]["alert_severity"]
          push_enabled?: boolean
          updated_at?: string
          vendor_id: string
        }
        Update: {
          auto_align_enabled?: boolean
          created_at?: string
          email_enabled?: boolean
          email_frequency?: Database["public"]["Enums"]["email_frequency"]
          floor_price_enabled?: boolean
          min_severity?: Database["public"]["Enums"]["alert_severity"]
          push_enabled?: boolean
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_notification_preferences_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notification_preferences_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notification_preferences_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_notification_settings: {
        Row: {
          created_at: string
          id: string
          notify_invoice_ready: boolean
          notify_shipment_created: boolean
          notify_shipment_delivered: boolean
          notify_shipment_exception: boolean
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_invoice_ready?: boolean
          notify_shipment_created?: boolean
          notify_shipment_delivered?: boolean
          notify_shipment_exception?: boolean
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_invoice_ready?: boolean
          notify_shipment_created?: boolean
          notify_shipment_delivered?: boolean
          notify_shipment_exception?: boolean
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_notification_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notification_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notification_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_offer_history: {
        Row: {
          best_price: number | null
          country_code: string
          created_at: string
          id: string
          median_price: number | null
          my_price: number | null
          my_rank: number | null
          product_id: string
          snapshot_date: string
          total_offers: number | null
          vendor_id: string
        }
        Insert: {
          best_price?: number | null
          country_code?: string
          created_at?: string
          id?: string
          median_price?: number | null
          my_price?: number | null
          my_rank?: number | null
          product_id: string
          snapshot_date?: string
          total_offers?: number | null
          vendor_id: string
        }
        Update: {
          best_price?: number | null
          country_code?: string
          created_at?: string
          id?: string
          median_price?: number | null
          my_price?: number | null
          my_rank?: number | null
          product_id?: string
          snapshot_date?: string
          total_offers?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_offer_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_offer_history_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_offer_history_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_offer_history_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_price_alert_events: {
        Row: {
          best_price: number | null
          country_code: string
          created_at: string
          id: string
          median_price: number | null
          metric: string
          my_price: number
          observed_pct: number
          product_id: string
          read_at: string | null
          resolved_at: string | null
          rule_id: string | null
          status: string
          threshold_pct: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          best_price?: number | null
          country_code?: string
          created_at?: string
          id?: string
          median_price?: number | null
          metric: string
          my_price: number
          observed_pct: number
          product_id: string
          read_at?: string | null
          resolved_at?: string | null
          rule_id?: string | null
          status?: string
          threshold_pct: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          best_price?: number | null
          country_code?: string
          created_at?: string
          id?: string
          median_price?: number | null
          metric?: string
          my_price?: number
          observed_pct?: number
          product_id?: string
          read_at?: string | null
          resolved_at?: string | null
          rule_id?: string | null
          status?: string
          threshold_pct?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_price_alert_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "vendor_price_alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_price_alert_rules: {
        Row: {
          brand_id: string | null
          category_id: string | null
          created_at: string
          ean: string | null
          id: string
          is_active: boolean
          label: string | null
          metric: string
          scope: string
          threshold_median_pct: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          ean?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          metric?: string
          scope: string
          threshold_median_pct?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          ean?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          metric?: string
          scope?: string
          threshold_median_pct?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_price_alert_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_product_costs: {
        Row: {
          created_at: string
          currency: string
          default_purchase_price_excl_vat: number
          id: string
          notes: string | null
          product_id: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          default_purchase_price_excl_vat: number
          id?: string
          notes?: string | null
          product_id: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          default_purchase_price_excl_vat?: number
          id?: string
          notes?: string | null
          product_id?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_product_costs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_product_costs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_product_costs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_profile_defaults: {
        Row: {
          country_code: string
          created_at: string
          default_moq: number
          default_mov: number
          default_mov_currency: string
          id: string
          profile_type: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          default_moq?: number
          default_mov?: number
          default_mov_currency?: string
          id?: string
          profile_type: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          default_moq?: number
          default_mov?: number
          default_mov_currency?: string
          id?: string
          profile_type?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_profile_defaults_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_profile_defaults_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_profile_defaults_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_sendcloud_credentials: {
        Row: {
          created_at: string
          id: string
          is_connected: boolean
          last_verified_at: string | null
          sendcloud_public_key: string
          sendcloud_secret_key: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_connected?: boolean
          last_verified_at?: string | null
          sendcloud_public_key?: string
          sendcloud_secret_key?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_connected?: boolean
          last_verified_at?: string | null
          sendcloud_public_key?: string
          sendcloud_secret_key?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_sendcloud_credentials_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_sendcloud_credentials_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_sendcloud_credentials_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_shipping_addresses: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          city: string
          company_name: string
          country: string
          created_at: string
          email: string
          house_number: string
          id: string
          is_default: boolean
          label: string
          name: string
          phone: string
          postal_code: string
          vendor_id: string
        }
        Insert: {
          address_line_1?: string
          address_line_2?: string | null
          city?: string
          company_name?: string
          country?: string
          created_at?: string
          email?: string
          house_number?: string
          id?: string
          is_default?: boolean
          label?: string
          name?: string
          phone?: string
          postal_code?: string
          vendor_id: string
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          city?: string
          company_name?: string
          country?: string
          created_at?: string
          email?: string
          house_number?: string
          id?: string
          is_default?: boolean
          label?: string
          name?: string
          phone?: string
          postal_code?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_shipping_addresses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_shipping_addresses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_shipping_addresses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_visibility_rules: {
        Row: {
          country_code: string | null
          created_at: string
          customer_type: string | null
          id: string
          priority: number
          show_real_name: boolean
          updated_at: string
          vendor_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          customer_type?: string | null
          id?: string
          priority?: number
          show_real_name?: boolean
          updated_at?: string
          vendor_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          customer_type?: string | null
          id?: string
          priority?: number
          show_real_name?: boolean
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_visibility_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_visibility_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_visibility_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address_line1: string | null
          auth_user_id: string | null
          auto_forward_to_qogita: boolean
          business_type: string | null
          can_manage_offers: boolean
          city: string | null
          commission_model: Database["public"]["Enums"]["commission_model_enum"]
          commission_rate: number
          commissionnaire_agreement_accepted_at: string | null
          commissionnaire_agreement_version: string | null
          company_name: string | null
          contact_name: string | null
          contact_person: string | null
          country_code: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_code: string | null
          email: string | null
          facebook_url: string | null
          fixed_commission_amount: number | null
          id: string
          instagram_url: string | null
          is_active: boolean
          is_top_seller: boolean | null
          is_verified: boolean
          linkedin_url: string | null
          logo_url: string | null
          margin_split_pct: number
          name: string
          phone: string | null
          postal_code: string | null
          preferred_language: string | null
          qogita_seller_alias: string | null
          rating: number | null
          sendcloud_brand_id: string | null
          sendcloud_sender_address_id: string | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_contact_name: string | null
          shipping_country: string | null
          shipping_email: string | null
          shipping_logo_url: string | null
          shipping_margin_percentage: number
          shipping_onboarded_at: string | null
          shipping_phone: string | null
          shipping_pickup_instructions: string | null
          shipping_postal_code: string | null
          show_real_name: boolean
          slug: string
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_onboarding_complete: boolean
          stripe_payouts_enabled: boolean
          tagline: string | null
          total_sales: number
          twitter_url: string | null
          type: Database["public"]["Enums"]["vendor_type"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          validation_status:
            | Database["public"]["Enums"]["vendor_validation_status"]
            | null
          vat_number: string | null
          vendor_code: string | null
          vendor_shipping_mode: Database["public"]["Enums"]["vendor_shipping_mode"]
          website: string | null
          youtube_url: string | null
        }
        Insert: {
          address_line1?: string | null
          auth_user_id?: string | null
          auto_forward_to_qogita?: boolean
          business_type?: string | null
          can_manage_offers?: boolean
          city?: string | null
          commission_model?: Database["public"]["Enums"]["commission_model_enum"]
          commission_rate?: number
          commissionnaire_agreement_accepted_at?: string | null
          commissionnaire_agreement_version?: string | null
          company_name?: string | null
          contact_name?: string | null
          contact_person?: string | null
          country_code?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_code?: string | null
          email?: string | null
          facebook_url?: string | null
          fixed_commission_amount?: number | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          is_top_seller?: boolean | null
          is_verified?: boolean
          linkedin_url?: string | null
          logo_url?: string | null
          margin_split_pct?: number
          name: string
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          qogita_seller_alias?: string | null
          rating?: number | null
          sendcloud_brand_id?: string | null
          sendcloud_sender_address_id?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_contact_name?: string | null
          shipping_country?: string | null
          shipping_email?: string | null
          shipping_logo_url?: string | null
          shipping_margin_percentage?: number
          shipping_onboarded_at?: string | null
          shipping_phone?: string | null
          shipping_pickup_instructions?: string | null
          shipping_postal_code?: string | null
          show_real_name?: boolean
          slug: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_onboarding_complete?: boolean
          stripe_payouts_enabled?: boolean
          tagline?: string | null
          total_sales?: number
          twitter_url?: string | null
          type?: Database["public"]["Enums"]["vendor_type"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?:
            | Database["public"]["Enums"]["vendor_validation_status"]
            | null
          vat_number?: string | null
          vendor_code?: string | null
          vendor_shipping_mode?: Database["public"]["Enums"]["vendor_shipping_mode"]
          website?: string | null
          youtube_url?: string | null
        }
        Update: {
          address_line1?: string | null
          auth_user_id?: string | null
          auto_forward_to_qogita?: boolean
          business_type?: string | null
          can_manage_offers?: boolean
          city?: string | null
          commission_model?: Database["public"]["Enums"]["commission_model_enum"]
          commission_rate?: number
          commissionnaire_agreement_accepted_at?: string | null
          commissionnaire_agreement_version?: string | null
          company_name?: string | null
          contact_name?: string | null
          contact_person?: string | null
          country_code?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_code?: string | null
          email?: string | null
          facebook_url?: string | null
          fixed_commission_amount?: number | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          is_top_seller?: boolean | null
          is_verified?: boolean
          linkedin_url?: string | null
          logo_url?: string | null
          margin_split_pct?: number
          name?: string
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          qogita_seller_alias?: string | null
          rating?: number | null
          sendcloud_brand_id?: string | null
          sendcloud_sender_address_id?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_contact_name?: string | null
          shipping_country?: string | null
          shipping_email?: string | null
          shipping_logo_url?: string | null
          shipping_margin_percentage?: number
          shipping_onboarded_at?: string | null
          shipping_phone?: string | null
          shipping_pickup_instructions?: string | null
          shipping_postal_code?: string | null
          show_real_name?: boolean
          slug?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_onboarding_complete?: boolean
          stripe_payouts_enabled?: boolean
          tagline?: string | null
          total_sales?: number
          twitter_url?: string | null
          type?: Database["public"]["Enums"]["vendor_type"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?:
            | Database["public"]["Enums"]["vendor_validation_status"]
            | null
          vat_number?: string | null
          vendor_code?: string | null
          vendor_shipping_mode?: Database["public"]["Enums"]["vendor_shipping_mode"]
          website?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      customer_order_lines: {
        Row: {
          fulfillment_status:
            | Database["public"]["Enums"]["fulfillment_status"]
            | null
          fulfillment_type:
            | Database["public"]["Enums"]["fulfillment_type"]
            | null
          id: string | null
          line_total_excl_vat: number | null
          line_total_incl_vat: number | null
          offer_id: string | null
          order_id: string | null
          product_id: string | null
          qogita_order_status: string | null
          quantity: number | null
          tracking_number: string | null
          tracking_url: string | null
          unit_price_excl_vat: number | null
          unit_price_incl_vat: number | null
          vat_rate: number | null
          vendor_id: string | null
        }
        Insert: {
          fulfillment_status?:
            | Database["public"]["Enums"]["fulfillment_status"]
            | null
          fulfillment_type?:
            | Database["public"]["Enums"]["fulfillment_type"]
            | null
          id?: string | null
          line_total_excl_vat?: number | null
          line_total_incl_vat?: number | null
          offer_id?: string | null
          order_id?: string | null
          product_id?: string | null
          qogita_order_status?: string | null
          quantity?: number | null
          tracking_number?: string | null
          tracking_url?: string | null
          unit_price_excl_vat?: number | null
          unit_price_incl_vat?: number | null
          vat_rate?: number | null
          vendor_id?: string | null
        }
        Update: {
          fulfillment_status?:
            | Database["public"]["Enums"]["fulfillment_status"]
            | null
          fulfillment_type?:
            | Database["public"]["Enums"]["fulfillment_type"]
            | null
          id?: string | null
          line_total_excl_vat?: number | null
          line_total_incl_vat?: number | null
          offer_id?: string | null
          order_id?: string | null
          product_id?: string | null
          qogita_order_status?: string | null
          quantity?: number | null
          tracking_number?: string | null
          tracking_url?: string | null
          unit_price_excl_vat?: number | null
          unit_price_incl_vat?: number | null
          vat_rate?: number | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      public_offers: {
        Row: {
          country_code: string | null
          created_at: string | null
          delivery_days: number | null
          down_payment_pct: number | null
          estimated_delivery_days: number | null
          has_extended_delivery: boolean | null
          id: string | null
          is_active: boolean | null
          is_top_seller: boolean | null
          max_delivery_days: number | null
          min_delivery_days: number | null
          moq: number | null
          mov: number | null
          mov_amount: number | null
          mov_currency: string | null
          price_excl_vat: number | null
          price_incl_vat: number | null
          product_id: string | null
          shipping_from_country: string | null
          stock_quantity: number | null
          stock_status: Database["public"]["Enums"]["stock_status_enum"] | null
          updated_at: string | null
          vat_rate: number | null
          vendor_id: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          delivery_days?: number | null
          down_payment_pct?: number | null
          estimated_delivery_days?: number | null
          has_extended_delivery?: boolean | null
          id?: string | null
          is_active?: boolean | null
          is_top_seller?: boolean | null
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          moq?: number | null
          mov?: number | null
          mov_amount?: number | null
          mov_currency?: string | null
          price_excl_vat?: number | null
          price_incl_vat?: number | null
          product_id?: string | null
          shipping_from_country?: string | null
          stock_quantity?: number | null
          stock_status?: Database["public"]["Enums"]["stock_status_enum"] | null
          updated_at?: string | null
          vat_rate?: number | null
          vendor_id?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          delivery_days?: number | null
          down_payment_pct?: number | null
          estimated_delivery_days?: number | null
          has_extended_delivery?: boolean | null
          id?: string | null
          is_active?: boolean | null
          is_top_seller?: boolean | null
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          moq?: number | null
          mov?: number | null
          mov_amount?: number | null
          mov_currency?: string | null
          price_excl_vat?: number | null
          price_incl_vat?: number | null
          product_id?: string | null
          shipping_from_country?: string | null
          stock_quantity?: number | null
          stock_status?: Database["public"]["Enums"]["stock_status_enum"] | null
          updated_at?: string | null
          vat_rate?: number | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      public_vendors: {
        Row: {
          description: string | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          slug: string | null
        }
        Insert: {
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      restock_offers_with_delta: {
        Row: {
          allow_partial: boolean | null
          cnk: string | null
          created_at: string | null
          delivery_condition: string | null
          designation: string | null
          dlu: string | null
          drop_id: string | null
          ean: string | null
          expires_at: string | null
          grade: string | null
          id: string | null
          lot_size: number | null
          matched_product_id: string | null
          medikong_ean: string | null
          medikong_image_url: string | null
          medikong_price_ht: number | null
          medikong_price_ttc: number | null
          medikong_product_name: string | null
          moq: number | null
          packaging_photos: string[] | null
          photo_url: string | null
          price_ht: number | null
          price_ttc: number | null
          product_image_url: string | null
          product_state: string | null
          quantity: number | null
          savings_amount: number | null
          savings_pct: number | null
          seller_city: string | null
          status: string | null
          unit_weight_g: number | null
          updated_at: string | null
          vat_rate: number | null
          views_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_offers_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "restock_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_offers_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_public_offers_view: {
        Row: {
          allow_partial: boolean | null
          cnk: string | null
          created_at: string | null
          delivery_condition: string | null
          designation: string | null
          dlu: string | null
          drop_id: string | null
          ean: string | null
          expires_at: string | null
          grade: string | null
          id: string | null
          lot_size: number | null
          moq: number | null
          packaging_photos: string[] | null
          photo_url: string | null
          price_ht: number | null
          price_ttc: number | null
          product_image_url: string | null
          product_state: string | null
          quantity: number | null
          seller_city: string | null
          status: string | null
          unit_weight_g: number | null
          updated_at: string | null
          vat_rate: number | null
          views_count: number | null
        }
        Insert: {
          allow_partial?: boolean | null
          cnk?: string | null
          created_at?: string | null
          delivery_condition?: string | null
          designation?: string | null
          dlu?: string | null
          drop_id?: string | null
          ean?: string | null
          expires_at?: string | null
          grade?: string | null
          id?: string | null
          lot_size?: number | null
          moq?: number | null
          packaging_photos?: string[] | null
          photo_url?: string | null
          price_ht?: number | null
          price_ttc?: number | null
          product_image_url?: string | null
          product_state?: string | null
          quantity?: number | null
          seller_city?: string | null
          status?: string | null
          unit_weight_g?: number | null
          updated_at?: string | null
          vat_rate?: number | null
          views_count?: number | null
        }
        Update: {
          allow_partial?: boolean | null
          cnk?: string | null
          created_at?: string | null
          delivery_condition?: string | null
          designation?: string | null
          dlu?: string | null
          drop_id?: string | null
          ean?: string | null
          expires_at?: string | null
          grade?: string | null
          id?: string | null
          lot_size?: number | null
          moq?: number | null
          packaging_photos?: string[] | null
          photo_url?: string | null
          price_ht?: number | null
          price_ttc?: number | null
          product_image_url?: string | null
          product_state?: string | null
          quantity?: number | null
          seller_city?: string | null
          status?: string | null
          unit_weight_g?: number | null
          updated_at?: string | null
          vat_rate?: number | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_offers_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "restock_drops"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors_public: {
        Row: {
          city: string | null
          company_name: string | null
          country_code: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          display_code: string | null
          display_name: string | null
          facebook_url: string | null
          id: string | null
          instagram_url: string | null
          is_top_seller: boolean | null
          is_verified: boolean | null
          linkedin_url: string | null
          logo_url: string | null
          name: string | null
          preferred_language: string | null
          rating: number | null
          show_real_name: boolean | null
          slug: string | null
          tagline: string | null
          total_sales: number | null
          twitter_url: string | null
          type: Database["public"]["Enums"]["vendor_type"] | null
          website: string | null
          youtube_url: string | null
        }
        Insert: {
          city?: string | null
          company_name?: never
          country_code?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          display_code?: string | null
          display_name?: never
          facebook_url?: string | null
          id?: string | null
          instagram_url?: string | null
          is_top_seller?: boolean | null
          is_verified?: boolean | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: never
          preferred_language?: string | null
          rating?: number | null
          show_real_name?: boolean | null
          slug?: string | null
          tagline?: string | null
          total_sales?: number | null
          twitter_url?: string | null
          type?: Database["public"]["Enums"]["vendor_type"] | null
          website?: string | null
          youtube_url?: string | null
        }
        Update: {
          city?: string | null
          company_name?: never
          country_code?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          display_code?: string | null
          display_name?: never
          facebook_url?: string | null
          id?: string | null
          instagram_url?: string | null
          is_top_seller?: boolean | null
          is_verified?: boolean | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: never
          preferred_language?: string | null
          rating?: number | null
          show_real_name?: boolean | null
          slug?: string | null
          tagline?: string | null
          total_sales?: number | null
          twitter_url?: string | null
          type?: Database["public"]["Enums"]["vendor_type"] | null
          website?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bulk_override_requested: { Args: never; Returns: boolean }
      bulk_set_cnk_codes: { Args: { pairs: Json }; Returns: number }
      consume_qogita_tokens: { Args: { _amount: number }; Returns: Json }
      count_products_per_category: {
        Args: never
        Returns: {
          category_id: string
          product_count: number
        }[]
      }
      count_products_per_category_recursive: {
        Args: never
        Returns: {
          category_id: string
          product_count: number
        }[]
      }
      create_offers_from_products: {
        Args: { _country_code?: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_user_account: { Args: { _user_id: string }; Returns: undefined }
      detect_price_alerts_batch: {
        Args: { _th_crit?: number; _th_info?: number; _th_warn?: number }
        Returns: Json
      }
      detect_vendor_competitor_alerts: { Args: never; Returns: Json }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enqueue_qogita_resync_batch: {
        Args: {
          _batch_size?: number
          _mode?: Database["public"]["Enums"]["qogita_resync_mode"]
        }
        Returns: Json
      }
      evaluate_vendor_price_alerts: {
        Args: { _vendor_id: string }
        Returns: Json
      }
      finalize_qogita_resync_log: {
        Args: {
          _id: string
          _stats?: Json
          _status: Database["public"]["Enums"]["qogita_resync_status"]
        }
        Returns: undefined
      }
      force_bulk_deactivate: {
        Args: { _ids: string[]; _table_name: string }
        Returns: Json
      }
      get_admin_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      get_vendor_competitive_position: {
        Args: { _vendor_id: string }
        Returns: {
          best_price_excl_vat: number
          best_vendor_id: string
          brand_name: string
          cnk_code: string
          competitors_count: number
          country_code: string
          gap_amount: number
          gap_percentage: number
          gtin: string
          my_offer_id: string
          my_price_excl_vat: number
          my_rank: number
          my_stock: number
          product_id: string
          product_image: string
          product_name: string
          suggested_price_excl_vat: number
          total_offers: number
        }[]
      }
      get_vendor_market_intelligence: {
        Args: { _vendor_id: string }
        Returns: {
          best_external_price: number
          best_external_source: string
          best_medikong_competitor_price: number
          best_medikong_competitor_vendor: string
          brand_name: string
          cnk_code: string
          competitors_in_stock: number
          competitors_on_promo: number
          country_code: string
          external_offers: Json
          external_sources_count: number
          gap_vs_best_amount: number
          gap_vs_best_percentage: number
          gap_vs_median_amount: number
          gap_vs_median_percentage: number
          gtin: string
          medikong_competitors_count: number
          medikong_median_price: number
          medikong_offers: Json
          medikong_total_offers: number
          my_offer_id: string
          my_price_excl_vat: number
          my_rank: number
          my_stock: number
          my_stock_status: string
          my_updated_at: string
          product_discount_percentage: number
          product_id: string
          product_image: string
          product_name: string
        }[]
      }
      get_vendor_offer_history_30d: {
        Args: {
          _country_code?: string
          _product_id: string
          _vendor_id: string
        }
        Returns: {
          best_price: number
          median_price: number
          my_price: number
          my_rank: number
          snapshot_date: string
          total_offers: number
        }[]
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      match_import_lines: {
        Args: { _lines: Json }
        Returns: {
          cnk: string
          current_price: number
          ean: string
          line_index: number
          medi_price: number
          offer_id: string
          product_id: string
          product_image: string
          product_name: string
          quantity: number
          saving: number
          status: string
          vendor_name: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      public_active_offers_count: {
        Args: { _country_code?: string }
        Returns: number
      }
      public_verified_vendors_count: { Args: never; Returns: number }
      purge_bulk_deactivation_events: { Args: never; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_qogita_endpoint_error: {
        Args: {
          _endpoint: string
          _error_message?: string
          _log_id: string
          _status?: number
        }
        Returns: undefined
      }
      record_qogita_resync_progress: {
        Args: { _delta: Json; _log_id: string }
        Returns: undefined
      }
      resolve_product_brands: { Args: never; Returns: undefined }
      resolve_product_categories: { Args: never; Returns: undefined }
      snapshot_vendor_offer_history: { Args: never; Returns: Json }
      update_brand_product_counts: { Args: never; Returns: undefined }
      update_manufacturer_product_counts: { Args: never; Returns: undefined }
      upsert_market_prices: { Args: { rows: Json }; Returns: number }
    }
    Enums: {
      adjustment_trigger: "manual" | "quick_align" | "auto_align"
      admin_role:
        | "super_admin"
        | "admin"
        | "moderateur"
        | "support"
        | "comptable"
      alert_severity: "info" | "warning" | "critical"
      alert_status:
        | "new"
        | "seen"
        | "in_progress"
        | "resolved"
        | "auto_resolved"
      alert_type: "market_price" | "external_offer"
      commission_model_enum: "flat_percentage" | "margin_split" | "fixed_amount"
      customer_type: "pharmacy" | "hospital" | "clinic" | "lab" | "other"
      delegate_availability:
        | "available"
        | "busy"
        | "in_meeting"
        | "on_leave"
        | "unavailable"
      delegate_entity_type: "brand" | "manufacturer" | "vendor"
      delegate_type: "commercial" | "contact_referent"
      email_frequency: "immediate" | "daily_digest" | "weekly_digest"
      fulfillment_status:
        | "pending"
        | "processing"
        | "forwarded"
        | "shipped"
        | "delivered"
        | "cancelled"
      fulfillment_type: "qogita" | "medikong_direct" | "vendor_direct"
      notification_channel: "in_app" | "email" | "push"
      notification_sender: "system" | "superadmin"
      order_source: "web" | "api"
      order_status:
        | "draft"
        | "pending"
        | "confirmed"
        | "processing"
        | "partially_shipped"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "error"
      payment_method_enum: "invoice" | "bank_transfer" | "card"
      payment_status_enum: "pending" | "paid" | "overdue" | "refunded"
      product_source:
        | "qogita"
        | "medikong"
        | "vendor"
        | "medi-market"
        | "valerco"
      qogita_resync_mode:
        | "daily_stale_refresh"
        | "mute_detection"
        | "incremental"
        | "full"
        | "manual"
      qogita_resync_status: "running" | "success" | "partial" | "failed"
      reshipment_status_enum:
        | "not_applicable"
        | "awaiting_reception"
        | "received_at_warehouse"
        | "repackaging"
        | "reshipped"
      shipment_status:
        | "pending"
        | "created"
        | "announced"
        | "in_transit"
        | "delivered"
        | "exception"
        | "cancelled"
      shipping_invoice_status: "draft" | "sent" | "paid" | "overdue"
      shipping_mode_enum: "direct_to_customer" | "via_warehouse"
      sourcing_status:
        | "new"
        | "reviewing"
        | "quoted"
        | "accepted"
        | "rejected"
        | "fulfilled"
      stock_status_enum: "in_stock" | "low_stock" | "out_of_stock" | "on_demand"
      sync_log_status: "running" | "completed" | "error" | "partial"
      sync_status_enum: "idle" | "running" | "error" | "completed"
      sync_type_enum:
        | "full"
        | "incremental"
        | "prices"
        | "categories"
        | "brands"
        | "products"
        | "offers_detail"
        | "manual"
        | "offers_multi_vendor"
      urgency_enum: "low" | "medium" | "high"
      vendor_shipping_mode:
        | "no_shipping"
        | "own_sendcloud"
        | "medikong_whitelabel"
      vendor_type: "medikong" | "qogita_virtual" | "real" | "qogita"
      vendor_validation_status:
        | "pending_review"
        | "under_review"
        | "accepted"
        | "approved"
        | "rejected"
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
      adjustment_trigger: ["manual", "quick_align", "auto_align"],
      admin_role: [
        "super_admin",
        "admin",
        "moderateur",
        "support",
        "comptable",
      ],
      alert_severity: ["info", "warning", "critical"],
      alert_status: ["new", "seen", "in_progress", "resolved", "auto_resolved"],
      alert_type: ["market_price", "external_offer"],
      commission_model_enum: [
        "flat_percentage",
        "margin_split",
        "fixed_amount",
      ],
      customer_type: ["pharmacy", "hospital", "clinic", "lab", "other"],
      delegate_availability: [
        "available",
        "busy",
        "in_meeting",
        "on_leave",
        "unavailable",
      ],
      delegate_entity_type: ["brand", "manufacturer", "vendor"],
      delegate_type: ["commercial", "contact_referent"],
      email_frequency: ["immediate", "daily_digest", "weekly_digest"],
      fulfillment_status: [
        "pending",
        "processing",
        "forwarded",
        "shipped",
        "delivered",
        "cancelled",
      ],
      fulfillment_type: ["qogita", "medikong_direct", "vendor_direct"],
      notification_channel: ["in_app", "email", "push"],
      notification_sender: ["system", "superadmin"],
      order_source: ["web", "api"],
      order_status: [
        "draft",
        "pending",
        "confirmed",
        "processing",
        "partially_shipped",
        "shipped",
        "delivered",
        "cancelled",
        "error",
      ],
      payment_method_enum: ["invoice", "bank_transfer", "card"],
      payment_status_enum: ["pending", "paid", "overdue", "refunded"],
      product_source: [
        "qogita",
        "medikong",
        "vendor",
        "medi-market",
        "valerco",
      ],
      qogita_resync_mode: [
        "daily_stale_refresh",
        "mute_detection",
        "incremental",
        "full",
        "manual",
      ],
      qogita_resync_status: ["running", "success", "partial", "failed"],
      reshipment_status_enum: [
        "not_applicable",
        "awaiting_reception",
        "received_at_warehouse",
        "repackaging",
        "reshipped",
      ],
      shipment_status: [
        "pending",
        "created",
        "announced",
        "in_transit",
        "delivered",
        "exception",
        "cancelled",
      ],
      shipping_invoice_status: ["draft", "sent", "paid", "overdue"],
      shipping_mode_enum: ["direct_to_customer", "via_warehouse"],
      sourcing_status: [
        "new",
        "reviewing",
        "quoted",
        "accepted",
        "rejected",
        "fulfilled",
      ],
      stock_status_enum: ["in_stock", "low_stock", "out_of_stock", "on_demand"],
      sync_log_status: ["running", "completed", "error", "partial"],
      sync_status_enum: ["idle", "running", "error", "completed"],
      sync_type_enum: [
        "full",
        "incremental",
        "prices",
        "categories",
        "brands",
        "products",
        "offers_detail",
        "manual",
        "offers_multi_vendor",
      ],
      urgency_enum: ["low", "medium", "high"],
      vendor_shipping_mode: [
        "no_shipping",
        "own_sendcloud",
        "medikong_whitelabel",
      ],
      vendor_type: ["medikong", "qogita_virtual", "real", "qogita"],
      vendor_validation_status: [
        "pending_review",
        "under_review",
        "accepted",
        "approved",
        "rejected",
      ],
    },
  },
} as const
