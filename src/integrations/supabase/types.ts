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
          name_fr: string | null
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
          name_fr?: string | null
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
          name_fr?: string | null
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
            referencedRelation: "vendors"
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
          source_id: string
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
          source_id: string
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
          source_id?: string
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
            referencedRelation: "vendors"
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
            referencedRelation: "vendors"
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
            referencedRelation: "vendors"
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
          dimension_unit: string | null
          dimensions: Json | null
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
          offer_count: number
          origin_country: string | null
          popularity: number | null
          promotion_end_date: string | null
          promotion_label: string | null
          promotion_start_date: string | null
          qogita_fid: string | null
          qogita_qid: string | null
          qogita_slug: string | null
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
          weight: number | null
          weight_unit: string | null
          width: number | null
        }
        Insert: {
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
          dimension_unit?: string | null
          dimensions?: Json | null
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
          offer_count?: number
          origin_country?: string | null
          popularity?: number | null
          promotion_end_date?: string | null
          promotion_label?: string | null
          promotion_start_date?: string | null
          qogita_fid?: string | null
          qogita_qid?: string | null
          qogita_slug?: string | null
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
          weight?: number | null
          weight_unit?: string | null
          width?: number | null
        }
        Update: {
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
          dimension_unit?: string | null
          dimensions?: Json | null
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
          offer_count?: number
          origin_country?: string | null
          popularity?: number | null
          promotion_end_date?: string | null
          promotion_label?: string | null
          promotion_start_date?: string | null
          qogita_fid?: string | null
          qogita_qid?: string | null
          qogita_slug?: string | null
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
          company_name: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          price_level_code: string | null
          sector: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          price_level_code?: string | null
          sector?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          price_level_code?: string | null
          sector?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
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
            referencedRelation: "vendors"
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
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address_line1: string | null
          auth_user_id: string | null
          auto_forward_to_qogita: boolean
          can_manage_offers: boolean
          city: string | null
          commission_rate: number
          company_name: string | null
          country_code: string
          created_at: string
          description: string | null
          display_code: string | null
          email: string | null
          id: string
          is_active: boolean
          is_top_seller: boolean | null
          is_verified: boolean
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string | null
          qogita_seller_alias: string | null
          rating: number | null
          show_real_name: boolean
          slug: string
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_onboarding_complete: boolean
          stripe_payouts_enabled: boolean
          total_sales: number
          type: Database["public"]["Enums"]["vendor_type"]
          updated_at: string
          vat_number: string | null
          vendor_code: string | null
        }
        Insert: {
          address_line1?: string | null
          auth_user_id?: string | null
          auto_forward_to_qogita?: boolean
          can_manage_offers?: boolean
          city?: string | null
          commission_rate?: number
          company_name?: string | null
          country_code?: string
          created_at?: string
          description?: string | null
          display_code?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_top_seller?: boolean | null
          is_verified?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          qogita_seller_alias?: string | null
          rating?: number | null
          show_real_name?: boolean
          slug: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_onboarding_complete?: boolean
          stripe_payouts_enabled?: boolean
          total_sales?: number
          type?: Database["public"]["Enums"]["vendor_type"]
          updated_at?: string
          vat_number?: string | null
          vendor_code?: string | null
        }
        Update: {
          address_line1?: string | null
          auth_user_id?: string | null
          auto_forward_to_qogita?: boolean
          can_manage_offers?: boolean
          city?: string | null
          commission_rate?: number
          company_name?: string | null
          country_code?: string
          created_at?: string
          description?: string | null
          display_code?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_top_seller?: boolean | null
          is_verified?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          qogita_seller_alias?: string | null
          rating?: number | null
          show_real_name?: boolean
          slug?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_onboarding_complete?: boolean
          stripe_payouts_enabled?: boolean
          total_sales?: number
          type?: Database["public"]["Enums"]["vendor_type"]
          updated_at?: string
          vat_number?: string | null
          vendor_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_products_per_category: {
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
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_admin_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      resolve_product_brands: { Args: never; Returns: undefined }
      resolve_product_categories: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_brand_product_counts: { Args: never; Returns: undefined }
      update_manufacturer_product_counts: { Args: never; Returns: undefined }
    }
    Enums: {
      admin_role:
        | "super_admin"
        | "admin"
        | "moderateur"
        | "support"
        | "comptable"
      customer_type: "pharmacy" | "hospital" | "clinic" | "lab" | "other"
      fulfillment_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      fulfillment_type: "qogita" | "medikong_direct" | "vendor_direct"
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
      product_source: "qogita" | "medikong" | "vendor"
      reshipment_status_enum:
        | "not_applicable"
        | "awaiting_reception"
        | "received_at_warehouse"
        | "repackaging"
        | "reshipped"
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
      vendor_type: "medikong" | "qogita_virtual" | "real" | "qogita"
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
      admin_role: [
        "super_admin",
        "admin",
        "moderateur",
        "support",
        "comptable",
      ],
      customer_type: ["pharmacy", "hospital", "clinic", "lab", "other"],
      fulfillment_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      fulfillment_type: ["qogita", "medikong_direct", "vendor_direct"],
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
      product_source: ["qogita", "medikong", "vendor"],
      reshipment_status_enum: [
        "not_applicable",
        "awaiting_reception",
        "received_at_warehouse",
        "repackaging",
        "reshipped",
      ],
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
      vendor_type: ["medikong", "qogita_virtual", "real", "qogita"],
    },
  },
} as const
