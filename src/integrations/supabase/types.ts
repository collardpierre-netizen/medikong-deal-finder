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
      account_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          account_id: string
          account_kind: string
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          join_code: string | null
          revoked_at: string | null
          role: string
          token_hash: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          account_id: string
          account_kind: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          join_code?: string | null
          revoked_at?: string | null
          role?: string
          token_hash?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          account_id?: string
          account_kind?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          join_code?: string | null
          revoked_at?: string | null
          role?: string
          token_hash?: string | null
        }
        Relationships: []
      }
      account_memberships: {
        Row: {
          accepted_at: string | null
          account_id: string
          account_kind: string
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          account_id: string
          account_kind: string
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          account_id?: string
          account_kind?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string | null
          admin_id: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json
          path: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          path?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          path?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_notification_reads: {
        Row: {
          admin_user_id: string
          notification_id: string
          read_at: string
        }
        Insert: {
          admin_user_id: string
          notification_id: string
          read_at?: string
        }
        Update: {
          admin_user_id?: string
          notification_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "admin_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          body: string | null
          created_at: string
          cta_url: string | null
          id: string
          payload: Json
          severity: string
          source_id: string | null
          source_type: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          cta_url?: string | null
          id?: string
          payload?: Json
          severity?: string
          source_id?: string | null
          source_type?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          cta_url?: string | null
          id?: string
          payload?: Json
          severity?: string
          source_id?: string | null
          source_type?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value_json: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value_json: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value_json?: Json
        }
        Relationships: []
      }
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
          actor_id: string | null
          created_at: string
          detail: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          module: string | null
          payload: Json | null
          target_id: string | null
          target_type: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module?: string | null
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module?: string | null
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      audit_requests: {
        Row: {
          additional_notes: string | null
          admin_notes: string | null
          consent_text_version: string | null
          consented_at: string
          contact_email: string
          contact_first_name: string
          contact_last_name: string
          contact_phone: string | null
          created_at: string
          economies_estimated_max: number | null
          economies_estimated_min: number | null
          id: string
          pdf_storage_paths: Json | null
          pharmacy_address: string | null
          pharmacy_apb_number: string | null
          pharmacy_city: string | null
          pharmacy_country: string | null
          pharmacy_name: string
          pharmacy_postal_code: string | null
          report_pdf_url: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          admin_notes?: string | null
          consent_text_version?: string | null
          consented_at?: string
          contact_email: string
          contact_first_name: string
          contact_last_name: string
          contact_phone?: string | null
          created_at?: string
          economies_estimated_max?: number | null
          economies_estimated_min?: number | null
          id?: string
          pdf_storage_paths?: Json | null
          pharmacy_address?: string | null
          pharmacy_apb_number?: string | null
          pharmacy_city?: string | null
          pharmacy_country?: string | null
          pharmacy_name: string
          pharmacy_postal_code?: string | null
          report_pdf_url?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          admin_notes?: string | null
          consent_text_version?: string | null
          consented_at?: string
          contact_email?: string
          contact_first_name?: string
          contact_last_name?: string
          contact_phone?: string | null
          created_at?: string
          economies_estimated_max?: number | null
          economies_estimated_min?: number | null
          id?: string
          pdf_storage_paths?: Json | null
          pharmacy_address?: string | null
          pharmacy_apb_number?: string | null
          pharmacy_city?: string | null
          pharmacy_country?: string | null
          pharmacy_name?: string
          pharmacy_postal_code?: string | null
          report_pdf_url?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      be_city_to_province: {
        Row: {
          city_label: string
          city_normalized: string
          postal_code_prefix: string | null
          province: string
        }
        Insert: {
          city_label: string
          city_normalized: string
          postal_code_prefix?: string | null
          province: string
        }
        Update: {
          city_label?: string
          city_normalized?: string
          postal_code_prefix?: string | null
          province?: string
        }
        Relationships: []
      }
      be_pharmacies: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          apb_number: string
          city: string | null
          country_code: string
          created_at: string
          email: string | null
          id: string
          imported_at: string | null
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          postal_code: string | null
          province: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          apb_number: string
          city?: string | null
          country_code?: string
          created_at?: string
          email?: string | null
          id?: string
          imported_at?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          apb_number?: string
          city?: string | null
          country_code?: string
          created_at?: string
          email?: string | null
          id?: string
          imported_at?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      brand_official_distributors: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          vendor_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          vendor_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_official_distributors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_official_distributors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_official_distributors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_official_distributors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_official_distributors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_official_distributors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "brand_official_distributors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "brand_official_distributors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_official_distributors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "brand_official_distributors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "brand_official_distributors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_official_distributors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_reviews: {
        Row: {
          brand_id: string
          brand_slug: string
          comment: string | null
          created_at: string
          id: string
          is_published: boolean
          rating_delivery: number
          rating_documentation: number
          rating_margin: number
          rating_quality: number
          rating_support: number
          reviewer_city: string | null
          reviewer_initials: string
          reviewer_user_id: string
          updated_at: string
          verified_buyer_orders_count: number
        }
        Insert: {
          brand_id: string
          brand_slug: string
          comment?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          rating_delivery: number
          rating_documentation: number
          rating_margin: number
          rating_quality: number
          rating_support: number
          reviewer_city?: string | null
          reviewer_initials: string
          reviewer_user_id: string
          updated_at?: string
          verified_buyer_orders_count?: number
        }
        Update: {
          brand_id?: string
          brand_slug?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          rating_delivery?: number
          rating_documentation?: number
          rating_margin?: number
          rating_quality?: number
          rating_support?: number
          reviewer_city?: string | null
          reviewer_initials?: string
          reviewer_user_id?: string
          updated_at?: string
          verified_buyer_orders_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "brand_reviews_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_reviews_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_reviews_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_reviews_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_reviews_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      brands: {
        Row: {
          afmps_status: string | null
          ce_marking: boolean | null
          certifications: string[] | null
          country_hq: string | null
          country_of_origin: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          description_en: string | null
          distribution_type: string | null
          gallery_images: Json
          google_trends_12m: Json | null
          google_trends_trend_pct: number | null
          id: string
          inami_categories: Json | null
          inami_reimbursement_pct: number | null
          is_active: boolean
          is_featured: boolean
          is_top20: boolean
          last_sync_run_id: string | null
          logo_url: string | null
          main_category: string | null
          manufacturer_id: string | null
          manufacturing_countries: string[] | null
          name: string
          norm_key: string | null
          officinal_coverage_pct: number | null
          parent_company: string | null
          press_mentions_12m: number | null
          product_count: number
          proposed_by_vendor_id: string | null
          qogita_qid: string | null
          slug: string
          social_links: Json
          sources_last_updated: string | null
          subcategories: string[] | null
          submission_approved_at: string | null
          submission_approved_by: string | null
          submission_rejected_reason: string | null
          submission_status:
            | Database["public"]["Enums"]["catalog_submission_status"]
            | null
          synced_at: string | null
          updated_at: string
          website_url: string | null
          year_entered_be_market: number | null
        }
        Insert: {
          afmps_status?: string | null
          ce_marking?: boolean | null
          certifications?: string[] | null
          country_hq?: string | null
          country_of_origin?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          distribution_type?: string | null
          gallery_images?: Json
          google_trends_12m?: Json | null
          google_trends_trend_pct?: number | null
          id?: string
          inami_categories?: Json | null
          inami_reimbursement_pct?: number | null
          is_active?: boolean
          is_featured?: boolean
          is_top20?: boolean
          last_sync_run_id?: string | null
          logo_url?: string | null
          main_category?: string | null
          manufacturer_id?: string | null
          manufacturing_countries?: string[] | null
          name: string
          norm_key?: string | null
          officinal_coverage_pct?: number | null
          parent_company?: string | null
          press_mentions_12m?: number | null
          product_count?: number
          proposed_by_vendor_id?: string | null
          qogita_qid?: string | null
          slug: string
          social_links?: Json
          sources_last_updated?: string | null
          subcategories?: string[] | null
          submission_approved_at?: string | null
          submission_approved_by?: string | null
          submission_rejected_reason?: string | null
          submission_status?:
            | Database["public"]["Enums"]["catalog_submission_status"]
            | null
          synced_at?: string | null
          updated_at?: string
          website_url?: string | null
          year_entered_be_market?: number | null
        }
        Update: {
          afmps_status?: string | null
          ce_marking?: boolean | null
          certifications?: string[] | null
          country_hq?: string | null
          country_of_origin?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          distribution_type?: string | null
          gallery_images?: Json
          google_trends_12m?: Json | null
          google_trends_trend_pct?: number | null
          id?: string
          inami_categories?: Json | null
          inami_reimbursement_pct?: number | null
          is_active?: boolean
          is_featured?: boolean
          is_top20?: boolean
          last_sync_run_id?: string | null
          logo_url?: string | null
          main_category?: string | null
          manufacturer_id?: string | null
          manufacturing_countries?: string[] | null
          name?: string
          norm_key?: string | null
          officinal_coverage_pct?: number | null
          parent_company?: string | null
          press_mentions_12m?: number | null
          product_count?: number
          proposed_by_vendor_id?: string | null
          qogita_qid?: string | null
          slug?: string
          social_links?: Json
          sources_last_updated?: string | null
          subcategories?: string[] | null
          submission_approved_at?: string | null
          submission_approved_by?: string | null
          submission_rejected_reason?: string | null
          submission_status?:
            | Database["public"]["Enums"]["catalog_submission_status"]
            | null
          synced_at?: string | null
          updated_at?: string
          website_url?: string | null
          year_entered_be_market?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "brands_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "brands_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "brands_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "brands_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      brands_backup_20260428: {
        Row: {
          afmps_status: string | null
          ce_marking: boolean | null
          certifications: string[] | null
          country_hq: string | null
          country_of_origin: string | null
          created_at: string | null
          description: string | null
          distribution_type: string | null
          google_trends_12m: Json | null
          google_trends_trend_pct: number | null
          id: string | null
          inami_categories: Json | null
          inami_reimbursement_pct: number | null
          is_active: boolean | null
          is_featured: boolean | null
          is_top20: boolean | null
          logo_url: string | null
          main_category: string | null
          manufacturer_id: string | null
          manufacturing_countries: string[] | null
          name: string | null
          officinal_coverage_pct: number | null
          parent_company: string | null
          press_mentions_12m: number | null
          product_count: number | null
          qogita_qid: string | null
          slug: string | null
          sources_last_updated: string | null
          subcategories: string[] | null
          synced_at: string | null
          updated_at: string | null
          website_url: string | null
          year_entered_be_market: number | null
        }
        Insert: {
          afmps_status?: string | null
          ce_marking?: boolean | null
          certifications?: string[] | null
          country_hq?: string | null
          country_of_origin?: string | null
          created_at?: string | null
          description?: string | null
          distribution_type?: string | null
          google_trends_12m?: Json | null
          google_trends_trend_pct?: number | null
          id?: string | null
          inami_categories?: Json | null
          inami_reimbursement_pct?: number | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_top20?: boolean | null
          logo_url?: string | null
          main_category?: string | null
          manufacturer_id?: string | null
          manufacturing_countries?: string[] | null
          name?: string | null
          officinal_coverage_pct?: number | null
          parent_company?: string | null
          press_mentions_12m?: number | null
          product_count?: number | null
          qogita_qid?: string | null
          slug?: string | null
          sources_last_updated?: string | null
          subcategories?: string[] | null
          synced_at?: string | null
          updated_at?: string | null
          website_url?: string | null
          year_entered_be_market?: number | null
        }
        Update: {
          afmps_status?: string | null
          ce_marking?: boolean | null
          certifications?: string[] | null
          country_hq?: string | null
          country_of_origin?: string | null
          created_at?: string | null
          description?: string | null
          distribution_type?: string | null
          google_trends_12m?: Json | null
          google_trends_trend_pct?: number | null
          id?: string | null
          inami_categories?: Json | null
          inami_reimbursement_pct?: number | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_top20?: boolean | null
          logo_url?: string | null
          main_category?: string | null
          manufacturer_id?: string | null
          manufacturing_countries?: string[] | null
          name?: string | null
          officinal_coverage_pct?: number | null
          parent_company?: string | null
          press_mentions_12m?: number | null
          product_count?: number | null
          qogita_qid?: string | null
          slug?: string | null
          sources_last_updated?: string | null
          subcategories?: string[] | null
          synced_at?: string | null
          updated_at?: string | null
          website_url?: string | null
          year_entered_be_market?: number | null
        }
        Relationships: []
      }
      brands_backup_20260428_en: {
        Row: {
          afmps_status: string | null
          ce_marking: boolean | null
          certifications: string[] | null
          country_hq: string | null
          country_of_origin: string | null
          created_at: string | null
          description: string | null
          distribution_type: string | null
          google_trends_12m: Json | null
          google_trends_trend_pct: number | null
          id: string | null
          inami_categories: Json | null
          inami_reimbursement_pct: number | null
          is_active: boolean | null
          is_featured: boolean | null
          is_top20: boolean | null
          logo_url: string | null
          main_category: string | null
          manufacturer_id: string | null
          manufacturing_countries: string[] | null
          name: string | null
          officinal_coverage_pct: number | null
          parent_company: string | null
          press_mentions_12m: number | null
          product_count: number | null
          qogita_qid: string | null
          slug: string | null
          sources_last_updated: string | null
          subcategories: string[] | null
          synced_at: string | null
          updated_at: string | null
          website_url: string | null
          year_entered_be_market: number | null
        }
        Insert: {
          afmps_status?: string | null
          ce_marking?: boolean | null
          certifications?: string[] | null
          country_hq?: string | null
          country_of_origin?: string | null
          created_at?: string | null
          description?: string | null
          distribution_type?: string | null
          google_trends_12m?: Json | null
          google_trends_trend_pct?: number | null
          id?: string | null
          inami_categories?: Json | null
          inami_reimbursement_pct?: number | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_top20?: boolean | null
          logo_url?: string | null
          main_category?: string | null
          manufacturer_id?: string | null
          manufacturing_countries?: string[] | null
          name?: string | null
          officinal_coverage_pct?: number | null
          parent_company?: string | null
          press_mentions_12m?: number | null
          product_count?: number | null
          qogita_qid?: string | null
          slug?: string | null
          sources_last_updated?: string | null
          subcategories?: string[] | null
          synced_at?: string | null
          updated_at?: string | null
          website_url?: string | null
          year_entered_be_market?: number | null
        }
        Update: {
          afmps_status?: string | null
          ce_marking?: boolean | null
          certifications?: string[] | null
          country_hq?: string | null
          country_of_origin?: string | null
          created_at?: string | null
          description?: string | null
          distribution_type?: string | null
          google_trends_12m?: Json | null
          google_trends_trend_pct?: number | null
          id?: string | null
          inami_categories?: Json | null
          inami_reimbursement_pct?: number | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_top20?: boolean | null
          logo_url?: string | null
          main_category?: string | null
          manufacturer_id?: string | null
          manufacturing_countries?: string[] | null
          name?: string | null
          officinal_coverage_pct?: number | null
          parent_company?: string | null
          press_mentions_12m?: number | null
          product_count?: number | null
          qogita_qid?: string | null
          slug?: string | null
          sources_last_updated?: string | null
          subcategories?: string[] | null
          synced_at?: string | null
          updated_at?: string | null
          website_url?: string | null
          year_entered_be_market?: number | null
        }
        Relationships: []
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
      buyer_comparator_sourcing_items: {
        Row: {
          admin_notes: string | null
          admin_status: string
          brand_id: string | null
          buyer_price_avg_cents: number | null
          buyer_price_max_cents: number | null
          buyer_price_min_cents: number | null
          buyer_price_samples: number
          buyer_price_sum_cents: number
          cnk: string | null
          created_at: string
          dedupe_key: string
          distinct_user_ids: string[]
          first_seen_at: string
          gtin: string | null
          id: string
          import_count: number
          last_seen_at: string
          product_id: string | null
          raw_brand: string | null
          raw_name: string | null
          status: string
          total_quantity: number
          updated_at: string
          user_count: number
        }
        Insert: {
          admin_notes?: string | null
          admin_status?: string
          brand_id?: string | null
          buyer_price_avg_cents?: number | null
          buyer_price_max_cents?: number | null
          buyer_price_min_cents?: number | null
          buyer_price_samples?: number
          buyer_price_sum_cents?: number
          cnk?: string | null
          created_at?: string
          dedupe_key: string
          distinct_user_ids?: string[]
          first_seen_at?: string
          gtin?: string | null
          id?: string
          import_count?: number
          last_seen_at?: string
          product_id?: string | null
          raw_brand?: string | null
          raw_name?: string | null
          status: string
          total_quantity?: number
          updated_at?: string
          user_count?: number
        }
        Update: {
          admin_notes?: string | null
          admin_status?: string
          brand_id?: string | null
          buyer_price_avg_cents?: number | null
          buyer_price_max_cents?: number | null
          buyer_price_min_cents?: number | null
          buyer_price_samples?: number
          buyer_price_sum_cents?: number
          cnk?: string | null
          created_at?: string
          dedupe_key?: string
          distinct_user_ids?: string[]
          first_seen_at?: string
          gtin?: string | null
          id?: string
          import_count?: number
          last_seen_at?: string
          product_id?: string | null
          raw_brand?: string | null
          raw_name?: string | null
          status?: string
          total_quantity?: number
          updated_at?: string
          user_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "buyer_comparator_sourcing_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "buyer_comparator_sourcing_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "buyer_comparator_sourcing_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "buyer_comparator_sourcing_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_comparator_sourcing_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "buyer_comparator_sourcing_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "buyer_comparator_sourcing_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_comparator_sourcing_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "buyer_comparator_sourcing_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_comparator_sourcing_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_comparator_sourcing_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      buyer_impersonation_sessions: {
        Row: {
          admin_user_id: string
          ended_at: string | null
          ended_reason: string | null
          id: string
          reason: string | null
          started_at: string
          target_company_name: string | null
          target_customer_id: string | null
          target_email: string | null
          target_user_id: string
        }
        Insert: {
          admin_user_id: string
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          reason?: string | null
          started_at?: string
          target_company_name?: string | null
          target_customer_id?: string | null
          target_email?: string | null
          target_user_id: string
        }
        Update: {
          admin_user_id?: string
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          reason?: string | null
          started_at?: string
          target_company_name?: string | null
          target_customer_id?: string | null
          target_email?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      buyer_order_tokens: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          order_id: string
          order_number: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at?: string
          order_id: string
          order_number: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          order_id?: string
          order_number?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_order_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_order_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "buyer_order_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "admin_orders_with_forecast_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_order_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_order_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders_visible_v"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_p2p_listings: {
        Row: {
          accepted_at: string | null
          batch_number: string | null
          brand_name: string | null
          cancelled_at: string | null
          cnk_code: string | null
          commission_enabled: boolean
          commission_payer: Database["public"]["Enums"]["buyer_p2p_commission_payer"]
          commission_rate_bps: number
          completed_at: string | null
          created_at: string
          currency_code: string
          declined_at: string | null
          expiry_date: string | null
          gtin: string | null
          id: string
          notes: string | null
          product_id: string | null
          product_name: string
          quantity: number
          seller_buyer_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["buyer_p2p_status"]
          sub_order_id: string | null
          target_buyer_id: string
          unit_price_excl_vat_cents: number
          updated_at: string
          valid_until: string
          vat_rate: number
        }
        Insert: {
          accepted_at?: string | null
          batch_number?: string | null
          brand_name?: string | null
          cancelled_at?: string | null
          cnk_code?: string | null
          commission_enabled?: boolean
          commission_payer?: Database["public"]["Enums"]["buyer_p2p_commission_payer"]
          commission_rate_bps?: number
          completed_at?: string | null
          created_at?: string
          currency_code?: string
          declined_at?: string | null
          expiry_date?: string | null
          gtin?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
          seller_buyer_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["buyer_p2p_status"]
          sub_order_id?: string | null
          target_buyer_id: string
          unit_price_excl_vat_cents: number
          updated_at?: string
          valid_until: string
          vat_rate?: number
        }
        Update: {
          accepted_at?: string | null
          batch_number?: string | null
          brand_name?: string | null
          cancelled_at?: string | null
          cnk_code?: string | null
          commission_enabled?: boolean
          commission_payer?: Database["public"]["Enums"]["buyer_p2p_commission_payer"]
          commission_rate_bps?: number
          completed_at?: string | null
          created_at?: string
          currency_code?: string
          declined_at?: string | null
          expiry_date?: string | null
          gtin?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          seller_buyer_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["buyer_p2p_status"]
          sub_order_id?: string | null
          target_buyer_id?: string
          unit_price_excl_vat_cents?: number
          updated_at?: string
          valid_until?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "buyer_p2p_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "buyer_p2p_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_p2p_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "buyer_p2p_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_p2p_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_p2p_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "buyer_p2p_listings_seller_buyer_id_fkey"
            columns: ["seller_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_p2p_listings_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["sub_order_id"]
          },
          {
            foreignKeyName: "buyer_p2p_listings_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_p2p_listings_target_buyer_id_fkey"
            columns: ["target_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_p2p_messages: {
        Row: {
          author_buyer_id: string
          body: string
          counter_quantity: number | null
          counter_unit_price_excl_vat_cents: number | null
          created_at: string
          id: string
          listing_id: string
        }
        Insert: {
          author_buyer_id: string
          body: string
          counter_quantity?: number | null
          counter_unit_price_excl_vat_cents?: number | null
          created_at?: string
          id?: string
          listing_id: string
        }
        Update: {
          author_buyer_id?: string
          body?: string
          counter_quantity?: number | null
          counter_unit_price_excl_vat_cents?: number | null
          created_at?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_p2p_messages_author_buyer_id_fkey"
            columns: ["author_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_p2p_messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "buyer_p2p_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_p2p_settings: {
        Row: {
          commission_payer: Database["public"]["Enums"]["buyer_p2p_commission_payer"]
          created_at: string
          default_commission_bps: number
          id: boolean
          is_enabled: boolean
          max_validity_days: number
          updated_at: string
        }
        Insert: {
          commission_payer?: Database["public"]["Enums"]["buyer_p2p_commission_payer"]
          created_at?: string
          default_commission_bps?: number
          id?: boolean
          is_enabled?: boolean
          max_validity_days?: number
          updated_at?: string
        }
        Update: {
          commission_payer?: Database["public"]["Enums"]["buyer_p2p_commission_payer"]
          created_at?: string
          default_commission_bps?: number
          id?: boolean
          is_enabled?: boolean
          max_validity_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      buyer_profiles: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          label: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id: string
          label: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          label?: string
        }
        Relationships: []
      }
      buyer_subscriptions: {
        Row: {
          auto_switch_to_paid: boolean | null
          bonus_eligible: boolean | null
          bonus_ends_at: string | null
          bonus_started_at: string | null
          buyer_id: string
          created_at: string | null
          extension_ends_at: string | null
          extension_granted_at: string | null
          extension_granted_by: string | null
          extension_started_at: string | null
          id: string
          lifetime_volume_ht: number | null
          notes: string | null
          paid_canceled_at: string | null
          paid_current_period_end: string | null
          paid_current_period_start: string | null
          paid_monthly_price_ht: number | null
          paid_next_invoice_at: string | null
          paid_started_at: string | null
          paid_vat_rate: number | null
          plan_id: string
          status: string
          trial_ends_at: string
          trial_started_at: string
          trial_volume_ht: number | null
          updated_at: string | null
          volume_threshold_ht: number | null
        }
        Insert: {
          auto_switch_to_paid?: boolean | null
          bonus_eligible?: boolean | null
          bonus_ends_at?: string | null
          bonus_started_at?: string | null
          buyer_id: string
          created_at?: string | null
          extension_ends_at?: string | null
          extension_granted_at?: string | null
          extension_granted_by?: string | null
          extension_started_at?: string | null
          id?: string
          lifetime_volume_ht?: number | null
          notes?: string | null
          paid_canceled_at?: string | null
          paid_current_period_end?: string | null
          paid_current_period_start?: string | null
          paid_monthly_price_ht?: number | null
          paid_next_invoice_at?: string | null
          paid_started_at?: string | null
          paid_vat_rate?: number | null
          plan_id: string
          status?: string
          trial_ends_at: string
          trial_started_at?: string
          trial_volume_ht?: number | null
          updated_at?: string | null
          volume_threshold_ht?: number | null
        }
        Update: {
          auto_switch_to_paid?: boolean | null
          bonus_eligible?: boolean | null
          bonus_ends_at?: string | null
          bonus_started_at?: string | null
          buyer_id?: string
          created_at?: string | null
          extension_ends_at?: string | null
          extension_granted_at?: string | null
          extension_granted_by?: string | null
          extension_started_at?: string | null
          id?: string
          lifetime_volume_ht?: number | null
          notes?: string | null
          paid_canceled_at?: string | null
          paid_current_period_end?: string | null
          paid_current_period_start?: string | null
          paid_monthly_price_ht?: number | null
          paid_next_invoice_at?: string | null
          paid_started_at?: string | null
          paid_vat_rate?: number | null
          plan_id?: string
          status?: string
          trial_ends_at?: string
          trial_started_at?: string
          trial_volume_ht?: number | null
          updated_at?: string | null
          volume_threshold_ht?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          address: Json | null
          audience: string
          created_at: string
          id: string
          is_active: boolean
          pharmacy_name: string | null
          region: string | null
          updated_at: string
          user_id: string | null
          vat_number: string | null
        }
        Insert: {
          address?: Json | null
          audience?: string
          created_at?: string
          id?: string
          is_active?: boolean
          pharmacy_name?: string | null
          region?: string | null
          updated_at?: string
          user_id?: string | null
          vat_number?: string | null
        }
        Update: {
          address?: Json | null
          audience?: string
          created_at?: string
          id?: string
          is_active?: boolean
          pharmacy_name?: string | null
          region?: string | null
          updated_at?: string
          user_id?: string | null
          vat_number?: string | null
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "cart_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
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
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
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
      catalog_health_missing_offers: {
        Row: {
          captured_at: string
          country_code: string
          id: number
          product_id: string
          run_id: string
        }
        Insert: {
          captured_at?: string
          country_code: string
          id?: number
          product_id: string
          run_id: string
        }
        Update: {
          captured_at?: string
          country_code?: string
          id?: number
          product_id?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_health_missing_offers_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "catalog_health_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_health_runs: {
        Row: {
          active_products_count: number
          country_code: string
          created_at: string
          id: string
          missing_offers_count: number
          missing_ratio: number
          run_at: string
        }
        Insert: {
          active_products_count?: number
          country_code: string
          created_at?: string
          id?: string
          missing_offers_count?: number
          missing_ratio?: number
          run_at?: string
        }
        Update: {
          active_products_count?: number
          country_code?: string
          created_at?: string
          id?: string
          missing_offers_count?: number
          missing_ratio?: number
          run_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          description: string | null
          description_en: string | null
          display_order: number
          embedding: string | null
          hs_code: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured_top: boolean
          level: number | null
          name: string
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          parent_id: string | null
          qogita_qid: string | null
          slug: string
          status: string
          synced_at: string | null
          vat_rate: number | null
        }
        Insert: {
          description?: string | null
          description_en?: string | null
          display_order?: number
          embedding?: string | null
          hs_code?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured_top?: boolean
          level?: number | null
          name: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          parent_id?: string | null
          qogita_qid?: string | null
          slug: string
          status?: string
          synced_at?: string | null
          vat_rate?: number | null
        }
        Update: {
          description?: string | null
          description_en?: string | null
          display_order?: number
          embedding?: string | null
          hs_code?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured_top?: boolean
          level?: number | null
          name?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          parent_id?: string | null
          qogita_qid?: string | null
          slug?: string
          status?: string
          synced_at?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories_backup_20260428_en: {
        Row: {
          description: string | null
          display_order: number | null
          hs_code: string | null
          icon: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          name: string | null
          name_de: string | null
          name_fr: string | null
          name_nl: string | null
          parent_id: string | null
          qogita_qid: string | null
          slug: string | null
          synced_at: string | null
          vat_rate: number | null
        }
        Insert: {
          description?: string | null
          display_order?: number | null
          hs_code?: string | null
          icon?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          name?: string | null
          name_de?: string | null
          name_fr?: string | null
          name_nl?: string | null
          parent_id?: string | null
          qogita_qid?: string | null
          slug?: string | null
          synced_at?: string | null
          vat_rate?: number | null
        }
        Update: {
          description?: string | null
          display_order?: number | null
          hs_code?: string | null
          icon?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          name?: string | null
          name_de?: string | null
          name_fr?: string | null
          name_nl?: string | null
          parent_id?: string | null
          qogita_qid?: string | null
          slug?: string | null
          synced_at?: string | null
          vat_rate?: number | null
        }
        Relationships: []
      }
      category_alias_apply_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          triggered_by: string | null
          updated_count: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by?: string | null
          updated_count?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by?: string | null
          updated_count?: number | null
        }
        Relationships: []
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
      category_llm_mapping_proposals: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          confidence: number | null
          created_at: string
          id: string
          model: string
          products_count: number
          qogita_category_id: string
          qogita_name: string
          raw_response: Json | null
          reason: string | null
          status: string
          suggested_mk_category_id: string | null
          suggested_mk_slug: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          model?: string
          products_count?: number
          qogita_category_id: string
          qogita_name: string
          raw_response?: Json | null
          reason?: string | null
          status?: string
          suggested_mk_category_id?: string | null
          suggested_mk_slug?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          model?: string
          products_count?: number
          qogita_category_id?: string
          qogita_name?: string
          raw_response?: Json | null
          reason?: string | null
          status?: string
          suggested_mk_category_id?: string | null
          suggested_mk_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_llm_mapping_proposals_qogita_category_id_fkey"
            columns: ["qogita_category_id"]
            isOneToOne: true
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_llm_mapping_proposals_qogita_category_id_fkey"
            columns: ["qogita_category_id"]
            isOneToOne: true
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "category_llm_mapping_proposals_qogita_category_id_fkey"
            columns: ["qogita_category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_llm_mapping_proposals_suggested_mk_category_id_fkey"
            columns: ["suggested_mk_category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_llm_mapping_proposals_suggested_mk_category_id_fkey"
            columns: ["suggested_mk_category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "category_llm_mapping_proposals_suggested_mk_category_id_fkey"
            columns: ["suggested_mk_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_source_aliases: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          notes: string | null
          source_locale: string | null
          source_path: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          source_locale?: string | null
          source_path: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          source_locale?: string | null
          source_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_source_aliases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_source_aliases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "category_source_aliases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_translations: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          locale: string
          meta_description: string | null
          meta_title: string | null
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          locale: string
          meta_description?: string | null
          meta_title?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          locale?: string
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_featured_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
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
          focal_x: number
          focal_y: number
          id: string
          image_fit: string
          image_url: string
          image_url_mobile: string | null
          is_active: boolean
          link_url: string | null
          show_cta: boolean
          show_subtitle: boolean
          show_title: boolean
          sort_order: number
          subtitle: string | null
          title: string | null
          zoom: number
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          cta_text?: string | null
          focal_x?: number
          focal_y?: number
          id?: string
          image_fit?: string
          image_url: string
          image_url_mobile?: string | null
          is_active?: boolean
          link_url?: string | null
          show_cta?: boolean
          show_subtitle?: boolean
          show_title?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          zoom?: number
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          cta_text?: string | null
          focal_x?: number
          focal_y?: number
          id?: string
          image_fit?: string
          image_url?: string
          image_url_mobile?: string | null
          is_active?: boolean
          link_url?: string | null
          show_cta?: boolean
          show_subtitle?: boolean
          show_title?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          zoom?: number
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
      cms_partner_logos: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          placement: string
          sort_order: number
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          placement?: string
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          placement?: string
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      cnk_vat_mapping: {
        Row: {
          cnk_code: string | null
          cnk_prefix: string | null
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          note: string | null
          updated_at: string
          vat_rate: number
        }
        Insert: {
          cnk_code?: string | null
          cnk_prefix?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          updated_at?: string
          vat_rate: number
        }
        Update: {
          cnk_code?: string | null
          cnk_prefix?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      commission_overrides_audit: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          changed_at: string
          changed_by: string | null
          id: number
          offer_id: string | null
          product_id: string | null
          scope: string
          vendor_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: number
          offer_id?: string | null
          product_id?: string | null
          scope: string
          vendor_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: number
          offer_id?: string | null
          product_id?: string | null
          scope?: string
          vendor_id?: string | null
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          articles: Json
          contract_type: string
          created_at: string
          created_by: string | null
          effective_at: string | null
          id: string
          medikong_data: Json
          notes: string | null
          required_fields: Json
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          articles?: Json
          contract_type?: string
          created_at?: string
          created_by?: string | null
          effective_at?: string | null
          id?: string
          medikong_data?: Json
          notes?: string | null
          required_fields?: Json
          status?: string
          updated_at?: string
          version: string
        }
        Update: {
          articles?: Json
          contract_type?: string
          created_at?: string
          created_by?: string | null
          effective_at?: string | null
          id?: string
          medikong_data?: Json
          notes?: string | null
          required_fields?: Json
          status?: string
          updated_at?: string
          version?: string
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
      country_neighbors: {
        Row: {
          country_code: string
          neighbor_code: string
        }
        Insert: {
          country_code: string
          neighbor_code: string
        }
        Update: {
          country_code?: string
          neighbor_code?: string
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
      customer_profile_history: {
        Row: {
          auth_user_id: string | null
          changed_at: string
          changed_by: string | null
          customer_id: string
          field_name: string
          id: string
          new_label: string | null
          new_value: string | null
          old_label: string | null
          old_value: string | null
          reason: string
        }
        Insert: {
          auth_user_id?: string | null
          changed_at?: string
          changed_by?: string | null
          customer_id: string
          field_name: string
          id?: string
          new_label?: string | null
          new_value?: string | null
          old_label?: string | null
          old_value?: string | null
          reason: string
        }
        Update: {
          auth_user_id?: string | null
          changed_at?: string
          changed_by?: string | null
          customer_id?: string
          field_name?: string
          id?: string
          new_label?: string | null
          new_value?: string | null
          old_label?: string | null
          old_value?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_profile_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_shipping_addresses: {
        Row: {
          address_l1: string
          address_l2: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country_code: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string
          notes: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address_l1: string
          address_l2?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_code?: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label: string
          notes?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address_l1?: string
          address_l2?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_code?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string
          notes?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_shipping_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string
          address_line2: string | null
          auth_user_id: string | null
          buyer_profile_id: string | null
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
          stripe_customer_id: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          auth_user_id?: string | null
          buyer_profile_id?: string | null
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
          stripe_customer_id?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          auth_user_id?: string | null
          buyer_profile_id?: string | null
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
          stripe_customer_id?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "buyer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["buyer_profile_id"]
          },
        ]
      }
      db_backup_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          size_bytes: number
          status: string
          storage_path: string
          tables_included: string[]
          total_rows: number
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          size_bytes?: number
          status?: string
          storage_path: string
          tables_included?: string[]
          total_rows?: number
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          tables_included?: string[]
          total_rows?: number
          triggered_by?: string | null
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
      delegate_callback_requests: {
        Row: {
          auth_user_id: string | null
          buyer_profile: string | null
          country_code: string | null
          created_at: string
          customer_id: string | null
          delegate_id: string
          handled_at: string | null
          id: string
          message: string | null
          postal_code: string | null
          preferred_language: string | null
          preferred_slot: string | null
          requester_company: string | null
          requester_email: string
          requester_first_name: string | null
          requester_last_name: string | null
          requester_phone: string
          status: string
          updated_at: string
          vendor_id: string
          vendor_notes: string | null
        }
        Insert: {
          auth_user_id?: string | null
          buyer_profile?: string | null
          country_code?: string | null
          created_at?: string
          customer_id?: string | null
          delegate_id: string
          handled_at?: string | null
          id?: string
          message?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          preferred_slot?: string | null
          requester_company?: string | null
          requester_email: string
          requester_first_name?: string | null
          requester_last_name?: string | null
          requester_phone: string
          status?: string
          updated_at?: string
          vendor_id: string
          vendor_notes?: string | null
        }
        Update: {
          auth_user_id?: string | null
          buyer_profile?: string | null
          country_code?: string | null
          created_at?: string
          customer_id?: string | null
          delegate_id?: string
          handled_at?: string | null
          id?: string
          message?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          preferred_slot?: string | null
          requester_company?: string | null
          requester_email?: string
          requester_first_name?: string | null
          requester_last_name?: string | null
          requester_phone?: string
          status?: string
          updated_at?: string
          vendor_id?: string
          vendor_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delegate_callback_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegate_callback_requests_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "vendor_delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegate_callback_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "delegate_callback_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "delegate_callback_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegate_callback_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "delegate_callback_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "delegate_callback_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegate_callback_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "discount_tiers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
          },
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
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_tiers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
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
      email_template_overrides: {
        Row: {
          created_at: string
          custom_body_html: string | null
          custom_subject: string | null
          enabled: boolean
          template_name: string
          trigger_event: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          custom_body_html?: string | null
          custom_subject?: string | null
          enabled?: boolean
          template_name: string
          trigger_event?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          custom_body_html?: string | null
          custom_subject?: string | null
          enabled?: boolean
          template_name?: string
          trigger_event?: string | null
          updated_at?: string
          updated_by?: string | null
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
            foreignKeyName: "external_leads_external_offer_id_fkey"
            columns: ["external_offer_id"]
            isOneToOne: false
            referencedRelation: "external_offers_with_exclusivity_v"
            referencedColumns: ["external_offer_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "external_leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "external_leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
          pack_size_override: number | null
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
          pack_size_override?: number | null
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
          pack_size_override?: number | null
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "external_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "external_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "favorite_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "favorite_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "flash_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "flash_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      gamme_demand_signals: {
        Row: {
          brand_slug: string
          buyer_id: string
          buyer_net_price_cents: number
          cnk_requested: string
          created_at: string
          expires_at: string
          fulfilled_at: string | null
          fulfilled_by_seller_id: string | null
          id: string
          invoice_line_id: string | null
          notified_seller_ids: string[] | null
          product_label_extracted: string
          quantity: number | null
          status: string
          target_price_hint_cents: number
          updated_at: string
        }
        Insert: {
          brand_slug: string
          buyer_id: string
          buyer_net_price_cents: number
          cnk_requested: string
          created_at?: string
          expires_at: string
          fulfilled_at?: string | null
          fulfilled_by_seller_id?: string | null
          id?: string
          invoice_line_id?: string | null
          notified_seller_ids?: string[] | null
          product_label_extracted: string
          quantity?: number | null
          status?: string
          target_price_hint_cents: number
          updated_at?: string
        }
        Update: {
          brand_slug?: string
          buyer_id?: string
          buyer_net_price_cents?: number
          cnk_requested?: string
          created_at?: string
          expires_at?: string
          fulfilled_at?: string | null
          fulfilled_by_seller_id?: string | null
          id?: string
          invoice_line_id?: string | null
          notified_seller_ids?: string[] | null
          product_label_extracted?: string
          quantity?: number | null
          status?: string
          target_price_hint_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamme_demand_signals_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamme_demand_signals_invoice_line_id_fkey"
            columns: ["invoice_line_id"]
            isOneToOne: false
            referencedRelation: "imported_invoice_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      geocode_cache: {
        Row: {
          cache_key: string
          city: string | null
          country_code: string | null
          created_at: string
          hit_count: number
          last_used_at: string
          lat: number | null
          lng: number | null
          postal_code: string | null
          provider: string
          query: string
          updated_at: string
        }
        Insert: {
          cache_key: string
          city?: string | null
          country_code?: string | null
          created_at?: string
          hit_count?: number
          last_used_at?: string
          lat?: number | null
          lng?: number | null
          postal_code?: string | null
          provider?: string
          query: string
          updated_at?: string
        }
        Update: {
          cache_key?: string
          city?: string | null
          country_code?: string | null
          created_at?: string
          hit_count?: number
          last_used_at?: string
          lat?: number | null
          lng?: number | null
          postal_code?: string | null
          provider?: string
          query?: string
          updated_at?: string
        }
        Relationships: []
      }
      home_featured_brands: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          id: string
          locale: Database["public"]["Enums"]["home_featured_locale"]
          position: number
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["home_featured_locale"]
          position?: number
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["home_featured_locale"]
          position?: number
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_featured_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "home_featured_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "home_featured_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "home_featured_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_featured_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      home_featured_category_whitelist: {
        Row: {
          added_at: string
          added_by: string | null
          category_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          category_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_featured_category_whitelist_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_featured_category_whitelist_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "home_featured_category_whitelist_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      home_featured_products: {
        Row: {
          badge: Database["public"]["Enums"]["home_featured_badge"] | null
          created_at: string
          created_by: string | null
          id: string
          locale: Database["public"]["Enums"]["home_featured_locale"]
          position: number
          product_id: string
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          badge?: Database["public"]["Enums"]["home_featured_badge"] | null
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["home_featured_locale"]
          position?: number
          product_id: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          badge?: Database["public"]["Enums"]["home_featured_badge"] | null
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["home_featured_locale"]
          position?: number
          product_id?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "home_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "home_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      home_showcase_events: {
        Row: {
          country_code: string | null
          delta_pct: number | null
          id: number
          kind: string
          locale: string | null
          occurred_at: string
          offer_count: number | null
          product_id: string | null
          session_id: string | null
          user_id: string | null
          variant: string
        }
        Insert: {
          country_code?: string | null
          delta_pct?: number | null
          id?: number
          kind: string
          locale?: string | null
          occurred_at?: string
          offer_count?: number | null
          product_id?: string | null
          session_id?: string | null
          user_id?: string | null
          variant: string
        }
        Update: {
          country_code?: string | null
          delta_pct?: number | null
          id?: number
          kind?: string
          locale?: string | null
          occurred_at?: string
          offer_count?: number | null
          product_id?: string | null
          session_id?: string | null
          user_id?: string | null
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_showcase_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "home_showcase_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_showcase_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "home_showcase_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_showcase_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_showcase_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      home_showcase_settings: {
        Row: {
          demo_cta_product_gtin: string | null
          demo_cta_product_id: string | null
          id: boolean
          pinned_product_gtin: string | null
          pinned_product_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          demo_cta_product_gtin?: string | null
          demo_cta_product_id?: string | null
          id?: boolean
          pinned_product_gtin?: string | null
          pinned_product_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          demo_cta_product_gtin?: string | null
          demo_cta_product_id?: string | null
          id?: boolean
          pinned_product_gtin?: string | null
          pinned_product_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_showcase_settings_demo_cta_product_id_fkey"
            columns: ["demo_cta_product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "home_showcase_settings_demo_cta_product_id_fkey"
            columns: ["demo_cta_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_showcase_settings_demo_cta_product_id_fkey"
            columns: ["demo_cta_product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "home_showcase_settings_demo_cta_product_id_fkey"
            columns: ["demo_cta_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_showcase_settings_demo_cta_product_id_fkey"
            columns: ["demo_cta_product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_showcase_settings_demo_cta_product_id_fkey"
            columns: ["demo_cta_product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "home_showcase_settings_pinned_product_id_fkey"
            columns: ["pinned_product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "home_showcase_settings_pinned_product_id_fkey"
            columns: ["pinned_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_showcase_settings_pinned_product_id_fkey"
            columns: ["pinned_product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "home_showcase_settings_pinned_product_id_fkey"
            columns: ["pinned_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_showcase_settings_pinned_product_id_fkey"
            columns: ["pinned_product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_showcase_settings_pinned_product_id_fkey"
            columns: ["pinned_product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      import_job_payload: {
        Row: {
          created_at: string
          errors: Json
          job_id: string
          results: Json
          rows: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          errors?: Json
          job_id: string
          results?: Json
          rows?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          errors?: Json
          job_id?: string
          results?: Json
          rows?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_job_payload_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          created_count: number
          error_message: string | null
          file_name: string | null
          file_size_bytes: number | null
          finished_at: string | null
          found_count: number
          id: string
          job_type: Database["public"]["Enums"]["import_job_type"]
          metadata: Json
          processed_rows: number
          rejected_count: number
          result_summary: Json
          started_at: string | null
          status: Database["public"]["Enums"]["import_job_status"]
          total_rows: number
          unavailable_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_count?: number
          error_message?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          finished_at?: string | null
          found_count?: number
          id?: string
          job_type: Database["public"]["Enums"]["import_job_type"]
          metadata?: Json
          processed_rows?: number
          rejected_count?: number
          result_summary?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_job_status"]
          total_rows?: number
          unavailable_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_count?: number
          error_message?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          finished_at?: string | null
          found_count?: number
          id?: string
          job_type?: Database["public"]["Enums"]["import_job_type"]
          metadata?: Json
          processed_rows?: number
          rejected_count?: number
          result_summary?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_job_status"]
          total_rows?: number
          unavailable_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      imported_invoice_lines: {
        Row: {
          alignment_request_id: string | null
          alternative_matches_json: Json | null
          anomaly_reasons: string[] | null
          applied_discount_pct: number | null
          brand_extracted: string | null
          created_at: string
          discount_source: string | null
          eligibility_category: string | null
          gamme_demand_signal_id: string | null
          historical_avg_price_cents: number | null
          id: string
          invoice_id: string
          is_anomalous: boolean
          line_index: number
          line_savings_cents: number | null
          line_savings_pct: number | null
          match_confidence: string | null
          match_method: string | null
          match_score: number | null
          matched_product_id: string | null
          medikong_best_price_cents: number | null
          medikong_status: string | null
          net_total_ht_cents: number | null
          net_unit_price_ht_cents: number | null
          quantity: number | null
          raw_cnk: string | null
          raw_description: string | null
          raw_discount_pct: number | null
          raw_ean: string | null
          raw_quantity: number | null
          raw_total_ht_cents: number | null
          raw_unit_price_ht_cents: number | null
          raw_vat_amount_cents: number | null
          raw_vat_rate: number | null
          total_ht_cents: number | null
          unit_price_ht_cents: number | null
          vat_amount_cents: number | null
          vat_rate: number | null
        }
        Insert: {
          alignment_request_id?: string | null
          alternative_matches_json?: Json | null
          anomaly_reasons?: string[] | null
          applied_discount_pct?: number | null
          brand_extracted?: string | null
          created_at?: string
          discount_source?: string | null
          eligibility_category?: string | null
          gamme_demand_signal_id?: string | null
          historical_avg_price_cents?: number | null
          id?: string
          invoice_id: string
          is_anomalous?: boolean
          line_index: number
          line_savings_cents?: number | null
          line_savings_pct?: number | null
          match_confidence?: string | null
          match_method?: string | null
          match_score?: number | null
          matched_product_id?: string | null
          medikong_best_price_cents?: number | null
          medikong_status?: string | null
          net_total_ht_cents?: number | null
          net_unit_price_ht_cents?: number | null
          quantity?: number | null
          raw_cnk?: string | null
          raw_description?: string | null
          raw_discount_pct?: number | null
          raw_ean?: string | null
          raw_quantity?: number | null
          raw_total_ht_cents?: number | null
          raw_unit_price_ht_cents?: number | null
          raw_vat_amount_cents?: number | null
          raw_vat_rate?: number | null
          total_ht_cents?: number | null
          unit_price_ht_cents?: number | null
          vat_amount_cents?: number | null
          vat_rate?: number | null
        }
        Update: {
          alignment_request_id?: string | null
          alternative_matches_json?: Json | null
          anomaly_reasons?: string[] | null
          applied_discount_pct?: number | null
          brand_extracted?: string | null
          created_at?: string
          discount_source?: string | null
          eligibility_category?: string | null
          gamme_demand_signal_id?: string | null
          historical_avg_price_cents?: number | null
          id?: string
          invoice_id?: string
          is_anomalous?: boolean
          line_index?: number
          line_savings_cents?: number | null
          line_savings_pct?: number | null
          match_confidence?: string | null
          match_method?: string | null
          match_score?: number | null
          matched_product_id?: string | null
          medikong_best_price_cents?: number | null
          medikong_status?: string | null
          net_total_ht_cents?: number | null
          net_unit_price_ht_cents?: number | null
          quantity?: number | null
          raw_cnk?: string | null
          raw_description?: string | null
          raw_discount_pct?: number | null
          raw_ean?: string | null
          raw_quantity?: number | null
          raw_total_ht_cents?: number | null
          raw_unit_price_ht_cents?: number | null
          raw_vat_amount_cents?: number | null
          raw_vat_rate?: number | null
          total_ht_cents?: number | null
          unit_price_ht_cents?: number | null
          vat_amount_cents?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "imported_invoice_lines_eligibility_category_fkey"
            columns: ["eligibility_category"]
            isOneToOne: false
            referencedRelation: "product_eligibility_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "imported_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "imported_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_invoices: {
        Row: {
          analysis_json: Json | null
          buyer_id: string
          created_at: string
          currency: string
          due_date: string | null
          eligible_lines_count: number | null
          excluded_lines_count: number | null
          exported_csv_at: string | null
          exported_pdf_at: string | null
          exported_to_peppol_invoice_id: string | null
          extraction_completed_at: string | null
          extraction_cost_eur: number | null
          extraction_error: string | null
          extraction_model: string | null
          extraction_started_at: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          known_supplier_id: string | null
          matched_eligible_lines_count: number | null
          net_total_ht_cents: number | null
          onboarding_complete: boolean
          potential_savings_cents: number | null
          source_hash: string | null
          source_pages: number | null
          source_size_bytes: number | null
          source_type: string
          source_url: string
          status: string
          supplier_name: string | null
          supplier_vat_number: string | null
          total_ht_cents: number | null
          total_ttc_cents: number | null
          total_vat_cents: number | null
          updated_at: string
          user_id: string
          wholesaler_profile_id: string | null
        }
        Insert: {
          analysis_json?: Json | null
          buyer_id: string
          created_at?: string
          currency?: string
          due_date?: string | null
          eligible_lines_count?: number | null
          excluded_lines_count?: number | null
          exported_csv_at?: string | null
          exported_pdf_at?: string | null
          exported_to_peppol_invoice_id?: string | null
          extraction_completed_at?: string | null
          extraction_cost_eur?: number | null
          extraction_error?: string | null
          extraction_model?: string | null
          extraction_started_at?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          known_supplier_id?: string | null
          matched_eligible_lines_count?: number | null
          net_total_ht_cents?: number | null
          onboarding_complete?: boolean
          potential_savings_cents?: number | null
          source_hash?: string | null
          source_pages?: number | null
          source_size_bytes?: number | null
          source_type: string
          source_url: string
          status?: string
          supplier_name?: string | null
          supplier_vat_number?: string | null
          total_ht_cents?: number | null
          total_ttc_cents?: number | null
          total_vat_cents?: number | null
          updated_at?: string
          user_id: string
          wholesaler_profile_id?: string | null
        }
        Update: {
          analysis_json?: Json | null
          buyer_id?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          eligible_lines_count?: number | null
          excluded_lines_count?: number | null
          exported_csv_at?: string | null
          exported_pdf_at?: string | null
          exported_to_peppol_invoice_id?: string | null
          extraction_completed_at?: string | null
          extraction_cost_eur?: number | null
          extraction_error?: string | null
          extraction_model?: string | null
          extraction_started_at?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          known_supplier_id?: string | null
          matched_eligible_lines_count?: number | null
          net_total_ht_cents?: number | null
          onboarding_complete?: boolean
          potential_savings_cents?: number | null
          source_hash?: string | null
          source_pages?: number | null
          source_size_bytes?: number | null
          source_type?: string
          source_url?: string
          status?: string
          supplier_name?: string | null
          supplier_vat_number?: string | null
          total_ht_cents?: number | null
          total_ttc_cents?: number | null
          total_vat_cents?: number | null
          updated_at?: string
          user_id?: string
          wholesaler_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imported_invoices_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_invoices_known_supplier_id_fkey"
            columns: ["known_supplier_id"]
            isOneToOne: false
            referencedRelation: "known_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_invoices_wholesaler_profile_id_fkey"
            columns: ["wholesaler_profile_id"]
            isOneToOne: false
            referencedRelation: "wholesaler_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      known_suppliers: {
        Row: {
          created_at: string
          detection_patterns: Json | null
          id: string
          layout_hints_json: Json | null
          name: string
          notes: string | null
          template_active: boolean
          vat_number: string | null
        }
        Insert: {
          created_at?: string
          detection_patterns?: Json | null
          id?: string
          layout_hints_json?: Json | null
          name: string
          notes?: string | null
          template_active?: boolean
          vat_number?: string | null
        }
        Update: {
          created_at?: string
          detection_patterns?: Json | null
          id?: string
          layout_hints_json?: Json | null
          name?: string
          notes?: string | null
          template_active?: boolean
          vat_number?: string | null
        }
        Relationships: []
      }
      manufacturers: {
        Row: {
          aliases: string[] | null
          brand_count: number | null
          certifications: string[] | null
          country_of_origin: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          description_en: string | null
          gallery_images: Json
          id: string
          is_active: boolean | null
          legal_name: string | null
          logo_url: string | null
          name: string
          norm_key: string | null
          product_count: number | null
          proposed_by_vendor_id: string | null
          qogita_qid: string | null
          slug: string
          social_links: Json
          specialties: string[] | null
          submission_approved_at: string | null
          submission_approved_by: string | null
          submission_rejected_reason: string | null
          submission_status:
            | Database["public"]["Enums"]["catalog_submission_status"]
            | null
          synced_at: string | null
          updated_at: string | null
          website_url: string | null
          year_founded: number | null
        }
        Insert: {
          aliases?: string[] | null
          brand_count?: number | null
          certifications?: string[] | null
          country_of_origin?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          gallery_images?: Json
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          norm_key?: string | null
          product_count?: number | null
          proposed_by_vendor_id?: string | null
          qogita_qid?: string | null
          slug: string
          social_links?: Json
          specialties?: string[] | null
          submission_approved_at?: string | null
          submission_approved_by?: string | null
          submission_rejected_reason?: string | null
          submission_status?:
            | Database["public"]["Enums"]["catalog_submission_status"]
            | null
          synced_at?: string | null
          updated_at?: string | null
          website_url?: string | null
          year_founded?: number | null
        }
        Update: {
          aliases?: string[] | null
          brand_count?: number | null
          certifications?: string[] | null
          country_of_origin?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          gallery_images?: Json
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          norm_key?: string | null
          product_count?: number | null
          proposed_by_vendor_id?: string | null
          qogita_qid?: string | null
          slug?: string
          social_links?: Json
          specialties?: string[] | null
          submission_approved_at?: string | null
          submission_approved_by?: string | null
          submission_rejected_reason?: string | null
          submission_status?:
            | Database["public"]["Enums"]["catalog_submission_status"]
            | null
          synced_at?: string | null
          updated_at?: string | null
          website_url?: string | null
          year_founded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "manufacturers_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "manufacturers_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "manufacturers_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturers_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "manufacturers_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "manufacturers_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturers_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_rule_tiers: {
        Row: {
          created_at: string
          id: string
          label: string | null
          margin_percentage: number
          margin_rule_id: string
          min_gmv_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          margin_percentage: number
          margin_rule_id: string
          min_gmv_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          margin_percentage?: number
          margin_rule_id?: string
          min_gmv_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "margin_rule_tiers_margin_rule_id_fkey"
            columns: ["margin_rule_id"]
            isOneToOne: false
            referencedRelation: "margin_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_rules: {
        Row: {
          brand_id: string | null
          category_id: string | null
          commission_payment_delay_days: number
          created_at: string
          extra_delay_days: number
          gmv_window: string
          id: string
          is_active: boolean
          margin_percentage: number
          max_base_price: number | null
          min_base_price: number | null
          name: string
          priority: number
          round_price_to: number
          tiers_direction: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          commission_payment_delay_days?: number
          created_at?: string
          extra_delay_days?: number
          gmv_window?: string
          id?: string
          is_active?: boolean
          margin_percentage?: number
          max_base_price?: number | null
          min_base_price?: number | null
          name: string
          priority?: number
          round_price_to?: number
          tiers_direction?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          commission_payment_delay_days?: number
          created_at?: string
          extra_delay_days?: number
          gmv_window?: string
          id?: string
          is_active?: boolean
          margin_percentage?: number
          max_base_price?: number | null
          min_base_price?: number | null
          name?: string
          priority?: number
          round_price_to?: number
          tiers_direction?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "margin_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "margin_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "margin_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "margin_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "margin_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "margin_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "margin_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "margin_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "margin_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      market_delta_anomalies: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          delta_abs: number
          delta_pct: number
          detected_at: string
          direction: string
          id: string
          market_sample_size: number
          market_unit_price_median: number
          mk_pack_size: number
          mk_unit_price: number
          notes: string | null
          notes_updated_at: string | null
          notes_updated_by: string | null
          offer_id: string
          product_id: string
          resolved_at: string | null
          resolved_by: string | null
          run_id: string
          status: string
          threshold_pct: number
          vendor_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          delta_abs: number
          delta_pct: number
          detected_at?: string
          direction: string
          id?: string
          market_sample_size: number
          market_unit_price_median: number
          mk_pack_size: number
          mk_unit_price: number
          notes?: string | null
          notes_updated_at?: string | null
          notes_updated_by?: string | null
          offer_id: string
          product_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          run_id: string
          status?: string
          threshold_pct: number
          vendor_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          delta_abs?: number
          delta_pct?: number
          detected_at?: string
          direction?: string
          id?: string
          market_sample_size?: number
          market_unit_price_median?: number
          mk_pack_size?: number
          mk_unit_price?: number
          notes?: string | null
          notes_updated_at?: string | null
          notes_updated_by?: string | null
          offer_id?: string
          product_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string
          status?: string
          threshold_pct?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_delta_anomalies_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_anomalies_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      market_delta_runs: {
        Row: {
          anomalies_found: number
          error: string | null
          finished_at: string | null
          id: string
          offers_scanned: number
          offers_with_market: number
          started_at: string
          threshold_pct: number
          triggered_by: string
        }
        Insert: {
          anomalies_found?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          offers_scanned?: number
          offers_with_market?: number
          started_at?: string
          threshold_pct: number
          triggered_by?: string
        }
        Update: {
          anomalies_found?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          offers_scanned?: number
          offers_with_market?: number
          started_at?: string
          threshold_pct?: number
          triggered_by?: string
        }
        Relationships: []
      }
      market_delta_thresholds: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          product_id: string | null
          scope: string
          threshold_pct: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id?: string | null
          scope: string
          threshold_pct: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id?: string | null
          scope?: string
          threshold_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_delta_thresholds_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_thresholds_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "market_delta_thresholds_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_thresholds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_delta_thresholds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_thresholds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_delta_thresholds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_thresholds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_delta_thresholds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      market_price_observations: {
        Row: {
          created_at: string
          id: string
          observed_quantity: number | null
          observed_unit_price_excl_vat: number
          pharmacy_size_bucket: string | null
          product_id: string | null
          region: string | null
          source_supplier: string
          week_observed: string
        }
        Insert: {
          created_at?: string
          id?: string
          observed_quantity?: number | null
          observed_unit_price_excl_vat: number
          pharmacy_size_bucket?: string | null
          product_id?: string | null
          region?: string | null
          source_supplier: string
          week_observed: string
        }
        Update: {
          created_at?: string
          id?: string
          observed_quantity?: number | null
          observed_unit_price_excl_vat?: number
          pharmacy_size_bucket?: string | null
          product_id?: string | null
          region?: string | null
          source_supplier?: string
          week_observed?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_price_observations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_price_observations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_observations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_price_observations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_observations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_observations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      market_price_pack_anomalies: {
        Row: {
          admin_note: string | null
          cnk: string | null
          created_at: string
          current_pack_size: number | null
          current_raw_title: string | null
          detected_at: string
          ean: string | null
          id: string
          pack_ratio: number | null
          previous_pack_size: number | null
          previous_raw_title: string | null
          product_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string
          status: string
        }
        Insert: {
          admin_note?: string | null
          cnk?: string | null
          created_at?: string
          current_pack_size?: number | null
          current_raw_title?: string | null
          detected_at?: string
          ean?: string | null
          id?: string
          pack_ratio?: number | null
          previous_pack_size?: number | null
          previous_raw_title?: string | null
          product_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id: string
          status?: string
        }
        Update: {
          admin_note?: string | null
          cnk?: string | null
          created_at?: string
          current_pack_size?: number | null
          current_raw_title?: string | null
          detected_at?: string
          ean?: string | null
          id?: string
          pack_ratio?: number | null
          previous_pack_size?: number | null
          previous_raw_title?: string | null
          product_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_price_pack_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_price_pack_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_pack_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_price_pack_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_pack_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_pack_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_price_pack_anomalies_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "market_price_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      market_price_pack_history: {
        Row: {
          cnk: string | null
          created_at: string
          ean: string | null
          id: string
          last_pack_size: number | null
          last_raw_title: string | null
          last_seen_at: string
          product_id: string | null
          source_id: string
          updated_at: string
        }
        Insert: {
          cnk?: string | null
          created_at?: string
          ean?: string | null
          id?: string
          last_pack_size?: number | null
          last_raw_title?: string | null
          last_seen_at?: string
          product_id?: string | null
          source_id: string
          updated_at?: string
        }
        Update: {
          cnk?: string | null
          created_at?: string
          ean?: string | null
          id?: string
          last_pack_size?: number | null
          last_raw_title?: string | null
          last_seen_at?: string
          product_id?: string | null
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_price_pack_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_price_pack_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_pack_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_price_pack_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_pack_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_pack_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_price_pack_history_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "market_price_sources"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
      marketplace_guarantee_versions: {
        Row: {
          body_md: string
          bullet_points: string[]
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          published_at: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body_md?: string
          bullet_points?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
          version: number
        }
        Update: {
          body_md?: string
          bullet_points?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["media_asset_type"]
          brand_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          file_path: string
          file_size_bytes: number | null
          id: string
          is_active: boolean
          language: string
          manufacturer_id: string | null
          mime_type: string | null
          page_count: number | null
          published_at: string | null
          sort_order: number
          tags: string[]
          thumbnail_path: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["media_visibility"]
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["media_asset_type"]
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_path: string
          file_size_bytes?: number | null
          id?: string
          is_active?: boolean
          language?: string
          manufacturer_id?: string | null
          mime_type?: string | null
          page_count?: number | null
          published_at?: string | null
          sort_order?: number
          tags?: string[]
          thumbnail_path?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["media_visibility"]
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["media_asset_type"]
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          is_active?: boolean
          language?: string
          manufacturer_id?: string | null
          mime_type?: string | null
          page_count?: number | null
          published_at?: string | null
          sort_order?: number
          tags?: string[]
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["media_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "media_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "media_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "media_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "media_assets_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      media_banners: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_url: string | null
          enabled: boolean
          ends_at: string | null
          id: string
          logo_url: string | null
          name: string
          partner_name: string | null
          priority: number
          scope: string
          starts_at: string | null
          subtitle: string | null
          target_brand_ids: string[]
          target_manufacturer_ids: string[]
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          partner_name?: string | null
          priority?: number
          scope?: string
          starts_at?: string | null
          subtitle?: string | null
          target_brand_ids?: string[]
          target_manufacturer_ids?: string[]
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          partner_name?: string | null
          priority?: number
          scope?: string
          starts_at?: string | null
          subtitle?: string | null
          target_brand_ids?: string[]
          target_manufacturer_ids?: string[]
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      media_downloads: {
        Row: {
          country_code: string | null
          downloaded_at: string
          id: string
          ip_address: unknown
          media_asset_id: string
          profile_id: string | null
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          country_code?: string | null
          downloaded_at?: string
          id?: string
          ip_address?: unknown
          media_asset_id: string
          profile_id?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          country_code?: string | null
          downloaded_at?: string
          id?: string
          ip_address?: unknown
          media_asset_id?: string
          profile_id?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_downloads_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_downloads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      media_library: {
        Row: {
          alt_text: string | null
          created_at: string
          description: string | null
          filename: string
          folder: string
          height: number | null
          id: string
          mime_type: string
          sha256: string
          size_bytes: number
          storage_path: string
          tags: string[]
          title: string | null
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          description?: string | null
          filename: string
          folder?: string
          height?: number | null
          id?: string
          mime_type: string
          sha256: string
          size_bytes: number
          storage_path: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          description?: string | null
          filename?: string
          folder?: string
          height?: number | null
          id?: string
          mime_type?: string
          sha256?: string
          size_bytes?: number
          storage_path?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: []
      }
      media_library_links: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["media_link_entity"]
          id: string
          media_id: string
          role: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["media_link_entity"]
          id?: string
          media_id: string
          role?: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["media_link_entity"]
          id?: string
          media_id?: string
          role?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_library_links_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_library"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_buyer_profile_prices: {
        Row: {
          buyer_profile_id: string
          country_code: string | null
          created_at: string
          discount_pct: number | null
          id: string
          is_active: boolean
          min_order_quantity: number | null
          min_order_value_cents: number | null
          offer_id: string
          price_excl_vat: number | null
          pricing_mode: string
          updated_at: string
        }
        Insert: {
          buyer_profile_id: string
          country_code?: string | null
          created_at?: string
          discount_pct?: number | null
          id?: string
          is_active?: boolean
          min_order_quantity?: number | null
          min_order_value_cents?: number | null
          offer_id: string
          price_excl_vat?: number | null
          pricing_mode?: string
          updated_at?: string
        }
        Update: {
          buyer_profile_id?: string
          country_code?: string | null
          created_at?: string
          discount_pct?: number | null
          id?: string
          is_active?: boolean
          min_order_quantity?: number | null
          min_order_value_cents?: number | null
          offer_id?: string
          price_excl_vat?: number | null
          pricing_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_buyer_profile_prices_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "buyer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_buyer_profile_prices_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["buyer_profile_id"]
          },
          {
            foreignKeyName: "offer_buyer_profile_prices_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "offer_buyer_profile_prices_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "offer_buyer_profile_prices_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_buyer_profile_prices_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_buyer_profile_prices_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "offer_buyer_profile_prices_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
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
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "offer_categories_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
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
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_categories_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
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
      offer_data_quality_logs: {
        Row: {
          details: Json | null
          first_seen_at: string
          id: string
          issue_code: string
          last_seen_at: string
          occurrence_count: number
          offer_id: string | null
          product_id: string | null
          resolved_at: string | null
        }
        Insert: {
          details?: Json | null
          first_seen_at?: string
          id?: string
          issue_code: string
          last_seen_at?: string
          occurrence_count?: number
          offer_id?: string | null
          product_id?: string | null
          resolved_at?: string | null
        }
        Update: {
          details?: Json | null
          first_seen_at?: string
          id?: string
          issue_code?: string
          last_seen_at?: string
          occurrence_count?: number
          offer_id?: string | null
          product_id?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_data_quality_logs_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "offer_data_quality_logs_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "offer_data_quality_logs_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_data_quality_logs_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_data_quality_logs_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "offer_data_quality_logs_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_data_quality_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offer_data_quality_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_data_quality_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offer_data_quality_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_data_quality_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_data_quality_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
          },
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
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offer_margin_snapshots_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "offer_price_tiers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
          },
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
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_price_tiers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
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
      offers: {
        Row: {
          admin_hidden: boolean
          admin_hidden_at: string | null
          admin_hidden_by: string | null
          admin_hidden_reason: string | null
          applied_margin_percentage: number | null
          applied_margin_rule_id: string | null
          campaign_id: string | null
          carton_size_override: number | null
          commission_model: string | null
          commission_override_created_via_admin_shortcut: boolean
          commission_override_reason: string | null
          commission_override_status:
            | Database["public"]["Enums"]["commission_override_status"]
            | null
          commission_override_updated_at: string | null
          commission_override_updated_by: string | null
          commission_rate: number | null
          commission_valid_from: string | null
          commission_valid_until: string | null
          country_code: string | null
          country_codes: string[]
          created_at: string
          delivery_days: number | null
          down_payment_pct: number | null
          estimated_delivery_days: number | null
          fixed_commission_amount: number | null
          has_extended_delivery: boolean | null
          id: string
          is_active: boolean
          is_qogita_backed: boolean
          is_top_seller: boolean | null
          is_traceable: boolean | null
          last_sync_run_id: string | null
          margin_amount: number | null
          margin_split_pct: number | null
          max_delivery_days: number | null
          min_delivery_days: number | null
          moq: number
          mov: number | null
          mov_amount: number | null
          mov_currency: string | null
          pack_size_override: number | null
          packaging_languages: string[] | null
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
          source_supplier: string | null
          stock_quantity: number
          stock_status: Database["public"]["Enums"]["stock_status_enum"]
          suggested_retail_price_cents: number | null
          suggested_retail_price_source:
            | Database["public"]["Enums"]["pvp_source_enum"]
            | null
          synced_at: string | null
          updated_at: string
          vat_rate: number
          vendor_id: string
          vendor_note: string | null
        }
        Insert: {
          admin_hidden?: boolean
          admin_hidden_at?: string | null
          admin_hidden_by?: string | null
          admin_hidden_reason?: string | null
          applied_margin_percentage?: number | null
          applied_margin_rule_id?: string | null
          campaign_id?: string | null
          carton_size_override?: number | null
          commission_model?: string | null
          commission_override_created_via_admin_shortcut?: boolean
          commission_override_reason?: string | null
          commission_override_status?:
            | Database["public"]["Enums"]["commission_override_status"]
            | null
          commission_override_updated_at?: string | null
          commission_override_updated_by?: string | null
          commission_rate?: number | null
          commission_valid_from?: string | null
          commission_valid_until?: string | null
          country_code?: string | null
          country_codes?: string[]
          created_at?: string
          delivery_days?: number | null
          down_payment_pct?: number | null
          estimated_delivery_days?: number | null
          fixed_commission_amount?: number | null
          has_extended_delivery?: boolean | null
          id?: string
          is_active?: boolean
          is_qogita_backed?: boolean
          is_top_seller?: boolean | null
          is_traceable?: boolean | null
          last_sync_run_id?: string | null
          margin_amount?: number | null
          margin_split_pct?: number | null
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          moq?: number
          mov?: number | null
          mov_amount?: number | null
          mov_currency?: string | null
          pack_size_override?: number | null
          packaging_languages?: string[] | null
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
          source_supplier?: string | null
          stock_quantity?: number
          stock_status?: Database["public"]["Enums"]["stock_status_enum"]
          suggested_retail_price_cents?: number | null
          suggested_retail_price_source?:
            | Database["public"]["Enums"]["pvp_source_enum"]
            | null
          synced_at?: string | null
          updated_at?: string
          vat_rate?: number
          vendor_id: string
          vendor_note?: string | null
        }
        Update: {
          admin_hidden?: boolean
          admin_hidden_at?: string | null
          admin_hidden_by?: string | null
          admin_hidden_reason?: string | null
          applied_margin_percentage?: number | null
          applied_margin_rule_id?: string | null
          campaign_id?: string | null
          carton_size_override?: number | null
          commission_model?: string | null
          commission_override_created_via_admin_shortcut?: boolean
          commission_override_reason?: string | null
          commission_override_status?:
            | Database["public"]["Enums"]["commission_override_status"]
            | null
          commission_override_updated_at?: string | null
          commission_override_updated_by?: string | null
          commission_rate?: number | null
          commission_valid_from?: string | null
          commission_valid_until?: string | null
          country_code?: string | null
          country_codes?: string[]
          created_at?: string
          delivery_days?: number | null
          down_payment_pct?: number | null
          estimated_delivery_days?: number | null
          fixed_commission_amount?: number | null
          has_extended_delivery?: boolean | null
          id?: string
          is_active?: boolean
          is_qogita_backed?: boolean
          is_top_seller?: boolean | null
          is_traceable?: boolean | null
          last_sync_run_id?: string | null
          margin_amount?: number | null
          margin_split_pct?: number | null
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          moq?: number
          mov?: number | null
          mov_amount?: number | null
          mov_currency?: string | null
          pack_size_override?: number | null
          packaging_languages?: string[] | null
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
          source_supplier?: string | null
          stock_quantity?: number
          stock_status?: Database["public"]["Enums"]["stock_status_enum"]
          suggested_retail_price_cents?: number | null
          suggested_retail_price_source?:
            | Database["public"]["Enums"]["pvp_source_enum"]
            | null
          synced_at?: string | null
          updated_at?: string
          vat_rate?: number
          vendor_id?: string
          vendor_note?: string | null
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
            foreignKeyName: "offers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "vendor_offer_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      order_invoices: {
        Row: {
          amount_excl_vat: number
          amount_incl_vat: number
          created_at: string
          error_message: string | null
          hosted_url: string | null
          id: string
          invoice_number: string | null
          issued_at: string | null
          order_id: string
          paid_at: string | null
          pdf_path: string | null
          pdf_url: string | null
          peppol_document_id: string | null
          peppol_error: string | null
          peppol_identifier: string | null
          peppol_last_attempt_at: string | null
          peppol_retry_count: number
          peppol_status: string | null
          peppol_submitted_at: string | null
          status: string
          stripe_customer_id: string | null
          stripe_invoice_id: string | null
          type: string
          updated_at: string
          vat_amount: number
          vendor_id: string
        }
        Insert: {
          amount_excl_vat?: number
          amount_incl_vat?: number
          created_at?: string
          error_message?: string | null
          hosted_url?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          order_id: string
          paid_at?: string | null
          pdf_path?: string | null
          pdf_url?: string | null
          peppol_document_id?: string | null
          peppol_error?: string | null
          peppol_identifier?: string | null
          peppol_last_attempt_at?: string | null
          peppol_retry_count?: number
          peppol_status?: string | null
          peppol_submitted_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          type?: string
          updated_at?: string
          vat_amount?: number
          vendor_id: string
        }
        Update: {
          amount_excl_vat?: number
          amount_incl_vat?: number
          created_at?: string
          error_message?: string | null
          hosted_url?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          order_id?: string
          paid_at?: string | null
          pdf_path?: string | null
          pdf_url?: string | null
          peppol_document_id?: string | null
          peppol_error?: string | null
          peppol_identifier?: string | null
          peppol_last_attempt_at?: string | null
          peppol_retry_count?: number
          peppol_status?: string | null
          peppol_submitted_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          type?: string
          updated_at?: string
          vat_amount?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_with_forecast_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_visible_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "order_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
          },
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
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_with_forecast_v"
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
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_visible_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["sub_order_id"]
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
          buyer_confirmation_note: string | null
          buyer_confirmation_source: string | null
          buyer_confirmation_status:
            | Database["public"]["Enums"]["buyer_line_confirmation_status"]
            | null
          buyer_confirmed_at: string | null
          buyer_confirmed_quantity: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          commission_amount: number | null
          commission_basis: string | null
          commission_rate: number | null
          cost_price: number | null
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          line_cost: number | null
          line_margin: number | null
          line_total_excl_vat: number
          line_total_incl_vat: number
          manual_label: string | null
          offer_id: string | null
          order_id: string
          product_id: string | null
          qogita_offer_qid: string | null
          qogita_order_status: string
          qogita_seller_fid: string | null
          quantity: number
          quantity_shipped: number | null
          refunded_amount_incl_vat: number | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          tracking_number: string | null
          tracking_url: string | null
          unit_price_excl_vat: number
          unit_price_incl_vat: number
          updated_at: string
          vat_rate: number
          vendor_id: string
        }
        Insert: {
          buyer_confirmation_note?: string | null
          buyer_confirmation_source?: string | null
          buyer_confirmation_status?:
            | Database["public"]["Enums"]["buyer_line_confirmation_status"]
            | null
          buyer_confirmed_at?: string | null
          buyer_confirmed_quantity?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          commission_amount?: number | null
          commission_basis?: string | null
          commission_rate?: number | null
          cost_price?: number | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          line_cost?: number | null
          line_margin?: number | null
          line_total_excl_vat: number
          line_total_incl_vat: number
          manual_label?: string | null
          offer_id?: string | null
          order_id: string
          product_id?: string | null
          qogita_offer_qid?: string | null
          qogita_order_status?: string
          qogita_seller_fid?: string | null
          quantity: number
          quantity_shipped?: number | null
          refunded_amount_incl_vat?: number | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          unit_price_excl_vat: number
          unit_price_incl_vat: number
          updated_at?: string
          vat_rate: number
          vendor_id: string
        }
        Update: {
          buyer_confirmation_note?: string | null
          buyer_confirmation_source?: string | null
          buyer_confirmation_status?:
            | Database["public"]["Enums"]["buyer_line_confirmation_status"]
            | null
          buyer_confirmed_at?: string | null
          buyer_confirmed_quantity?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          commission_amount?: number | null
          commission_basis?: string | null
          commission_rate?: number | null
          cost_price?: number | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          line_cost?: number | null
          line_margin?: number | null
          line_total_excl_vat?: number
          line_total_incl_vat?: number
          manual_label?: string | null
          offer_id?: string | null
          order_id?: string
          product_id?: string | null
          qogita_offer_qid?: string | null
          qogita_order_status?: string
          qogita_seller_fid?: string | null
          quantity?: number
          quantity_shipped?: number | null
          refunded_amount_incl_vat?: number | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          unit_price_excl_vat?: number
          unit_price_incl_vat?: number
          updated_at?: string
          vat_rate?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "order_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
          },
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
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_with_forecast_v"
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
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_visible_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
          error_message: string | null
          id: string
          order_id: string
          status: string
          stripe_transfer_id: string | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          amount?: number
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          error_message?: string | null
          id?: string
          order_id: string
          status?: string
          stripe_transfer_id?: string | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          amount?: number
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          error_message?: string | null
          id?: string
          order_id?: string
          status?: string
          stripe_transfer_id?: string | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_transfers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_transfers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_with_forecast_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_transfers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_transfers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_visible_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_transfers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_transfers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_transfers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      order_vendor_sla_alerts: {
        Row: {
          alert_type: string
          created_at: string
          hours_overdue: number
          id: string
          notified_admin_at: string | null
          notified_slack_at: string | null
          notified_vendor_at: string | null
          order_id: string
          payload: Json
          resolved_at: string | null
          resolved_reason: string | null
          severity: string
          sub_order_id: string | null
          threshold_hours: number
          vendor_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          hours_overdue?: number
          id?: string
          notified_admin_at?: string | null
          notified_slack_at?: string | null
          notified_vendor_at?: string | null
          order_id: string
          payload?: Json
          resolved_at?: string | null
          resolved_reason?: string | null
          severity?: string
          sub_order_id?: string | null
          threshold_hours: number
          vendor_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          hours_overdue?: number
          id?: string
          notified_admin_at?: string | null
          notified_slack_at?: string | null
          notified_vendor_at?: string | null
          order_id?: string
          payload?: Json
          resolved_at?: string | null
          resolved_reason?: string | null
          severity?: string
          sub_order_id?: string | null
          threshold_hours?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_vendor_sla_alerts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_vendor_sla_alerts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_with_forecast_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_vendor_sla_alerts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_vendor_sla_alerts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_visible_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_vendor_sla_alerts_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["sub_order_id"]
          },
          {
            foreignKeyName: "order_vendor_sla_alerts_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_vendor_sla_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_vendor_sla_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_vendor_sla_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_vendor_sla_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_vendor_sla_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_vendor_sla_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_vendor_sla_alerts_vendor_id_fkey"
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
          created_by_admin: string | null
          customer_id: string
          customer_validated_at: string | null
          customer_validation_email: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          delivery_confirmation_completed_at: string | null
          delivery_confirmation_requested_at: string | null
          draft_fingerprint: string | null
          draft_payload: Json | null
          estimated_delivery_date: string | null
          forecast_converted_at: string | null
          forecast_created_at: string | null
          forecast_snapshot: Json | null
          fulfillment_mode: string | null
          hidden_from_list: boolean
          id: string
          is_forecast: boolean
          is_test: boolean
          notes: string | null
          order_number: string
          payment_due_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          public_access_expires_at: string | null
          public_access_pin: string | null
          public_token: string | null
          shipped_at: string | null
          shipping_address: Json
          shipping_address_id: string | null
          show_payment_info: boolean
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal_excl_vat: number
          total_cost: number | null
          total_incl_vat: number
          total_margin: number | null
          tracking_carrier: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          vat_amount: number
          was_forecast: boolean
        }
        Insert: {
          admin_notes?: string | null
          api_key_id?: string | null
          billing_address?: Json
          created_at?: string
          created_by_admin?: string | null
          customer_id: string
          customer_validated_at?: string | null
          customer_validation_email?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          delivery_confirmation_completed_at?: string | null
          delivery_confirmation_requested_at?: string | null
          draft_fingerprint?: string | null
          draft_payload?: Json | null
          estimated_delivery_date?: string | null
          forecast_converted_at?: string | null
          forecast_created_at?: string | null
          forecast_snapshot?: Json | null
          fulfillment_mode?: string | null
          hidden_from_list?: boolean
          id?: string
          is_forecast?: boolean
          is_test?: boolean
          notes?: string | null
          order_number: string
          payment_due_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          public_access_expires_at?: string | null
          public_access_pin?: string | null
          public_token?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_address_id?: string | null
          show_payment_info?: boolean
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_excl_vat?: number
          total_cost?: number | null
          total_incl_vat?: number
          total_margin?: number | null
          tracking_carrier?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vat_amount?: number
          was_forecast?: boolean
        }
        Update: {
          admin_notes?: string | null
          api_key_id?: string | null
          billing_address?: Json
          created_at?: string
          created_by_admin?: string | null
          customer_id?: string
          customer_validated_at?: string | null
          customer_validation_email?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          delivery_confirmation_completed_at?: string | null
          delivery_confirmation_requested_at?: string | null
          draft_fingerprint?: string | null
          draft_payload?: Json | null
          estimated_delivery_date?: string | null
          forecast_converted_at?: string | null
          forecast_created_at?: string | null
          forecast_snapshot?: Json | null
          fulfillment_mode?: string | null
          hidden_from_list?: boolean
          id?: string
          is_forecast?: boolean
          is_test?: boolean
          notes?: string | null
          order_number?: string
          payment_due_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          public_access_expires_at?: string | null
          public_access_pin?: string | null
          public_token?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_address_id?: string | null
          show_payment_info?: boolean
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_excl_vat?: number
          total_cost?: number | null
          total_incl_vat?: number
          total_margin?: number | null
          tracking_carrier?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vat_amount?: number
          was_forecast?: boolean
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
          {
            foreignKeyName: "orders_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "customer_shipping_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacist_wholesaler_settings: {
        Row: {
          account_number: string | null
          buyer_id: string
          configured_at: string
          contract_start_date: string | null
          created_at: string
          id: string
          is_supplier_of_pharmacist: boolean
          last_reviewed_at: string | null
          notes: string | null
          override_default_discount_pct: number | null
          override_rules_json: Json | null
          updated_at: string
          user_id: string
          wholesaler_profile_id: string
        }
        Insert: {
          account_number?: string | null
          buyer_id: string
          configured_at?: string
          contract_start_date?: string | null
          created_at?: string
          id?: string
          is_supplier_of_pharmacist?: boolean
          last_reviewed_at?: string | null
          notes?: string | null
          override_default_discount_pct?: number | null
          override_rules_json?: Json | null
          updated_at?: string
          user_id: string
          wholesaler_profile_id: string
        }
        Update: {
          account_number?: string | null
          buyer_id?: string
          configured_at?: string
          contract_start_date?: string | null
          created_at?: string
          id?: string
          is_supplier_of_pharmacist?: boolean
          last_reviewed_at?: string | null
          notes?: string | null
          override_default_discount_pct?: number | null
          override_rules_json?: Json | null
          updated_at?: string
          user_id?: string
          wholesaler_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacist_wholesaler_settings_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacist_wholesaler_settings_wholesaler_profile_id_fkey"
            columns: ["wholesaler_profile_id"]
            isOneToOne: false
            referencedRelation: "wholesaler_profiles"
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "price_adjustment_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustment_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "price_adjustment_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustment_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustment_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "price_adjustment_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "price_adjustment_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "price_adjustment_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "price_alert_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "price_alert_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "price_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "price_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      price_challenge_settings: {
        Row: {
          cooldown_days: number
          id: boolean
          max_per_vendor_per_day: number
          min_delta_pct: number
          updated_at: string
        }
        Insert: {
          cooldown_days?: number
          id?: boolean
          max_per_vendor_per_day?: number
          min_delta_pct?: number
          updated_at?: string
        }
        Update: {
          cooldown_days?: number
          id?: boolean
          max_per_vendor_per_day?: number
          min_delta_pct?: number
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
      pricing_plans: {
        Row: {
          bonus_months: number
          created_at: string | null
          description: string | null
          effective_from: string | null
          effective_to: string | null
          extension_months: number
          id: string
          is_active: boolean | null
          label: string
          monthly_price_ht: number
          trial_months: number
          updated_at: string | null
          vat_rate: number
          volume_currency: string
          volume_threshold_ht: number
        }
        Insert: {
          bonus_months?: number
          created_at?: string | null
          description?: string | null
          effective_from?: string | null
          effective_to?: string | null
          extension_months?: number
          id: string
          is_active?: boolean | null
          label: string
          monthly_price_ht?: number
          trial_months?: number
          updated_at?: string | null
          vat_rate?: number
          volume_currency?: string
          volume_threshold_ht?: number
        }
        Update: {
          bonus_months?: number
          created_at?: string | null
          description?: string | null
          effective_from?: string | null
          effective_to?: string | null
          extension_months?: number
          id?: string
          is_active?: boolean | null
          label?: string
          monthly_price_ht?: number
          trial_months?: number
          updated_at?: string | null
          vat_rate?: number
          volume_currency?: string
          volume_threshold_ht?: number
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_category_anomalies: {
        Row: {
          current_category_id: string | null
          details: Json
          detected_at: string
          dismiss_note: string | null
          dismissed_by: string | null
          id: string
          product_id: string
          reason: string
          resolved_at: string | null
          score: number
          severity: string
          status: string
          suggested_category_id: string | null
        }
        Insert: {
          current_category_id?: string | null
          details?: Json
          detected_at?: string
          dismiss_note?: string | null
          dismissed_by?: string | null
          id?: string
          product_id: string
          reason: string
          resolved_at?: string | null
          score?: number
          severity?: string
          status?: string
          suggested_category_id?: string | null
        }
        Update: {
          current_category_id?: string | null
          details?: Json
          detected_at?: string
          dismiss_note?: string | null
          dismissed_by?: string | null
          id?: string
          product_id?: string
          reason?: string
          resolved_at?: string | null
          score?: number
          severity?: string
          status?: string
          suggested_category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_category_anomalies_current_category_id_fkey"
            columns: ["current_category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomalies_current_category_id_fkey"
            columns: ["current_category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "product_category_anomalies_current_category_id_fkey"
            columns: ["current_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_category_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_category_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomalies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_category_anomalies_suggested_category_id_fkey"
            columns: ["suggested_category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomalies_suggested_category_id_fkey"
            columns: ["suggested_category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "product_category_anomalies_suggested_category_id_fkey"
            columns: ["suggested_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_category_anomaly_actions: {
        Row: {
          action: string
          anomaly_id: string
          from_category_id: string | null
          id: string
          note: string | null
          performed_at: string
          performed_by: string | null
          product_id: string
          to_category_id: string | null
        }
        Insert: {
          action: string
          anomaly_id: string
          from_category_id?: string | null
          id?: string
          note?: string | null
          performed_at?: string
          performed_by?: string | null
          product_id: string
          to_category_id?: string | null
        }
        Update: {
          action?: string
          anomaly_id?: string
          from_category_id?: string | null
          id?: string
          note?: string | null
          performed_at?: string
          performed_by?: string | null
          product_id?: string
          to_category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_category_anomaly_actions_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "product_category_anomalies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomaly_actions_from_category_id_fkey"
            columns: ["from_category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomaly_actions_from_category_id_fkey"
            columns: ["from_category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "product_category_anomaly_actions_from_category_id_fkey"
            columns: ["from_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomaly_actions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_category_anomaly_actions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomaly_actions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_category_anomaly_actions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomaly_actions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomaly_actions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_category_anomaly_actions_to_category_id_fkey"
            columns: ["to_category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_anomaly_actions_to_category_id_fkey"
            columns: ["to_category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "product_category_anomaly_actions_to_category_id_fkey"
            columns: ["to_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_country_stats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_country_stats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_country_stats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_country_stats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_country_stats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_eligibility_categories: {
        Row: {
          code: string
          display_color: string | null
          eligible_for_marketplace: boolean
          excluded_reason: string | null
          label: string
        }
        Insert: {
          code: string
          display_color?: string | null
          eligible_for_marketplace: boolean
          excluded_reason?: string | null
          label: string
        }
        Update: {
          code?: string
          display_color?: string | null
          eligible_for_marketplace?: boolean
          excluded_reason?: string | null
          label?: string
        }
        Relationships: []
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_market_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_market_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_market_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_market_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_market_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_submissions: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          proposed_payload: Json
          resulting_brand_id: string | null
          resulting_manufacturer_id: string | null
          resulting_product_id: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["product_submission_status"]
          updated_at: string
          vendor_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          proposed_payload: Json
          resulting_brand_id?: string | null
          resulting_manufacturer_id?: string | null
          resulting_product_id?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["product_submission_status"]
          updated_at?: string
          vendor_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          proposed_payload?: Json
          resulting_brand_id?: string | null
          resulting_manufacturer_id?: string | null
          resulting_product_id?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["product_submission_status"]
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "vendor_offer_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_submissions_resulting_brand_id_fkey"
            columns: ["resulting_brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_submissions_resulting_brand_id_fkey"
            columns: ["resulting_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_submissions_resulting_brand_id_fkey"
            columns: ["resulting_brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_submissions_resulting_brand_id_fkey"
            columns: ["resulting_brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_submissions_resulting_brand_id_fkey"
            columns: ["resulting_brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "product_submissions_resulting_manufacturer_id_fkey"
            columns: ["resulting_manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_submissions_resulting_product_id_fkey"
            columns: ["resulting_product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_submissions_resulting_product_id_fkey"
            columns: ["resulting_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_submissions_resulting_product_id_fkey"
            columns: ["resulting_product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_submissions_resulting_product_id_fkey"
            columns: ["resulting_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_submissions_resulting_product_id_fkey"
            columns: ["resulting_product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_submissions_resulting_product_id_fkey"
            columns: ["resulting_product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "product_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "product_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "product_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "product_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
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
          description_en: string | null
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
          last_sync_run_id: string | null
          manual_mapping_validated: boolean
          manual_mapping_validated_at: string | null
          manual_mapping_validated_by: string | null
          manufacturer_id: string | null
          min_delivery_days: number | null
          name: string
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          offer_count: number
          origin_country: string | null
          pack_size: number | null
          pack_size_source: string | null
          pack_size_updated_at: string | null
          pack_size_validated: boolean
          popularity: number | null
          primary_category_id: string | null
          promotion_end_date: string | null
          promotion_label: string | null
          promotion_start_date: string | null
          proposed_by_vendor_id: string | null
          pvp_country_code: string | null
          pvp_source: Database["public"]["Enums"]["pvp_source_enum"] | null
          pvp_ttc_cents: number | null
          pvp_updated_at: string | null
          qogita_fid: string | null
          qogita_qid: string | null
          qogita_slug: string | null
          qogita_sync_tier: string
          reference_price: number | null
          seller_count: number | null
          shipping_from: string[] | null
          short_description: string | null
          short_description_en: string | null
          sku: string | null
          slug: string
          source: Database["public"]["Enums"]["product_source"]
          submission_approved_at: string | null
          submission_approved_by: string | null
          submission_rejected_reason: string | null
          submission_status:
            | Database["public"]["Enums"]["catalog_submission_status"]
            | null
          synced_at: string | null
          total_stock: number
          unit: string | null
          unit_quantity: number
          updated_at: string
          vat_rate_be: number | null
          vat_rate_override: number | null
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
          description_en?: string | null
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
          last_sync_run_id?: string | null
          manual_mapping_validated?: boolean
          manual_mapping_validated_at?: string | null
          manual_mapping_validated_by?: string | null
          manufacturer_id?: string | null
          min_delivery_days?: number | null
          name: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          offer_count?: number
          origin_country?: string | null
          pack_size?: number | null
          pack_size_source?: string | null
          pack_size_updated_at?: string | null
          pack_size_validated?: boolean
          popularity?: number | null
          primary_category_id?: string | null
          promotion_end_date?: string | null
          promotion_label?: string | null
          promotion_start_date?: string | null
          proposed_by_vendor_id?: string | null
          pvp_country_code?: string | null
          pvp_source?: Database["public"]["Enums"]["pvp_source_enum"] | null
          pvp_ttc_cents?: number | null
          pvp_updated_at?: string | null
          qogita_fid?: string | null
          qogita_qid?: string | null
          qogita_slug?: string | null
          qogita_sync_tier?: string
          reference_price?: number | null
          seller_count?: number | null
          shipping_from?: string[] | null
          short_description?: string | null
          short_description_en?: string | null
          sku?: string | null
          slug: string
          source?: Database["public"]["Enums"]["product_source"]
          submission_approved_at?: string | null
          submission_approved_by?: string | null
          submission_rejected_reason?: string | null
          submission_status?:
            | Database["public"]["Enums"]["catalog_submission_status"]
            | null
          synced_at?: string | null
          total_stock?: number
          unit?: string | null
          unit_quantity?: number
          updated_at?: string
          vat_rate_be?: number | null
          vat_rate_override?: number | null
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
          description_en?: string | null
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
          last_sync_run_id?: string | null
          manual_mapping_validated?: boolean
          manual_mapping_validated_at?: string | null
          manual_mapping_validated_by?: string | null
          manufacturer_id?: string | null
          min_delivery_days?: number | null
          name?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          offer_count?: number
          origin_country?: string | null
          pack_size?: number | null
          pack_size_source?: string | null
          pack_size_updated_at?: string | null
          pack_size_validated?: boolean
          popularity?: number | null
          primary_category_id?: string | null
          promotion_end_date?: string | null
          promotion_label?: string | null
          promotion_start_date?: string | null
          proposed_by_vendor_id?: string | null
          pvp_country_code?: string | null
          pvp_source?: Database["public"]["Enums"]["pvp_source_enum"] | null
          pvp_ttc_cents?: number | null
          pvp_updated_at?: string | null
          qogita_fid?: string | null
          qogita_qid?: string | null
          qogita_slug?: string | null
          qogita_sync_tier?: string
          reference_price?: number | null
          seller_count?: number | null
          shipping_from?: string[] | null
          short_description?: string | null
          short_description_en?: string | null
          sku?: string | null
          slug?: string
          source?: Database["public"]["Enums"]["product_source"]
          submission_approved_at?: string | null
          submission_approved_by?: string | null
          submission_rejected_reason?: string | null
          submission_status?:
            | Database["public"]["Enums"]["catalog_submission_status"]
            | null
          synced_at?: string | null
          total_stock?: number
          unit?: string | null
          unit_quantity?: number
          updated_at?: string
          vat_rate_be?: number | null
          vat_rate_override?: number | null
          weight?: number | null
          weight_unit?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
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
          {
            foreignKeyName: "products_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "products_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "products_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "products_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "products_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "products_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_proposed_by_vendor_id_fkey"
            columns: ["proposed_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products_backup_20260428_en: {
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
          created_at: string | null
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
          id: string | null
          image_url: string | null
          image_urls: string[] | null
          is_active: boolean | null
          is_in_stock: boolean | null
          is_preorder: boolean | null
          is_promotion: boolean | null
          is_published: boolean | null
          label: string | null
          last_detail_sync: string | null
          last_offers_sync: string | null
          manufacturer_id: string | null
          min_delivery_days: number | null
          name: string | null
          name_de: string | null
          name_fr: string | null
          name_nl: string | null
          offer_count: number | null
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
          slug: string | null
          source: Database["public"]["Enums"]["product_source"] | null
          synced_at: string | null
          total_stock: number | null
          unit: string | null
          unit_quantity: number | null
          updated_at: string | null
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
          created_at?: string | null
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
          id?: string | null
          image_url?: string | null
          image_urls?: string[] | null
          is_active?: boolean | null
          is_in_stock?: boolean | null
          is_preorder?: boolean | null
          is_promotion?: boolean | null
          is_published?: boolean | null
          label?: string | null
          last_detail_sync?: string | null
          last_offers_sync?: string | null
          manufacturer_id?: string | null
          min_delivery_days?: number | null
          name?: string | null
          name_de?: string | null
          name_fr?: string | null
          name_nl?: string | null
          offer_count?: number | null
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
          slug?: string | null
          source?: Database["public"]["Enums"]["product_source"] | null
          synced_at?: string | null
          total_stock?: number | null
          unit?: string | null
          unit_quantity?: number | null
          updated_at?: string | null
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
          created_at?: string | null
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
          id?: string | null
          image_url?: string | null
          image_urls?: string[] | null
          is_active?: boolean | null
          is_in_stock?: boolean | null
          is_preorder?: boolean | null
          is_promotion?: boolean | null
          is_published?: boolean | null
          label?: string | null
          last_detail_sync?: string | null
          last_offers_sync?: string | null
          manufacturer_id?: string | null
          min_delivery_days?: number | null
          name?: string | null
          name_de?: string | null
          name_fr?: string | null
          name_nl?: string | null
          offer_count?: number | null
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
          slug?: string | null
          source?: Database["public"]["Enums"]["product_source"] | null
          synced_at?: string | null
          total_stock?: number | null
          unit?: string | null
          unit_quantity?: number | null
          updated_at?: string | null
          vat_rate_be?: number | null
          weight?: number | null
          weight_unit?: string | null
          width?: number | null
        }
        Relationships: []
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
          buyer_profile_id: string | null
          category_preferences: Json | null
          company_name: string | null
          country: string | null
          created_at: string
          filter_mode: string
          full_name: string | null
          id: string
          legal_faq_acknowledged_at: string | null
          phone: string | null
          preferences: Json
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
          buyer_profile_id?: string | null
          category_preferences?: Json | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          filter_mode?: string
          full_name?: string | null
          id?: string
          legal_faq_acknowledged_at?: string | null
          phone?: string | null
          preferences?: Json
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
          buyer_profile_id?: string | null
          category_preferences?: Json | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          filter_mode?: string
          full_name?: string | null
          id?: string
          legal_faq_acknowledged_at?: string | null
          phone?: string | null
          preferences?: Json
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
            foreignKeyName: "profiles_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "buyer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["buyer_profile_id"]
          },
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
      qogita_connection_tests: {
        Row: {
          created_at: string
          error_message: string | null
          http_status: number | null
          id: string
          latency_ms: number | null
          source: string
          success: boolean
          tested_at: string
          tested_by: string | null
          tested_email_masked: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          source?: string
          success: boolean
          tested_at?: string
          tested_by?: string | null
          tested_email_masked?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          source?: string
          success?: boolean
          tested_at?: string
          tested_by?: string | null
          tested_email_masked?: string | null
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
          entities_deactivated: Json
          entities_spared: Json
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
          sweep_type: string | null
          sync_run_id: string | null
          threshold_days: number | null
          tiers_synced: number
          total_errors: number
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          country_code?: string | null
          created_at?: string
          duration_ms?: number | null
          entities_deactivated?: Json
          entities_spared?: Json
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
          sweep_type?: string | null
          sync_run_id?: string | null
          threshold_days?: number | null
          tiers_synced?: number
          total_errors?: number
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          country_code?: string | null
          created_at?: string
          duration_ms?: number | null
          entities_deactivated?: Json
          entities_spared?: Json
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
          sweep_type?: string | null
          sync_run_id?: string | null
          threshold_days?: number | null
          tiers_synced?: number
          total_errors?: number
          triggered_by?: string | null
        }
        Relationships: []
      }
      quote_lines: {
        Row: {
          commission_amount_cents: number | null
          commission_basis: string | null
          commission_rate: number | null
          created_at: string
          id: string
          label: string
          offer_id: string | null
          product_id: string | null
          qty: number
          quote_id: string
          sort_order: number
          total_ht_cents: number
          total_ttc_cents: number
          unit_cost_ht_cents: number | null
          unit_price_ht_cents: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          commission_amount_cents?: number | null
          commission_basis?: string | null
          commission_rate?: number | null
          created_at?: string
          id?: string
          label: string
          offer_id?: string | null
          product_id?: string | null
          qty: number
          quote_id: string
          sort_order?: number
          total_ht_cents?: number
          total_ttc_cents?: number
          unit_cost_ht_cents?: number | null
          unit_price_ht_cents: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          commission_amount_cents?: number | null
          commission_basis?: string | null
          commission_rate?: number | null
          created_at?: string
          id?: string
          label?: string
          offer_id?: string | null
          product_id?: string | null
          qty?: number
          quote_id?: string
          sort_order?: number
          total_ht_cents?: number
          total_ttc_cents?: number
          unit_cost_ht_cents?: number | null
          unit_price_ht_cents?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "quote_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "quote_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "quote_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "quote_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "quote_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          accepted_ip: string | null
          converted_at: string | null
          created_at: string
          created_by_user_id: string | null
          currency_code: string
          customer_id: string
          declined_at: string | null
          id: string
          notes_customer: string | null
          notes_internal: string | null
          order_id: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["quote_payment_method"]
          pdf_storage_path: string | null
          public_token: string | null
          quote_number: string
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          token_expires_at: string | null
          total_ht_cents: number
          total_ttc_cents: number
          total_tva_cents: number
          updated_at: string
          vendor_id: string
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_ip?: string | null
          converted_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string
          customer_id: string
          declined_at?: string | null
          id?: string
          notes_customer?: string | null
          notes_internal?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["quote_payment_method"]
          pdf_storage_path?: string | null
          public_token?: string | null
          quote_number?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          token_expires_at?: string | null
          total_ht_cents?: number
          total_ttc_cents?: number
          total_tva_cents?: number
          updated_at?: string
          vendor_id: string
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_ip?: string | null
          converted_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string
          customer_id?: string
          declined_at?: string | null
          id?: string
          notes_customer?: string | null
          notes_internal?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["quote_payment_method"]
          pdf_storage_path?: string | null
          public_token?: string | null
          quote_number?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          token_expires_at?: string | null
          total_ht_cents?: number
          total_ttc_cents?: number
          total_tva_cents?: number
          updated_at?: string
          vendor_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_with_forecast_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_visible_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recent_activity_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recent_activity_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recent_activity_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recent_activity_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recent_activity_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      restock_buyers: {
        Row: {
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
            referencedRelation: "restock_seller_transactions_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "restock_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "restock_transactions_seller_v"
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
          photos: string[]
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
          seller_postal_code: string | null
          seller_province: string | null
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
          photos?: string[]
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
          seller_postal_code?: string | null
          seller_province?: string | null
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
          photos?: string[]
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
          seller_postal_code?: string | null
          seller_province?: string | null
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "restock_offers_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_offers_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "restock_offers_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_offers_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_offers_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      restock_pickup_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          transaction_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          transaction_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restock_pickup_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "restock_seller_transactions_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_pickup_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "restock_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_pickup_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "restock_transactions_seller_v"
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
            referencedRelation: "restock_seller_transactions_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_ratings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "restock_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_ratings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "restock_transactions_seller_v"
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
      restock_seller_pickup_locations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country_code: string | null
          created_at: string
          hours: Json
          id: string
          instructions: string | null
          is_enabled: boolean
          postal_code: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string
          hours?: Json
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          postal_code?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string
          hours?: Json
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          postal_code?: string | null
          seller_id?: string
          updated_at?: string
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
            referencedRelation: "restock_seller_transactions_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_shipments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "restock_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_shipments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "restock_transactions_seller_v"
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
          cancelled_reason: string | null
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
          pickup_confirmation_method: string | null
          pickup_confirmed_at: string | null
          pickup_confirmed_by: string | null
          pickup_deadline_at: string | null
          pickup_handover_code: string | null
          pickup_qr_token: string | null
          pickup_reminder_sent_at: string | null
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
          cancelled_reason?: string | null
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
          pickup_confirmation_method?: string | null
          pickup_confirmed_at?: string | null
          pickup_confirmed_by?: string | null
          pickup_deadline_at?: string | null
          pickup_handover_code?: string | null
          pickup_qr_token?: string | null
          pickup_reminder_sent_at?: string | null
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
          cancelled_reason?: string | null
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
          pickup_confirmation_method?: string | null
          pickup_confirmed_at?: string | null
          pickup_confirmed_by?: string | null
          pickup_deadline_at?: string | null
          pickup_handover_code?: string | null
          pickup_qr_token?: string | null
          pickup_reminder_sent_at?: string | null
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
      rfq_access_grants: {
        Row: {
          expires_at: string | null
          granted_at: string
          id: string
          notes: string | null
          reason: string
          revoked_at: string | null
          rfq_id: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          id?: string
          notes?: string | null
          reason: string
          revoked_at?: string | null
          rfq_id: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          id?: string
          notes?: string | null
          reason?: string
          revoked_at?: string | null
          rfq_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_access_grants_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string
          rfq_id: string
          rfq_response_id: string | null
          size_bytes: number
          storage_path: string
          uploaded_by_user_id: string
          uploader_role: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          rfq_id: string
          rfq_response_id?: string | null
          size_bytes: number
          storage_path: string
          uploaded_by_user_id: string
          uploader_role: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          rfq_id?: string
          rfq_response_id?: string | null
          size_bytes?: number
          storage_path?: string
          uploaded_by_user_id?: string
          uploader_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_attachments_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_attachments_rfq_response_id_fkey"
            columns: ["rfq_response_id"]
            isOneToOne: false
            referencedRelation: "rfq_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_attachments_rfq_response_id_fkey"
            columns: ["rfq_response_id"]
            isOneToOne: false
            referencedRelation: "rfq_vendor_status_v"
            referencedColumns: ["response_id"]
          },
        ]
      }
      rfq_buyer_balances: {
        Row: {
          active_plan_id: string | null
          created_at: string
          current_period_start: string
          is_unlimited: boolean
          monthly_quota: number
          monthly_used: number
          permanent_credits: number
          plan_expires_at: string | null
          plan_started_at: string | null
          rfq_unlimited_override: boolean
          total_consumed: number
          total_purchased: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_plan_id?: string | null
          created_at?: string
          current_period_start?: string
          is_unlimited?: boolean
          monthly_quota?: number
          monthly_used?: number
          permanent_credits?: number
          plan_expires_at?: string | null
          plan_started_at?: string | null
          rfq_unlimited_override?: boolean
          total_consumed?: number
          total_purchased?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_plan_id?: string | null
          created_at?: string
          current_period_start?: string
          is_unlimited?: boolean
          monthly_quota?: number
          monthly_used?: number
          permanent_credits?: number
          plan_expires_at?: string | null
          plan_started_at?: string | null
          rfq_unlimited_override?: boolean
          total_consumed?: number
          total_purchased?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_buyer_balances_active_plan_id_fkey"
            columns: ["active_plan_id"]
            isOneToOne: false
            referencedRelation: "rfq_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_credit_ledger: {
        Row: {
          created_at: string
          delta_permanent: number
          delta_quota: number
          id: string
          kind: Database["public"]["Enums"]["rfq_ledger_kind"]
          metadata: Json
          performed_by_user_id: string | null
          plan_id: string | null
          reason: string | null
          rfq_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta_permanent?: number
          delta_quota?: number
          id?: string
          kind: Database["public"]["Enums"]["rfq_ledger_kind"]
          metadata?: Json
          performed_by_user_id?: string | null
          plan_id?: string | null
          reason?: string | null
          rfq_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta_permanent?: number
          delta_quota?: number
          id?: string
          kind?: Database["public"]["Enums"]["rfq_ledger_kind"]
          metadata?: Json
          performed_by_user_id?: string | null
          plan_id?: string | null
          reason?: string | null
          rfq_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_credit_ledger_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "rfq_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_credit_ledger_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_dispatch_log: {
        Row: {
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          dispatched_at: string
          email_clicked_at: string | null
          email_message_id: string | null
          email_opened_at: string | null
          expired_at: string | null
          id: string
          notification_id: string | null
          reason: Database["public"]["Enums"]["rfq_target_reason"]
          reminded_at: string | null
          responded_at: string | null
          rfq_id: string
          status: Database["public"]["Enums"]["rfq_dispatch_status"]
          tracking_token: string
          updated_at: string
          vendor_id: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          dispatched_at?: string
          email_clicked_at?: string | null
          email_message_id?: string | null
          email_opened_at?: string | null
          expired_at?: string | null
          id?: string
          notification_id?: string | null
          reason: Database["public"]["Enums"]["rfq_target_reason"]
          reminded_at?: string | null
          responded_at?: string | null
          rfq_id: string
          status?: Database["public"]["Enums"]["rfq_dispatch_status"]
          tracking_token?: string
          updated_at?: string
          vendor_id: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          dispatched_at?: string
          email_clicked_at?: string | null
          email_message_id?: string | null
          email_opened_at?: string | null
          expired_at?: string | null
          id?: string
          notification_id?: string | null
          reason?: Database["public"]["Enums"]["rfq_target_reason"]
          reminded_at?: string | null
          responded_at?: string | null
          rfq_id?: string
          status?: Database["public"]["Enums"]["rfq_dispatch_status"]
          tracking_token?: string
          updated_at?: string
          vendor_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_dispatch_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "vendor_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_external_invitations: {
        Row: {
          contact_email: string
          contact_name: string | null
          created_at: string
          email_message_id: string | null
          external_vendor_id: string
          id: string
          invited_by: string | null
          responded_at: string | null
          rfq_id: string
          status: string
          token_expires_at: string
          token_hash: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          contact_email: string
          contact_name?: string | null
          created_at?: string
          email_message_id?: string | null
          external_vendor_id: string
          id?: string
          invited_by?: string | null
          responded_at?: string | null
          rfq_id: string
          status?: string
          token_expires_at?: string
          token_hash: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          contact_email?: string
          contact_name?: string | null
          created_at?: string
          email_message_id?: string | null
          external_vendor_id?: string
          id?: string
          invited_by?: string | null
          responded_at?: string | null
          rfq_id?: string
          status?: string
          token_expires_at?: string
          token_hash?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_external_invitations_external_vendor_id_fkey"
            columns: ["external_vendor_id"]
            isOneToOne: false
            referencedRelation: "external_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_external_invitations_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_external_responses: {
        Row: {
          attachments_urls: string[]
          comment: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          currency_code: string
          external_vendor_id: string
          id: string
          invitation_id: string
          lead_time_days: number | null
          payment_terms: string | null
          quantity_available: number | null
          rfq_id: string
          unit_price_excl_vat_cents: number
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          attachments_urls?: string[]
          comment?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          currency_code?: string
          external_vendor_id: string
          id?: string
          invitation_id: string
          lead_time_days?: number | null
          payment_terms?: string | null
          quantity_available?: number | null
          rfq_id: string
          unit_price_excl_vat_cents: number
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          attachments_urls?: string[]
          comment?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          currency_code?: string
          external_vendor_id?: string
          id?: string
          invitation_id?: string
          lead_time_days?: number | null
          payment_terms?: string | null
          quantity_available?: number | null
          rfq_id?: string
          unit_price_excl_vat_cents?: number
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_external_responses_external_vendor_id_fkey"
            columns: ["external_vendor_id"]
            isOneToOne: false
            referencedRelation: "external_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_external_responses_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "rfq_external_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_external_responses_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_plans: {
        Row: {
          code: string
          created_at: string
          credits_included: number
          currency: string
          description: string | null
          duration_days: number | null
          id: string
          is_active: boolean
          is_unlimited: boolean
          label: string
          monthly_quota: number
          plan_type: Database["public"]["Enums"]["rfq_plan_type"]
          price_cents: number
          sort_order: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          credits_included?: number
          currency?: string
          description?: string | null
          duration_days?: number | null
          id?: string
          is_active?: boolean
          is_unlimited?: boolean
          label: string
          monthly_quota?: number
          plan_type: Database["public"]["Enums"]["rfq_plan_type"]
          price_cents?: number
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          credits_included?: number
          currency?: string
          description?: string | null
          duration_days?: number | null
          id?: string
          is_active?: boolean
          is_unlimited?: boolean
          label?: string
          monthly_quota?: number
          plan_type?: Database["public"]["Enums"]["rfq_plan_type"]
          price_cents?: number
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rfq_reminder_log: {
        Row: {
          email_message_id: string | null
          error: string | null
          id: string
          manual_admin: boolean
          rfq_id: string
          sent_at: string
          template_id: string | null
          vendor_id: string
          wave_number: number
        }
        Insert: {
          email_message_id?: string | null
          error?: string | null
          id?: string
          manual_admin?: boolean
          rfq_id: string
          sent_at?: string
          template_id?: string | null
          vendor_id: string
          wave_number: number
        }
        Update: {
          email_message_id?: string | null
          error?: string | null
          id?: string
          manual_admin?: boolean
          rfq_id?: string
          sent_at?: string
          template_id?: string | null
          vendor_id?: string
          wave_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "rfq_reminder_log_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_reminder_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rfq_reminder_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_reminder_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_reminder_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_reminder_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_reminder_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_reminder_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_reminder_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_reminder_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_reminder_templates: {
        Row: {
          body_fr: string
          created_at: string
          delay_hours: number
          id: string
          is_active: boolean
          subject_fr: string
          updated_at: string
          wave_number: number
        }
        Insert: {
          body_fr: string
          created_at?: string
          delay_hours: number
          id?: string
          is_active?: boolean
          subject_fr: string
          updated_at?: string
          wave_number: number
        }
        Update: {
          body_fr?: string
          created_at?: string
          delay_hours?: number
          id?: string
          is_active?: boolean
          subject_fr?: string
          updated_at?: string
          wave_number?: number
        }
        Relationships: []
      }
      rfq_responses: {
        Row: {
          admin_override_visible: boolean
          awarded: boolean
          comment: string | null
          compliance_flags: Json
          created_at: string
          delivery_days: number
          id: string
          is_top_pick: boolean
          is_visible_to_buyer: boolean
          moq: number
          offer_validity_days: number | null
          payment_terms: string | null
          rank_position: number | null
          rfq_id: string
          score: number | null
          score_availability: number | null
          score_compliance: number | null
          score_delivery: number | null
          score_price: number | null
          scored_at: string | null
          unit_price_excl_vat_cents: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          admin_override_visible?: boolean
          awarded?: boolean
          comment?: string | null
          compliance_flags?: Json
          created_at?: string
          delivery_days: number
          id?: string
          is_top_pick?: boolean
          is_visible_to_buyer?: boolean
          moq?: number
          offer_validity_days?: number | null
          payment_terms?: string | null
          rank_position?: number | null
          rfq_id: string
          score?: number | null
          score_availability?: number | null
          score_compliance?: number | null
          score_delivery?: number | null
          score_price?: number | null
          scored_at?: string | null
          unit_price_excl_vat_cents: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          admin_override_visible?: boolean
          awarded?: boolean
          comment?: string | null
          compliance_flags?: Json
          created_at?: string
          delivery_days?: number
          id?: string
          is_top_pick?: boolean
          is_visible_to_buyer?: boolean
          moq?: number
          offer_validity_days?: number | null
          payment_terms?: string | null
          rank_position?: number | null
          rfq_id?: string
          score?: number | null
          score_availability?: number | null
          score_compliance?: number | null
          score_delivery?: number | null
          score_price?: number | null
          scored_at?: string | null
          unit_price_excl_vat_cents?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_responses_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_responses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_responses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_responses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_responses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_responses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_responses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_responses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_routing_audit_log: {
        Row: {
          cap_applied: number | null
          created_at: string
          decision: Database["public"]["Enums"]["rfq_routing_decision"]
          details: Json | null
          id: string
          matched_reason:
            | Database["public"]["Enums"]["rfq_target_reason"]
            | null
          rank_position: number | null
          reason_code: string
          reason_label: string | null
          rfq_id: string
          score: number | null
          vendor_id: string
        }
        Insert: {
          cap_applied?: number | null
          created_at?: string
          decision: Database["public"]["Enums"]["rfq_routing_decision"]
          details?: Json | null
          id?: string
          matched_reason?:
            | Database["public"]["Enums"]["rfq_target_reason"]
            | null
          rank_position?: number | null
          reason_code: string
          reason_label?: string | null
          rfq_id: string
          score?: number | null
          vendor_id: string
        }
        Update: {
          cap_applied?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["rfq_routing_decision"]
          details?: Json | null
          id?: string
          matched_reason?:
            | Database["public"]["Enums"]["rfq_target_reason"]
            | null
          rank_position?: number | null
          reason_code?: string
          reason_label?: string | null
          rfq_id?: string
          score?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_routing_audit_log_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_routing_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value_int: number | null
          value_text: string | null
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value_int?: number | null
          value_text?: string | null
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value_int?: number | null
          value_text?: string | null
        }
        Relationships: []
      }
      rfqs: {
        Row: {
          admin_curated: boolean
          awarded_at: string | null
          brand_id: string | null
          buyer_user_id: string
          closed_at: string | null
          comment: string | null
          created_at: string
          currency_code: string
          current_wave: number
          delivery_address: Json | null
          desired_delivery_date: string | null
          destination_country_code: string
          dispatched_at: string | null
          id: string
          is_paid_feature: boolean
          last_reminded_at: string | null
          max_target_vendors: number | null
          payment_terms: string | null
          product_id: string | null
          quantity: number
          required_offer_validity_days: number | null
          responses_deadline: string
          status: Database["public"]["Enums"]["rfq_status"]
          target_price_excl_vat_cents: number | null
          target_scope: Database["public"]["Enums"]["rfq_target_scope"]
          total_responded: number
          total_targeted: number
          updated_at: string
          wave_started_at: string | null
        }
        Insert: {
          admin_curated?: boolean
          awarded_at?: string | null
          brand_id?: string | null
          buyer_user_id: string
          closed_at?: string | null
          comment?: string | null
          created_at?: string
          currency_code?: string
          current_wave?: number
          delivery_address?: Json | null
          desired_delivery_date?: string | null
          destination_country_code: string
          dispatched_at?: string | null
          id?: string
          is_paid_feature?: boolean
          last_reminded_at?: string | null
          max_target_vendors?: number | null
          payment_terms?: string | null
          product_id?: string | null
          quantity: number
          required_offer_validity_days?: number | null
          responses_deadline?: string
          status?: Database["public"]["Enums"]["rfq_status"]
          target_price_excl_vat_cents?: number | null
          target_scope?: Database["public"]["Enums"]["rfq_target_scope"]
          total_responded?: number
          total_targeted?: number
          updated_at?: string
          wave_started_at?: string | null
        }
        Update: {
          admin_curated?: boolean
          awarded_at?: string | null
          brand_id?: string | null
          buyer_user_id?: string
          closed_at?: string | null
          comment?: string | null
          created_at?: string
          currency_code?: string
          current_wave?: number
          delivery_address?: Json | null
          desired_delivery_date?: string | null
          destination_country_code?: string
          dispatched_at?: string | null
          id?: string
          is_paid_feature?: boolean
          last_reminded_at?: string | null
          max_target_vendors?: number | null
          payment_terms?: string | null
          product_id?: string | null
          quantity?: number
          required_offer_validity_days?: number | null
          responses_deadline?: string
          status?: Database["public"]["Enums"]["rfq_status"]
          target_price_excl_vat_cents?: number | null
          target_scope?: Database["public"]["Enums"]["rfq_target_scope"]
          total_responded?: number
          total_targeted?: number
          updated_at?: string
          wave_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "rfqs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "rfqs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "rfqs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      savings_simulation_lines: {
        Row: {
          created_at: string
          detected_brand: string | null
          detected_cnk: string | null
          detected_ean: string | null
          detected_name: string | null
          detected_proprietary_code: string | null
          detected_quantity: number | null
          detected_unit_price_excl_vat: number | null
          id: string
          line_number: number | null
          line_savings: number | null
          line_savings_pct: number | null
          match_confidence: number | null
          match_method: string | null
          matched_product_id: string | null
          medikong_min_price_excl_vat: number | null
          medikong_supplier_count: number | null
          raw_text: string | null
          simulation_id: string
        }
        Insert: {
          created_at?: string
          detected_brand?: string | null
          detected_cnk?: string | null
          detected_ean?: string | null
          detected_name?: string | null
          detected_proprietary_code?: string | null
          detected_quantity?: number | null
          detected_unit_price_excl_vat?: number | null
          id?: string
          line_number?: number | null
          line_savings?: number | null
          line_savings_pct?: number | null
          match_confidence?: number | null
          match_method?: string | null
          matched_product_id?: string | null
          medikong_min_price_excl_vat?: number | null
          medikong_supplier_count?: number | null
          raw_text?: string | null
          simulation_id: string
        }
        Update: {
          created_at?: string
          detected_brand?: string | null
          detected_cnk?: string | null
          detected_ean?: string | null
          detected_name?: string | null
          detected_proprietary_code?: string | null
          detected_quantity?: number | null
          detected_unit_price_excl_vat?: number | null
          id?: string
          line_number?: number | null
          line_savings?: number | null
          line_savings_pct?: number | null
          match_confidence?: number | null
          match_method?: string | null
          matched_product_id?: string | null
          medikong_min_price_excl_vat?: number | null
          medikong_supplier_count?: number | null
          raw_text?: string | null
          simulation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_simulation_lines_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "savings_simulation_lines_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_simulation_lines_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "savings_simulation_lines_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_simulation_lines_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_simulation_lines_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "savings_simulation_lines_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "savings_simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_simulations: {
        Row: {
          city: string | null
          consent_given_at: string
          created_at: string
          email: string | null
          email_sent_at: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          match_rate: number | null
          matched_lines: number | null
          medikong_total_excl_vat: number | null
          pharmacy_name: string | null
          region: string | null
          report_path: string | null
          savings_amount: number | null
          savings_pct: number | null
          source_file_path: string | null
          source_file_type: string | null
          source_supplier: string
          source_total_excl_vat: number | null
          status: string
          total_lines: number | null
          updated_at: string
          user_agent: string | null
          user_id: string | null
          vat_number: string | null
        }
        Insert: {
          city?: string | null
          consent_given_at?: string
          created_at?: string
          email?: string | null
          email_sent_at?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          match_rate?: number | null
          matched_lines?: number | null
          medikong_total_excl_vat?: number | null
          pharmacy_name?: string | null
          region?: string | null
          report_path?: string | null
          savings_amount?: number | null
          savings_pct?: number | null
          source_file_path?: string | null
          source_file_type?: string | null
          source_supplier: string
          source_total_excl_vat?: number | null
          status?: string
          total_lines?: number | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          vat_number?: string | null
        }
        Update: {
          city?: string | null
          consent_given_at?: string
          created_at?: string
          email?: string | null
          email_sent_at?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          match_rate?: number | null
          matched_lines?: number | null
          medikong_total_excl_vat?: number | null
          pharmacy_name?: string | null
          region?: string | null
          report_path?: string | null
          savings_amount?: number | null
          savings_pct?: number | null
          source_file_path?: string | null
          source_file_type?: string | null
          source_supplier?: string
          source_total_excl_vat?: number | null
          status?: string
          total_lines?: number | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      search_logs: {
        Row: {
          buyer_profile_id: string | null
          clicked_id: string | null
          clicked_slug: string | null
          clicked_type: string | null
          country: string | null
          created_at: string
          filters: Json
          id: string
          locale: string | null
          normalized_query: string | null
          profession_type_id: string | null
          profile_country: string | null
          profile_region: string | null
          profile_sector: string | null
          query: string
          results_count: number | null
          session_id: string | null
          source: string | null
          user_agent: string | null
          user_id: string | null
          zero_results: boolean | null
        }
        Insert: {
          buyer_profile_id?: string | null
          clicked_id?: string | null
          clicked_slug?: string | null
          clicked_type?: string | null
          country?: string | null
          created_at?: string
          filters?: Json
          id?: string
          locale?: string | null
          normalized_query?: string | null
          profession_type_id?: string | null
          profile_country?: string | null
          profile_region?: string | null
          profile_sector?: string | null
          query: string
          results_count?: number | null
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
          zero_results?: boolean | null
        }
        Update: {
          buyer_profile_id?: string | null
          clicked_id?: string | null
          clicked_slug?: string | null
          clicked_type?: string | null
          country?: string | null
          created_at?: string
          filters?: Json
          id?: string
          locale?: string | null
          normalized_query?: string | null
          profession_type_id?: string | null
          profile_country?: string | null
          profile_region?: string | null
          profile_sector?: string | null
          query?: string
          results_count?: number | null
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
          zero_results?: boolean | null
        }
        Relationships: []
      }
      security_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          category: string
          created_at: string
          id: string
          ip_address: string | null
          payload: Json | null
          severity: string
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          category: string
          created_at?: string
          id?: string
          ip_address?: string | null
          payload?: Json | null
          severity?: string
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          category?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          payload?: Json | null
          severity?: string
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      seller_alignment_requests: {
        Row: {
          aligned_at: string | null
          aligned_new_price_cents: number | null
          buyer_id: string
          buyer_net_price_cents: number
          cnk: string
          cooldown_until: string | null
          created_at: string
          current_seller_id: string
          current_seller_price_cents: number
          declined_reason: string | null
          delta_cents: number
          delta_pct: number
          expires_at: string
          id: string
          invoice_line_id: string | null
          product_id: string
          status: string
          updated_at: string
          wholesaler_profile_id: string | null
        }
        Insert: {
          aligned_at?: string | null
          aligned_new_price_cents?: number | null
          buyer_id: string
          buyer_net_price_cents: number
          cnk: string
          cooldown_until?: string | null
          created_at?: string
          current_seller_id: string
          current_seller_price_cents: number
          declined_reason?: string | null
          delta_cents: number
          delta_pct: number
          expires_at: string
          id?: string
          invoice_line_id?: string | null
          product_id: string
          status?: string
          updated_at?: string
          wholesaler_profile_id?: string | null
        }
        Update: {
          aligned_at?: string | null
          aligned_new_price_cents?: number | null
          buyer_id?: string
          buyer_net_price_cents?: number
          cnk?: string
          cooldown_until?: string | null
          created_at?: string
          current_seller_id?: string
          current_seller_price_cents?: number
          declined_reason?: string | null
          delta_cents?: number
          delta_pct?: number
          expires_at?: string
          id?: string
          invoice_line_id?: string | null
          product_id?: string
          status?: string
          updated_at?: string
          wholesaler_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_alignment_requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_alignment_requests_invoice_line_id_fkey"
            columns: ["invoice_line_id"]
            isOneToOne: false
            referencedRelation: "imported_invoice_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_alignment_requests_wholesaler_profile_id_fkey"
            columns: ["wholesaler_profile_id"]
            isOneToOne: false
            referencedRelation: "wholesaler_profiles"
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "seller_contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "seller_contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "shipments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "shipments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "shipping_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "shipping_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
          crowdfunding_enabled: boolean
          currency: string
          default_vat_rate: number
          display_prices_incl_vat: boolean
          id: number
          investment_banner_enabled: boolean
          investment_banner_text: string | null
          investment_banner_text_de: string | null
          investment_banner_text_en: string | null
          investment_banner_text_nl: string | null
          media_banner_cta_label: string | null
          media_banner_cta_url: string | null
          media_banner_enabled: boolean
          media_banner_subtitle: string | null
          media_banner_title: string | null
          reduced_vat_rate: number
          restock_enabled: boolean
          site_name: string
          tagline: string
        }
        Insert: {
          country?: string
          crowdfunding_enabled?: boolean
          currency?: string
          default_vat_rate?: number
          display_prices_incl_vat?: boolean
          id?: number
          investment_banner_enabled?: boolean
          investment_banner_text?: string | null
          investment_banner_text_de?: string | null
          investment_banner_text_en?: string | null
          investment_banner_text_nl?: string | null
          media_banner_cta_label?: string | null
          media_banner_cta_url?: string | null
          media_banner_enabled?: boolean
          media_banner_subtitle?: string | null
          media_banner_title?: string | null
          reduced_vat_rate?: number
          restock_enabled?: boolean
          site_name?: string
          tagline?: string
        }
        Update: {
          country?: string
          crowdfunding_enabled?: boolean
          currency?: string
          default_vat_rate?: number
          display_prices_incl_vat?: boolean
          id?: number
          investment_banner_enabled?: boolean
          investment_banner_text?: string | null
          investment_banner_text_de?: string | null
          investment_banner_text_en?: string | null
          investment_banner_text_nl?: string | null
          media_banner_cta_label?: string | null
          media_banner_cta_url?: string | null
          media_banner_enabled?: boolean
          media_banner_subtitle?: string | null
          media_banner_title?: string | null
          reduced_vat_rate?: number
          restock_enabled?: boolean
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
      sub_order_generation_logs: {
        Row: {
          actor_user_id: string | null
          commission_amount_override: number | null
          commission_rate_override: number | null
          cost_total: number | null
          created_at: string
          id: string
          line_count: number
          lines: Json
          margin_total: number | null
          metadata: Json
          order_id: string
          order_number: string | null
          payment_intent_id: string | null
          source: string
          stripe_session_id: string | null
          sub_order_id: string | null
          subtotal_incl_vat: number | null
          vendor_id: string | null
          was_existing: boolean
        }
        Insert: {
          actor_user_id?: string | null
          commission_amount_override?: number | null
          commission_rate_override?: number | null
          cost_total?: number | null
          created_at?: string
          id?: string
          line_count?: number
          lines?: Json
          margin_total?: number | null
          metadata?: Json
          order_id: string
          order_number?: string | null
          payment_intent_id?: string | null
          source?: string
          stripe_session_id?: string | null
          sub_order_id?: string | null
          subtotal_incl_vat?: number | null
          vendor_id?: string | null
          was_existing?: boolean
        }
        Update: {
          actor_user_id?: string | null
          commission_amount_override?: number | null
          commission_rate_override?: number | null
          cost_total?: number | null
          created_at?: string
          id?: string
          line_count?: number
          lines?: Json
          margin_total?: number | null
          metadata?: Json
          order_id?: string
          order_number?: string | null
          payment_intent_id?: string | null
          source?: string
          stripe_session_id?: string | null
          sub_order_id?: string | null
          subtotal_incl_vat?: number | null
          vendor_id?: string | null
          was_existing?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sub_order_generation_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "sub_order_generation_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_with_forecast_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_order_generation_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_order_generation_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_visible_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_order_generation_logs_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["sub_order_id"]
          },
          {
            foreignKeyName: "sub_order_generation_logs_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_order_generation_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "sub_order_generation_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "sub_order_generation_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_order_generation_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "sub_order_generation_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "sub_order_generation_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_order_generation_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_orders: {
        Row: {
          commission_amount_override: number | null
          commission_rate_override: number | null
          cost_total: number | null
          created_at: string
          estimated_delivery_date: string | null
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          invoice_last_reminder_at: string | null
          invoice_net_days: number | null
          invoice_paid_at: string | null
          invoice_paid_marked_by: string | null
          invoice_reminder_count: number
          last_sla_check_at: string | null
          margin_total: number | null
          order_id: string
          payment_due_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
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
          shipped_at: string | null
          status: Database["public"]["Enums"]["fulfillment_status"]
          subtotal_incl_vat: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          vendor_confirmed_at: string | null
          vendor_first_viewed_at: string | null
          vendor_id: string
        }
        Insert: {
          commission_amount_override?: number | null
          commission_rate_override?: number | null
          cost_total?: number | null
          created_at?: string
          estimated_delivery_date?: string | null
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          invoice_last_reminder_at?: string | null
          invoice_net_days?: number | null
          invoice_paid_at?: string | null
          invoice_paid_marked_by?: string | null
          invoice_reminder_count?: number
          last_sla_check_at?: string | null
          margin_total?: number | null
          order_id: string
          payment_due_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
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
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["fulfillment_status"]
          subtotal_incl_vat?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vendor_confirmed_at?: string | null
          vendor_first_viewed_at?: string | null
          vendor_id: string
        }
        Update: {
          commission_amount_override?: number | null
          commission_rate_override?: number | null
          cost_total?: number | null
          created_at?: string
          estimated_delivery_date?: string | null
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          invoice_last_reminder_at?: string | null
          invoice_net_days?: number | null
          invoice_paid_at?: string | null
          invoice_paid_marked_by?: string | null
          invoice_reminder_count?: number
          last_sla_check_at?: string | null
          margin_total?: number | null
          order_id?: string
          payment_due_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
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
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["fulfillment_status"]
          subtotal_incl_vat?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vendor_confirmed_at?: string | null
          vendor_first_viewed_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "sub_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_with_forecast_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_visible_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "sub_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "sub_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      subscription_events: {
        Row: {
          buyer_id: string
          created_at: string | null
          event_type: string
          id: string
          occurred_at: string | null
          payload: Json | null
          performed_by_user_id: string | null
          subscription_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string | null
          event_type: string
          id?: string
          occurred_at?: string | null
          payload?: Json | null
          performed_by_user_id?: string | null
          subscription_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string | null
          event_type?: string
          id?: string
          occurred_at?: string | null
          payload?: Json | null
          performed_by_user_id?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "buyer_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "v_buyer_subscription_overview"
            referencedColumns: ["subscription_id"]
          },
        ]
      }
      subscription_extension_requests: {
        Row: {
          assigned_to_user_id: string | null
          buyer_id: string
          callback_window: string | null
          contact_attempt_count: number | null
          contact_notes: string | null
          context_snapshot: Json | null
          created_at: string | null
          granted_months: number | null
          id: string
          last_contact_at: string | null
          reason: string | null
          rejection_reason: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: string
          subscription_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_to_user_id?: string | null
          buyer_id: string
          callback_window?: string | null
          contact_attempt_count?: number | null
          contact_notes?: string | null
          context_snapshot?: Json | null
          created_at?: string | null
          granted_months?: number | null
          id?: string
          last_contact_at?: string | null
          reason?: string | null
          rejection_reason?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          subscription_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_to_user_id?: string | null
          buyer_id?: string
          callback_window?: string | null
          contact_attempt_count?: number | null
          contact_notes?: string | null
          context_snapshot?: Json | null
          created_at?: string | null
          granted_months?: number | null
          id?: string
          last_contact_at?: string | null
          reason?: string | null
          rejection_reason?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_extension_requests_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "buyer_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_extension_requests_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "v_buyer_subscription_overview"
            referencedColumns: ["subscription_id"]
          },
        ]
      }
      supplier_proprietary_codes: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          last_observed_at: string
          match_method: string | null
          matched_product_id: string | null
          observation_count: number
          proprietary_code: string
          proprietary_label: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_supplier: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          last_observed_at?: string
          match_method?: string | null
          matched_product_id?: string | null
          observation_count?: number
          proprietary_code: string
          proprietary_label?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_supplier: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          last_observed_at?: string
          match_method?: string | null
          matched_product_id?: string | null
          observation_count?: number
          proprietary_code?: string
          proprietary_label?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_supplier?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_proprietary_codes_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "supplier_proprietary_codes_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_proprietary_codes_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "supplier_proprietary_codes_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_proprietary_codes_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_proprietary_codes_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
      translation_cache: {
        Row: {
          created_at: string
          hits: number
          last_used_at: string
          source_hash: string
          source_lang: string
          source_text: string
          target_lang: string
          translated_text: string
        }
        Insert: {
          created_at?: string
          hits?: number
          last_used_at?: string
          source_hash: string
          source_lang: string
          source_text: string
          target_lang: string
          translated_text: string
        }
        Update: {
          created_at?: string
          hits?: number
          last_used_at?: string
          source_hash?: string
          source_lang?: string
          source_text?: string
          target_lang?: string
          translated_text?: string
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
      user_price_watch_history: {
        Row: {
          action: string
          created_at: string
          id: string
          notes: string | null
          previous_price_excl_vat: number | null
          price_excl_vat: number | null
          product_id: string
          user_id: string
          watch_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          notes?: string | null
          previous_price_excl_vat?: number | null
          price_excl_vat?: number | null
          product_id: string
          user_id: string
          watch_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          notes?: string | null
          previous_price_excl_vat?: number | null
          price_excl_vat?: number | null
          product_id?: string
          user_id?: string
          watch_id?: string | null
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "user_price_watches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_price_watches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "user_price_watches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_price_watches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_price_watches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "user_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "user_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_addresses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_addresses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      vendor_attach_verifications: {
        Row: {
          consumed_at: string | null
          consumed_ip: string | null
          created_at: string
          created_by_admin_id: string | null
          email: string
          expires_at: string
          id: string
          token_hash: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          consumed_at?: string | null
          consumed_ip?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          email: string
          expires_at: string
          id?: string
          token_hash: string
          user_id: string
          vendor_id: string
        }
        Update: {
          consumed_at?: string | null
          consumed_ip?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_attach_verifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_attach_verifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_attach_verifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_attach_verifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_attach_verifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_attach_verifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_attach_verifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_buyer_overrides: {
        Row: {
          buyer_account_id: string
          created_at: string
          created_by: string | null
          default_moq: number | null
          default_mov: number | null
          id: string
          is_active: boolean
          notes: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          buyer_account_id: string
          created_at?: string
          created_by?: string | null
          default_moq?: number | null
          default_mov?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          buyer_account_id?: string
          created_at?: string
          created_by?: string | null
          default_moq?: number | null
          default_mov?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_buyer_overrides_buyer_account_id_fkey"
            columns: ["buyer_account_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_buyer_overrides_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_buyer_overrides_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_buyer_overrides_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_buyer_overrides_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_buyer_overrides_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_buyer_overrides_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_buyer_overrides_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_catalog_interests: {
        Row: {
          brand_id: string | null
          category_id: string | null
          created_at: string
          id: string
          manufacturer_id: string | null
          notify_new_brand: boolean
          notify_new_product: boolean
          vendor_id: string
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          manufacturer_id?: string | null
          notify_new_brand?: boolean
          notify_new_product?: boolean
          vendor_id: string
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          manufacturer_id?: string | null
          notify_new_brand?: boolean
          notify_new_product?: boolean
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_catalog_interests_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_catalog_interests_vendor_id_fkey"
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_commercial_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_commercial_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_competitor_vendor_id_fkey"
            columns: ["competitor_vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_competitor_vendor_id_fkey"
            columns: ["competitor_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_my_offer_id_fkey"
            columns: ["my_offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
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
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_my_offer_id_fkey"
            columns: ["my_offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
          linkedin_url: string | null
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
          linkedin_url?: string | null
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
          linkedin_url?: string | null
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_delegates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_delegates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      vendor_exclusivities: {
        Row: {
          brand_id: string | null
          buyer_profile_ids: string[] | null
          category_id: string | null
          commitment_months: number | null
          conditions_notes: string | null
          contract_ref: string | null
          country_codes: string[] | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          manufacturer_id: string | null
          min_revenue_cents: number | null
          min_volume_units: number | null
          mode: Database["public"]["Enums"]["vendor_exclusivity_mode"]
          product_id: string | null
          reason: string | null
          scope: Database["public"]["Enums"]["vendor_exclusivity_scope"]
          updated_at: string
          valid_from: string
          valid_until: string
          vendor_id: string
        }
        Insert: {
          brand_id?: string | null
          buyer_profile_ids?: string[] | null
          category_id?: string | null
          commitment_months?: number | null
          conditions_notes?: string | null
          contract_ref?: string | null
          country_codes?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          manufacturer_id?: string | null
          min_revenue_cents?: number | null
          min_volume_units?: number | null
          mode: Database["public"]["Enums"]["vendor_exclusivity_mode"]
          product_id?: string | null
          reason?: string | null
          scope: Database["public"]["Enums"]["vendor_exclusivity_scope"]
          updated_at?: string
          valid_from: string
          valid_until: string
          vendor_id: string
        }
        Update: {
          brand_id?: string | null
          buyer_profile_ids?: string[] | null
          category_id?: string | null
          commitment_months?: number | null
          conditions_notes?: string | null
          contract_ref?: string | null
          country_codes?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          manufacturer_id?: string | null
          min_revenue_cents?: number | null
          min_volume_units?: number | null
          mode?: Database["public"]["Enums"]["vendor_exclusivity_mode"]
          product_id?: string | null
          reason?: string | null
          scope?: Database["public"]["Enums"]["vendor_exclusivity_scope"]
          updated_at?: string
          valid_from?: string
          valid_until?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_exclusivities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_exclusivity_requests: {
        Row: {
          admin_notes: string | null
          country_codes: string[]
          created_at: string
          created_exclusivity_id: string | null
          id: string
          message: string | null
          mode: string
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scope_id: string | null
          scope_label: string | null
          scope_type: string
          status: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          vendor_id: string
        }
        Insert: {
          admin_notes?: string | null
          country_codes?: string[]
          created_at?: string
          created_exclusivity_id?: string | null
          id?: string
          message?: string | null
          mode: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope_id?: string | null
          scope_label?: string | null
          scope_type: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          vendor_id: string
        }
        Update: {
          admin_notes?: string | null
          country_codes?: string[]
          created_at?: string
          created_exclusivity_id?: string | null
          id?: string
          message?: string | null
          mode?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope_id?: string | null
          scope_label?: string | null
          scope_type?: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_exclusivity_requests_created_exclusivity_id_fkey"
            columns: ["created_exclusivity_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_exclusivity_v"
            referencedColumns: ["exclusivity_id"]
          },
          {
            foreignKeyName: "vendor_exclusivity_requests_created_exclusivity_id_fkey"
            columns: ["created_exclusivity_id"]
            isOneToOne: false
            referencedRelation: "vendor_exclusivities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivity_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_exclusivity_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_exclusivity_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivity_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_exclusivity_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_exclusivity_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivity_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_guarantee_acceptances: {
        Row: {
          accepted_at: string
          accepted_by_user_id: string | null
          created_at: string
          guarantee_version_id: string
          id: string
          ip: string | null
          source: Database["public"]["Enums"]["guarantee_acceptance_source"]
          user_agent: string | null
          vendor_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_by_user_id?: string | null
          created_at?: string
          guarantee_version_id: string
          id?: string
          ip?: string | null
          source?: Database["public"]["Enums"]["guarantee_acceptance_source"]
          user_agent?: string | null
          vendor_id: string
        }
        Update: {
          accepted_at?: string
          accepted_by_user_id?: string | null
          created_at?: string
          guarantee_version_id?: string
          id?: string
          ip?: string | null
          source?: Database["public"]["Enums"]["guarantee_acceptance_source"]
          user_agent?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_guarantee_acceptances_guarantee_version_id_fkey"
            columns: ["guarantee_version_id"]
            isOneToOne: false
            referencedRelation: "marketplace_guarantee_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_guarantee_acceptances_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_guarantee_acceptances_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_guarantee_acceptances_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_guarantee_acceptances_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_guarantee_acceptances_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_guarantee_acceptances_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_guarantee_acceptances_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invoice_payment_rules: {
        Row: {
          country_code: string | null
          created_at: string
          customer_id: string | null
          customer_type: Database["public"]["Enums"]["customer_type"] | null
          enabled: boolean
          id: string
          label: string | null
          min_amount_cents: number
          net_days: number
          priority: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          customer_id?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          enabled?: boolean
          id?: string
          label?: string | null
          min_amount_cents?: number
          net_days?: number
          priority?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          customer_id?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          enabled?: boolean
          id?: string
          label?: string | null
          min_amount_cents?: number
          net_days?: number
          priority?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoice_payment_rules_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invoice_payment_settings: {
        Row: {
          allow_custom_net_days: boolean
          auto_remind_enabled: boolean
          created_at: string
          default_net_days: number
          enabled: boolean
          max_net_days: number
          min_net_days: number
          min_order_amount_cents: number
          remind_days_after_due: number[]
          remind_days_before_due: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          allow_custom_net_days?: boolean
          auto_remind_enabled?: boolean
          created_at?: string
          default_net_days?: number
          enabled?: boolean
          max_net_days?: number
          min_net_days?: number
          min_order_amount_cents?: number
          remind_days_after_due?: number[]
          remind_days_before_due?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          allow_custom_net_days?: boolean
          auto_remind_enabled?: boolean
          created_at?: string
          default_net_days?: number
          enabled?: boolean
          max_net_days?: number
          min_net_days?: number
          min_order_amount_cents?: number
          remind_days_after_due?: number[]
          remind_days_before_due?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoice_payment_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoice_payment_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_kyc_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_kyc_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      vendor_manual_sell_in_lines: {
        Row: {
          cnk_code: string | null
          created_at: string
          gross_revenue_cents: number
          gtin: string | null
          id: string
          net_revenue_cents: number
          product_id: string | null
          raw_label: string | null
          report_id: string
          units: number
        }
        Insert: {
          cnk_code?: string | null
          created_at?: string
          gross_revenue_cents?: number
          gtin?: string | null
          id?: string
          net_revenue_cents?: number
          product_id?: string | null
          raw_label?: string | null
          report_id: string
          units?: number
        }
        Update: {
          cnk_code?: string | null
          created_at?: string
          gross_revenue_cents?: number
          gtin?: string | null
          id?: string
          net_revenue_cents?: number
          product_id?: string | null
          raw_label?: string | null
          report_id?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_manual_sell_in_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_lines_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "vendor_manual_sell_in_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_manual_sell_in_reports: {
        Row: {
          created_at: string
          created_by: string | null
          currency_code: string
          customer_label: string | null
          file_name: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          pharmacy_id: string | null
          source: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_label?: string | null
          file_name?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          pharmacy_id?: string | null
          source?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_label?: string | null
          file_name?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          pharmacy_id?: string | null
          source?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_manual_sell_in_reports_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "be_pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_reports_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_reports_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_reports_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_reports_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_reports_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_reports_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_manual_sell_in_reports_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_market_intel_entitlements: {
        Row: {
          billing_method:
            | Database["public"]["Enums"]["vendor_market_intel_billing"]
            | null
          created_at: string
          granted_by: string | null
          notes: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["vendor_market_intel_status"]
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_started_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          billing_method?:
            | Database["public"]["Enums"]["vendor_market_intel_billing"]
            | null
          created_at?: string
          granted_by?: string | null
          notes?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["vendor_market_intel_status"]
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_started_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          billing_method?:
            | Database["public"]["Enums"]["vendor_market_intel_billing"]
            | null
          created_at?: string
          granted_by?: string | null
          notes?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["vendor_market_intel_status"]
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_started_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_market_intel_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_market_intel_entitlements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_market_intel_entitlements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_market_intel_entitlements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_market_intel_entitlements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_market_intel_entitlements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_market_intel_entitlements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_market_intel_entitlements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_market_intel_plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          description: string | null
          ean_quota: number | null
          id: string
          is_active: boolean
          label: string
          monthly_price_cents: number
          sort_order: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          ean_quota?: number | null
          id?: string
          is_active?: boolean
          label: string
          monthly_price_cents?: number
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          ean_quota?: number | null
          id?: string
          is_active?: boolean
          label?: string
          monthly_price_cents?: number
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vendor_market_intel_request_audit_log: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event: string
          id: string
          message: string | null
          new_status: string | null
          previous_status: string | null
          request_id: string
          vendor_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event: string
          id?: string
          message?: string | null
          new_status?: string | null
          previous_status?: string | null
          request_id: string
          vendor_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event?: string
          id?: string
          message?: string | null
          new_status?: string | null
          previous_status?: string | null
          request_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_market_intel_request_audit_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_market_intel_requests: {
        Row: {
          created_at: string
          created_by: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          kind: string
          message: string | null
          status: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind: string
          message?: string | null
          status?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind?: string
          message?: string | null
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_market_intel_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_market_intel_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_market_intel_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_market_intel_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_market_intel_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_market_intel_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_market_intel_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_notification_dispatch_log: {
        Row: {
          dispatched_at: string
          id: string
          interest_id: string | null
          notification_id: string | null
          source_id: string
          source_type: string
          vendor_id: string
        }
        Insert: {
          dispatched_at?: string
          id?: string
          interest_id?: string | null
          notification_id?: string | null
          source_id: string
          source_type: string
          vendor_id: string
        }
        Update: {
          dispatched_at?: string
          id?: string
          interest_id?: string | null
          notification_id?: string | null
          source_id?: string
          source_type?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_notification_dispatch_log_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "vendor_catalog_interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notification_dispatch_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "vendor_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notification_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notification_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notification_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notification_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notification_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notification_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notification_dispatch_log_vendor_id_fkey"
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notification_preferences_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notification_preferences_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notification_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notification_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      vendor_notifications: {
        Row: {
          body: string | null
          created_at: string
          cta_url: string | null
          email_sent_at: string | null
          id: string
          payload: Json | null
          read_at: string | null
          title: string
          type: string
          vendor_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          cta_url?: string | null
          email_sent_at?: string | null
          id?: string
          payload?: Json | null
          read_at?: string | null
          title: string
          type: string
          vendor_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          cta_url?: string | null
          email_sent_at?: string | null
          id?: string
          payload?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_offer_campaigns: {
        Row: {
          created_at: string
          default_currency: string
          default_lead_time_days: number | null
          default_vat_rate: number | null
          default_zones: string[] | null
          global_mov_cents: number | null
          id: string
          imported_brand_ids: string[] | null
          imported_manufacturer_ids: string[] | null
          name: string
          notes: string | null
          published_at: string | null
          source_mode: Database["public"]["Enums"]["vendor_offer_campaign_source"]
          status: Database["public"]["Enums"]["vendor_offer_campaign_status"]
          updated_at: string
          vendor_id: string
          xlsx_source_url: string | null
        }
        Insert: {
          created_at?: string
          default_currency?: string
          default_lead_time_days?: number | null
          default_vat_rate?: number | null
          default_zones?: string[] | null
          global_mov_cents?: number | null
          id?: string
          imported_brand_ids?: string[] | null
          imported_manufacturer_ids?: string[] | null
          name: string
          notes?: string | null
          published_at?: string | null
          source_mode: Database["public"]["Enums"]["vendor_offer_campaign_source"]
          status?: Database["public"]["Enums"]["vendor_offer_campaign_status"]
          updated_at?: string
          vendor_id: string
          xlsx_source_url?: string | null
        }
        Update: {
          created_at?: string
          default_currency?: string
          default_lead_time_days?: number | null
          default_vat_rate?: number | null
          default_zones?: string[] | null
          global_mov_cents?: number | null
          id?: string
          imported_brand_ids?: string[] | null
          imported_manufacturer_ids?: string[] | null
          name?: string
          notes?: string | null
          published_at?: string | null
          source_mode?: Database["public"]["Enums"]["vendor_offer_campaign_source"]
          status?: Database["public"]["Enums"]["vendor_offer_campaign_status"]
          updated_at?: string
          vendor_id?: string
          xlsx_source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_offer_campaigns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_offer_campaigns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_offer_campaigns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_offer_campaigns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_offer_campaigns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_offer_campaigns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_offer_campaigns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_offer_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_offer_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_offer_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_offer_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_offer_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_offer_history_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_offer_history_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_offer_history_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      vendor_onboarding_email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string
          locale: string | null
          mode: string
          recipient_email: string
          status: string
          template_name: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          locale?: string | null
          mode: string
          recipient_email: string
          status: string
          template_name: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          locale?: string | null
          mode?: string
          recipient_email?: string
          status?: string
          template_name?: string
          vendor_id?: string | null
        }
        Relationships: []
      }
      vendor_order_tokens: {
        Row: {
          created_at: string
          expires_at: string
          order_id: string
          order_number: string
          sub_order_id: string
          token_hash: string
          used_at: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          order_id: string
          order_number: string
          sub_order_id: string
          token_hash: string
          used_at?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          order_id?: string
          order_number?: string
          sub_order_id?: string
          token_hash?: string
          used_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_order_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "vendor_order_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_with_forecast_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_order_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_order_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_visible_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_order_tokens_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: true
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["sub_order_id"]
          },
          {
            foreignKeyName: "vendor_order_tokens_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: true
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_order_tokens_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_order_tokens_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_order_tokens_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_order_tokens_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_order_tokens_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_order_tokens_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_order_tokens_vendor_id_fkey"
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_price_alert_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_price_alert_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_price_alert_events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_price_alert_events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_price_alert_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_price_alert_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_price_alert_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_price_alert_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_alert_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_price_alert_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_price_alert_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      vendor_price_challenges: {
        Row: {
          created_at: string
          delta_pct: number | null
          id: string
          message: string | null
          mk_price_ht: number | null
          notification_id: string | null
          offer_id: string | null
          product_id: string
          reason: string
          ref_price_ht: number | null
          responded_at: string | null
          responded_delta_pct: number | null
          sent_by: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          delta_pct?: number | null
          id?: string
          message?: string | null
          mk_price_ht?: number | null
          notification_id?: string | null
          offer_id?: string | null
          product_id: string
          reason: string
          ref_price_ht?: number | null
          responded_at?: string | null
          responded_delta_pct?: number | null
          sent_by?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          delta_pct?: number | null
          id?: string
          message?: string | null
          mk_price_ht?: number | null
          notification_id?: string | null
          offer_id?: string | null
          product_id?: string
          reason?: string
          ref_price_ht?: number | null
          responded_at?: string | null
          responded_delta_pct?: number | null
          sent_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_price_challenges_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "vendor_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "public_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_product_commissions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          commission_model: string
          commission_rate: number | null
          created_at: string
          created_by: string | null
          created_via_admin_shortcut: boolean
          fixed_commission_amount: number | null
          id: string
          margin_split_pct: number | null
          note: string | null
          product_id: string
          rejected_reason: string | null
          status: Database["public"]["Enums"]["commission_override_status"]
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          vendor_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          commission_model: string
          commission_rate?: number | null
          created_at?: string
          created_by?: string | null
          created_via_admin_shortcut?: boolean
          fixed_commission_amount?: number | null
          id?: string
          margin_split_pct?: number | null
          note?: string | null
          product_id: string
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["commission_override_status"]
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          vendor_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          commission_model?: string
          commission_rate?: number | null
          created_at?: string
          created_by?: string | null
          created_via_admin_shortcut?: boolean
          fixed_commission_amount?: number | null
          id?: string
          margin_split_pct?: number | null
          note?: string | null
          product_id?: string
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["commission_override_status"]
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_product_commissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_product_commissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_product_commissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_product_commissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_product_commissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_product_commissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_product_commissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_product_commissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_product_commissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_product_commissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_product_commissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_product_commissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_product_commissions_vendor_id_fkey"
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_product_costs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_product_costs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_product_costs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
          default_discount_pct: number | null
          default_moq: number
          default_mov: number
          default_mov_currency: string
          default_price_excl_vat: number | null
          default_pricing_mode: string | null
          id: string
          profile_type: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          default_discount_pct?: number | null
          default_moq?: number
          default_mov?: number
          default_mov_currency?: string
          default_price_excl_vat?: number | null
          default_pricing_mode?: string | null
          id?: string
          profile_type: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          default_discount_pct?: number | null
          default_moq?: number
          default_mov?: number
          default_mov_currency?: string
          default_price_excl_vat?: number | null
          default_pricing_mode?: string | null
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_profile_defaults_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_profile_defaults_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      vendor_sell_out_lines: {
        Row: {
          cnk_code: string | null
          created_at: string
          gross_revenue_cents: number
          gtin: string | null
          id: string
          net_revenue_cents: number
          product_id: string | null
          raw_label: string | null
          report_id: string
          units: number
        }
        Insert: {
          cnk_code?: string | null
          created_at?: string
          gross_revenue_cents?: number
          gtin?: string | null
          id?: string
          net_revenue_cents?: number
          product_id?: string | null
          raw_label?: string | null
          report_id: string
          units?: number
        }
        Update: {
          cnk_code?: string | null
          created_at?: string
          gross_revenue_cents?: number
          gtin?: string | null
          id?: string
          net_revenue_cents?: number
          product_id?: string | null
          raw_label?: string | null
          report_id?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_sell_out_lines_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "vendor_sell_out_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_sell_out_reports: {
        Row: {
          created_at: string
          created_by: string | null
          currency_code: string
          customer_id: string | null
          customer_label: string | null
          file_name: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          source: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_id?: string | null
          customer_label?: string | null
          file_name?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          source?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_id?: string | null
          customer_label?: string | null
          file_name?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          source?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      vendor_sendcloud_credentials: {
        Row: {
          created_at: string
          id: string
          is_connected: boolean
          last_verified_at: string | null
          public_key_cipher: string | null
          secret_key_cipher: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_connected?: boolean
          last_verified_at?: string | null
          public_key_cipher?: string | null
          secret_key_cipher?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_connected?: boolean
          last_verified_at?: string | null
          public_key_cipher?: string | null
          secret_key_cipher?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_sendcloud_credentials_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_sendcloud_credentials_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_sendcloud_credentials_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_shipping_addresses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_shipping_addresses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      vendor_sla_settings: {
        Row: {
          created_at: string
          enabled: boolean
          hours_critical_escalation: number
          hours_to_confirm: number
          hours_to_ship: number
          hours_to_view: number
          id: number
          notify_admin_email: string | null
          send_vendor_reminder: boolean
          slack_webhook_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          hours_critical_escalation?: number
          hours_to_confirm?: number
          hours_to_ship?: number
          hours_to_view?: number
          id?: number
          notify_admin_email?: string | null
          send_vendor_reminder?: boolean
          slack_webhook_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          hours_critical_escalation?: number
          hours_to_confirm?: number
          hours_to_ship?: number
          hours_to_view?: number
          id?: number
          notify_admin_email?: string | null
          send_vendor_reminder?: boolean
          slack_webhook_url?: string | null
          updated_at?: string
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_visibility_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_visibility_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
          accepted_currencies: string[]
          accepts_rfq: boolean
          address_line1: string | null
          auth_user_id: string | null
          auto_forward_to_qogita: boolean
          bank_name: string | null
          bce_number: string | null
          bic: string | null
          business_type: string | null
          can_manage_offers: boolean
          city: string | null
          commission_model: Database["public"]["Enums"]["commission_model_enum"]
          commission_rate: number
          commissionnaire_agreement_accepted_at: string | null
          commissionnaire_agreement_version: string | null
          company_name: string | null
          contact_email: string | null
          contact_name: string | null
          contact_person: string | null
          country_code: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_code: string
          email: string | null
          facebook_url: string | null
          fixed_commission_amount: number | null
          iban: string | null
          id: string
          instagram_url: string | null
          is_active: boolean
          is_manufacturer: boolean
          is_top_seller: boolean | null
          is_verified: boolean
          last_sync_run_id: string | null
          linkedin_url: string | null
          logo_url: string | null
          mandate_signed_at: string | null
          margin_split_pct: number
          max_open_rfqs: number | null
          name: string
          phone: string | null
          postal_code: string | null
          preferred_language: string | null
          qogita_seller_alias: string | null
          rating: number | null
          representative_name: string | null
          representative_role: string | null
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
          ships_to_countries: string[]
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
          accepted_currencies?: string[]
          accepts_rfq?: boolean
          address_line1?: string | null
          auth_user_id?: string | null
          auto_forward_to_qogita?: boolean
          bank_name?: string | null
          bce_number?: string | null
          bic?: string | null
          business_type?: string | null
          can_manage_offers?: boolean
          city?: string | null
          commission_model?: Database["public"]["Enums"]["commission_model_enum"]
          commission_rate?: number
          commissionnaire_agreement_accepted_at?: string | null
          commissionnaire_agreement_version?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_person?: string | null
          country_code?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_code?: string
          email?: string | null
          facebook_url?: string | null
          fixed_commission_amount?: number | null
          iban?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          is_manufacturer?: boolean
          is_top_seller?: boolean | null
          is_verified?: boolean
          last_sync_run_id?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          mandate_signed_at?: string | null
          margin_split_pct?: number
          max_open_rfqs?: number | null
          name: string
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          qogita_seller_alias?: string | null
          rating?: number | null
          representative_name?: string | null
          representative_role?: string | null
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
          ships_to_countries?: string[]
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
          accepted_currencies?: string[]
          accepts_rfq?: boolean
          address_line1?: string | null
          auth_user_id?: string | null
          auto_forward_to_qogita?: boolean
          bank_name?: string | null
          bce_number?: string | null
          bic?: string | null
          business_type?: string | null
          can_manage_offers?: boolean
          city?: string | null
          commission_model?: Database["public"]["Enums"]["commission_model_enum"]
          commission_rate?: number
          commissionnaire_agreement_accepted_at?: string | null
          commissionnaire_agreement_version?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_person?: string | null
          country_code?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_code?: string
          email?: string | null
          facebook_url?: string | null
          fixed_commission_amount?: number | null
          iban?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          is_manufacturer?: boolean
          is_top_seller?: boolean | null
          is_verified?: boolean
          last_sync_run_id?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          mandate_signed_at?: string | null
          margin_split_pct?: number
          max_open_rfqs?: number | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          qogita_seller_alias?: string | null
          rating?: number | null
          representative_name?: string | null
          representative_role?: string | null
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
          ships_to_countries?: string[]
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
      wholesaler_profiles: {
        Row: {
          country: string
          created_at: string
          default_discount_pct: number | null
          default_discount_rules_json: Json | null
          discount_mechanic: string
          display_name: string
          extraction_hints_json: Json | null
          id: string
          is_active: boolean
          known_supplier_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          default_discount_pct?: number | null
          default_discount_rules_json?: Json | null
          discount_mechanic: string
          display_name: string
          extraction_hints_json?: Json | null
          id?: string
          is_active?: boolean
          known_supplier_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          default_discount_pct?: number | null
          default_discount_rules_json?: Json | null
          discount_mechanic?: string
          display_name?: string
          extraction_hints_json?: Json | null
          id?: string
          is_active?: boolean
          known_supplier_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesaler_profiles_known_supplier_id_fkey"
            columns: ["known_supplier_id"]
            isOneToOne: false
            referencedRelation: "known_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_category_vat_audit: {
        Row: {
          id: string | null
          name: string | null
          parent_id: string | null
          product_count: number | null
          slug: string | null
          vat_rate: number | null
          was_auto_defaulted: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_orders_sla_overview_v: {
        Row: {
          alert_created_at: string | null
          alert_id: string | null
          alert_type: string | null
          buyer_name: string | null
          hours_overdue: number | null
          order_created_at: string | null
          order_id: string | null
          order_number: string | null
          order_status: Database["public"]["Enums"]["order_status"] | null
          resolved_at: string | null
          severity: string | null
          shipped_at: string | null
          sub_order_id: string | null
          sub_order_status:
            | Database["public"]["Enums"]["fulfillment_status"]
            | null
          threshold_hours: number | null
          total_incl_vat: number | null
          vendor_confirmed_at: string | null
          vendor_first_viewed_at: string | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_slug: string | null
        }
        Relationships: []
      }
      admin_orders_with_forecast_v: {
        Row: {
          created_at: string | null
          customer_id: string | null
          effective_total_incl_vat: number | null
          forecast_converted_at: string | null
          forecast_created_at: string | null
          forecast_snapshot: Json | null
          forecast_status: string | null
          forecast_total_incl_vat: number | null
          id: string | null
          is_forecast: boolean | null
          order_number: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal_excl_vat: number | null
          total_incl_vat: number | null
          updated_at: string | null
          vat_amount: number | null
          was_forecast: boolean | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          effective_total_incl_vat?: never
          forecast_converted_at?: string | null
          forecast_created_at?: string | null
          forecast_snapshot?: Json | null
          forecast_status?: never
          forecast_total_incl_vat?: never
          id?: string | null
          is_forecast?: boolean | null
          order_number?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal_excl_vat?: number | null
          total_incl_vat?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          was_forecast?: boolean | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          effective_total_incl_vat?: never
          forecast_converted_at?: string | null
          forecast_created_at?: string | null
          forecast_snapshot?: Json | null
          forecast_status?: never
          forecast_total_incl_vat?: never
          id?: string | null
          is_forecast?: boolean | null
          order_number?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal_excl_vat?: number | null
          total_incl_vat?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          was_forecast?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_price_cockpit_mv: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          category_id: string | null
          cnk: string | null
          country_code: string | null
          delta_vs_external_pct: number | null
          delta_vs_internal_pct: number | null
          external_best_ht: number | null
          external_best_source: string | null
          external_best_url: string | null
          external_offers_count: number | null
          market_grossiste_ht: number | null
          market_pharm_ht: number | null
          market_public_ht: number | null
          mk_2nd_ht: number | null
          mk_best_ht: number | null
          mk_best_offer_id: string | null
          mk_best_vendor_id: string | null
          mk_best_vendor_name: string | null
          mk_offers_count: number | null
          popularity: number | null
          product_id: string | null
          product_name: string | null
          pvp_ttc: number | null
          refreshed_at: string | null
          worst_action_score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["mk_best_vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["mk_best_vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["mk_best_vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["mk_best_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["mk_best_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["mk_best_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["mk_best_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_sourcing_items_by_brand_v: {
        Row: {
          brand_id: string | null
          brand_key: string | null
          brand_label: string | null
          inactive_count: number | null
          items_count: number | null
          last_seen_at: string | null
          medikong_active_products_count: number | null
          no_offer_count: number | null
          total_imports: number | null
          total_quantity: number | null
          total_users: number | null
          unmatched_count: number | null
        }
        Relationships: []
      }
      admin_unmapped_categories: {
        Row: {
          products_count: number | null
          source_path: string | null
        }
        Relationships: []
      }
      admin_unmapped_qogita_categories: {
        Row: {
          products_count: number | null
          qogita_category_id: string | null
          qogita_name: string | null
          qogita_qid: string | null
        }
        Relationships: []
      }
      brand_kpis: {
        Row: {
          active_offer_count: number | null
          active_product_count: number | null
          active_vendor_count: number | null
          avg_delivery_days: number | null
          brand_id: string | null
          last_offer_update_at: string | null
          min_price_excl_vat: number | null
          ships_from_country_count: number | null
          slug: string | null
        }
        Relationships: []
      }
      brand_logistics_stats: {
        Row: {
          avg_delivery_days: number | null
          avg_order_value: number | null
          brand_id: string | null
          brand_slug: string | null
          order_count_90d: number | null
          stock_availability_pct: number | null
        }
        Relationships: []
      }
      catalog_health_missing_offers_frequency_v: {
        Row: {
          country_code: string | null
          first_seen_at: string | null
          last_seen_at: string | null
          missing_run_count: number | null
          product_id: string | null
          total_runs_30d: number | null
        }
        Relationships: []
      }
      catalog_products: {
        Row: {
          brand_id: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          primary_category_id: string | null
          slug: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          primary_category_id?: string | null
          slug?: string | null
          status?: never
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          primary_category_id?: string | null
          slug?: string | null
          status?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "products_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "order_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
          },
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
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
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
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_with_forecast_v"
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
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_visible_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "order_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      effective_offer_exclusivity_v: {
        Row: {
          brand_id: string | null
          buyer_profile_ids: string[] | null
          category_id: string | null
          commitment_months: number | null
          contract_ref: string | null
          country_codes: string[] | null
          exclusivity_id: string | null
          manufacturer_id: string | null
          mode: Database["public"]["Enums"]["vendor_exclusivity_mode"] | null
          product_id: string | null
          scope: Database["public"]["Enums"]["vendor_exclusivity_scope"] | null
          valid_from: string | null
          valid_until: string | null
          vendor_id: string | null
        }
        Insert: {
          brand_id?: string | null
          buyer_profile_ids?: string[] | null
          category_id?: string | null
          commitment_months?: number | null
          contract_ref?: string | null
          country_codes?: string[] | null
          exclusivity_id?: string | null
          manufacturer_id?: string | null
          mode?: Database["public"]["Enums"]["vendor_exclusivity_mode"] | null
          product_id?: string | null
          scope?: Database["public"]["Enums"]["vendor_exclusivity_scope"] | null
          valid_from?: string | null
          valid_until?: string | null
          vendor_id?: string | null
        }
        Update: {
          brand_id?: string | null
          buyer_profile_ids?: string[] | null
          category_id?: string | null
          commitment_months?: number | null
          contract_ref?: string | null
          country_codes?: string[] | null
          exclusivity_id?: string | null
          manufacturer_id?: string | null
          mode?: Database["public"]["Enums"]["vendor_exclusivity_mode"] | null
          product_id?: string | null
          scope?: Database["public"]["Enums"]["vendor_exclusivity_scope"] | null
          valid_from?: string | null
          valid_until?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_exclusivities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_exclusivities_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      effective_offer_prices_v: {
        Row: {
          base_price_excl_vat: number | null
          base_price_incl_vat: number | null
          buyer_profile_id: string | null
          effective_price_excl_vat: number | null
          effective_price_incl_vat: number | null
          offer_id: string | null
          price_source: string | null
          product_id: string | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      external_offers_with_exclusivity_v: {
        Row: {
          exclusive_vendor_id: string | null
          exclusivity_id: string | null
          exclusivity_mode:
            | Database["public"]["Enums"]["vendor_exclusivity_mode"]
            | null
          external_offer_id: string | null
          external_vendor_id: string | null
          is_active: boolean | null
          is_blocked: boolean | null
          is_hidden: boolean | null
          is_showcase_dimmed: boolean | null
          product_id: string | null
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "external_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "external_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      market_intelligence_v: {
        Row: {
          max_price: number | null
          median_price: number | null
          min_price: number | null
          observations_count: number | null
          product_id: string | null
          q1_price: number | null
          q3_price: number | null
          source_supplier: string | null
          week: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_price_observations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_price_observations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_observations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "market_price_observations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_observations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_observations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      offers_public_v: {
        Row: {
          admin_hidden: boolean | null
          admin_hidden_at: string | null
          campaign_id: string | null
          carton_size_override: number | null
          country_code: string | null
          created_at: string | null
          delivery_days: number | null
          down_payment_pct: number | null
          estimated_delivery_days: number | null
          has_extended_delivery: boolean | null
          id: string | null
          is_active: boolean | null
          is_qogita_backed: boolean | null
          is_top_seller: boolean | null
          is_traceable: boolean | null
          max_delivery_days: number | null
          min_delivery_days: number | null
          moq: number | null
          mov: number | null
          mov_amount: number | null
          mov_currency: string | null
          pack_size_override: number | null
          packaging_languages: string[] | null
          price_excl_vat: number | null
          price_incl_vat: number | null
          price_tiers: Json | null
          product_id: string | null
          qogita_base_delay_days: number | null
          qogita_offer_qid: string | null
          shipping_from_country: string | null
          source_supplier: string | null
          stock_quantity: number | null
          stock_status: Database["public"]["Enums"]["stock_status_enum"] | null
          suggested_retail_price_cents: number | null
          suggested_retail_price_source:
            | Database["public"]["Enums"]["pvp_source_enum"]
            | null
          synced_at: string | null
          updated_at: string | null
          vat_rate: number | null
          vendor_id: string | null
        }
        Insert: {
          admin_hidden?: boolean | null
          admin_hidden_at?: string | null
          campaign_id?: string | null
          carton_size_override?: number | null
          country_code?: string | null
          created_at?: string | null
          delivery_days?: number | null
          down_payment_pct?: number | null
          estimated_delivery_days?: number | null
          has_extended_delivery?: boolean | null
          id?: string | null
          is_active?: boolean | null
          is_qogita_backed?: boolean | null
          is_top_seller?: boolean | null
          is_traceable?: boolean | null
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          moq?: number | null
          mov?: number | null
          mov_amount?: number | null
          mov_currency?: string | null
          pack_size_override?: number | null
          packaging_languages?: string[] | null
          price_excl_vat?: number | null
          price_incl_vat?: number | null
          price_tiers?: Json | null
          product_id?: string | null
          qogita_base_delay_days?: number | null
          qogita_offer_qid?: string | null
          shipping_from_country?: string | null
          source_supplier?: string | null
          stock_quantity?: number | null
          stock_status?: Database["public"]["Enums"]["stock_status_enum"] | null
          suggested_retail_price_cents?: number | null
          suggested_retail_price_source?:
            | Database["public"]["Enums"]["pvp_source_enum"]
            | null
          synced_at?: string | null
          updated_at?: string | null
          vat_rate?: number | null
          vendor_id?: string | null
        }
        Update: {
          admin_hidden?: boolean | null
          admin_hidden_at?: string | null
          campaign_id?: string | null
          carton_size_override?: number | null
          country_code?: string | null
          created_at?: string | null
          delivery_days?: number | null
          down_payment_pct?: number | null
          estimated_delivery_days?: number | null
          has_extended_delivery?: boolean | null
          id?: string | null
          is_active?: boolean | null
          is_qogita_backed?: boolean | null
          is_top_seller?: boolean | null
          is_traceable?: boolean | null
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          moq?: number | null
          mov?: number | null
          mov_amount?: number | null
          mov_currency?: string | null
          pack_size_override?: number | null
          packaging_languages?: string[] | null
          price_excl_vat?: number | null
          price_incl_vat?: number | null
          price_tiers?: Json | null
          product_id?: string | null
          qogita_base_delay_days?: number | null
          qogita_offer_qid?: string | null
          shipping_from_country?: string | null
          source_supplier?: string | null
          stock_quantity?: number | null
          stock_status?: Database["public"]["Enums"]["stock_status_enum"] | null
          suggested_retail_price_cents?: number | null
          suggested_retail_price_source?:
            | Database["public"]["Enums"]["pvp_source_enum"]
            | null
          synced_at?: string | null
          updated_at?: string | null
          vat_rate?: number | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "vendor_offer_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      offers_with_exclusivity_v: {
        Row: {
          exclusive_vendor_id: string | null
          exclusivity_id: string | null
          exclusivity_mode:
            | Database["public"]["Enums"]["vendor_exclusivity_mode"]
            | null
          is_active: boolean | null
          is_blocked: boolean | null
          is_hidden: boolean | null
          is_showcase_dimmed: boolean | null
          offer_id: string | null
          product_id: string | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      orders_visible_v: {
        Row: {
          admin_notes: string | null
          api_key_id: string | null
          billing_address: Json | null
          created_at: string | null
          customer_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          estimated_delivery_date: string | null
          hidden_from_list: boolean | null
          id: string | null
          is_test: boolean | null
          notes: string | null
          order_number: string | null
          payment_due_date: string | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_status:
            | Database["public"]["Enums"]["payment_status_enum"]
            | null
          shipping_address: Json | null
          source: Database["public"]["Enums"]["order_source"] | null
          status: Database["public"]["Enums"]["order_status"] | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal_excl_vat: number | null
          total_cost: number | null
          total_incl_vat: number | null
          total_margin: number | null
          updated_at: string | null
          vat_amount: number | null
        }
        Insert: {
          admin_notes?: string | null
          api_key_id?: string | null
          billing_address?: Json | null
          created_at?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          estimated_delivery_date?: string | null
          hidden_from_list?: boolean | null
          id?: string | null
          is_test?: boolean | null
          notes?: string | null
          order_number?: string | null
          payment_due_date?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_status?:
            | Database["public"]["Enums"]["payment_status_enum"]
            | null
          shipping_address?: Json | null
          source?: Database["public"]["Enums"]["order_source"] | null
          status?: Database["public"]["Enums"]["order_status"] | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_excl_vat?: number | null
          total_cost?: number | null
          total_incl_vat?: number | null
          total_margin?: number | null
          updated_at?: string | null
          vat_amount?: number | null
        }
        Update: {
          admin_notes?: string | null
          api_key_id?: string | null
          billing_address?: Json | null
          created_at?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          estimated_delivery_date?: string | null
          hidden_from_list?: boolean | null
          id?: string | null
          is_test?: boolean | null
          notes?: string | null
          order_number?: string | null
          payment_due_date?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_status?:
            | Database["public"]["Enums"]["payment_status_enum"]
            | null
          shipping_address?: Json | null
          source?: Database["public"]["Enums"]["order_source"] | null
          status?: Database["public"]["Enums"]["order_status"] | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_excl_vat?: number | null
          total_cost?: number | null
          total_incl_vat?: number | null
          total_margin?: number | null
          updated_at?: string | null
          vat_amount?: number | null
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
      product_pack_audit_v: {
        Row: {
          cnk_code: string | null
          effective_pack_size: number | null
          effective_source: string | null
          external_offers_count: number | null
          external_pack_overrides: number[] | null
          external_with_override_count: number | null
          heuristic_pack_size: number | null
          mk_offers_count: number | null
          pack_resolution_status: string | null
          product_id: string | null
          product_name: string | null
          product_pack_size: number | null
          product_slug: string | null
        }
        Relationships: []
      }
      products_with_country_stats_v: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          category_id: string | null
          category_name: string | null
          cnk_code: string | null
          country_best_price_excl_vat: number | null
          country_best_price_incl_vat: number | null
          country_code: string | null
          country_is_in_stock: boolean | null
          country_offer_count: number | null
          country_total_stock: number | null
          created_at: string | null
          global_best_price_excl_vat: number | null
          global_best_price_incl_vat: number | null
          global_is_in_stock: boolean | null
          global_offer_count: number | null
          global_total_stock: number | null
          gtin: string | null
          id: string | null
          image_url: string | null
          image_urls: string[] | null
          is_active: boolean | null
          is_promotion: boolean | null
          manufacturer_id: string | null
          name: string | null
          name_de: string | null
          name_fr: string | null
          name_nl: string | null
          primary_category_id: string | null
          promotion_label: string | null
          short_description: string | null
          slug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
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
          {
            foreignKeyName: "products_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "products_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      public_home_featured_brands_v: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          brand_slug: string | null
          id: string | null
          locale: Database["public"]["Enums"]["home_featured_locale"] | null
          logo_url: string | null
          position: number | null
          valid_from: string | null
          valid_to: string | null
          website_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_featured_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "home_featured_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "home_featured_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "home_featured_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_featured_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      public_home_featured_products_v: {
        Row: {
          badge: Database["public"]["Enums"]["home_featured_badge"] | null
          best_price_excl_vat: number | null
          best_price_incl_vat: number | null
          brand_id: string | null
          brand_name: string | null
          category_id: string | null
          category_name: string | null
          id: string | null
          image_url: string | null
          image_urls: string[] | null
          locale: Database["public"]["Enums"]["home_featured_locale"] | null
          offer_count: number | null
          position: number | null
          product_id: string | null
          product_name: string | null
          product_slug: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "home_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "home_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_category_vat_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "admin_unmapped_qogita_categories"
            referencedColumns: ["qogita_category_id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      public_marketplace_metrics: {
        Row: {
          avg_offers_per_multi_product: number | null
          avg_offers_per_product: number | null
          brands_count: number | null
          max_offers_per_product: number | null
          median_offers_per_multi_product: number | null
          multi_vendor_products_count: number | null
          offers_count: number | null
          products_count: number | null
          products_on_promo: number | null
          refreshed_at: string | null
          singleton: number | null
          suppliers_count: number | null
        }
        Relationships: []
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      public_top_price_deltas: {
        Row: {
          brand_name: string | null
          delta_pct: number | null
          image_url: string | null
          image_urls: string[] | null
          max_price: number | null
          min_price: number | null
          name: string | null
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          offer_count: number | null
          product_id: string | null
          slug: string | null
        }
        Relationships: []
      }
      public_vendor_trust_signals: {
        Row: {
          avg_score: number | null
          company_name: string | null
          computed_at: string | null
          display_mode: string | null
          is_fagg_verified: boolean | null
          is_kyc_verified: boolean | null
          joined_at: string | null
          months_active: number | null
          on_time_pct_90d: number | null
          orders_90d_count: number | null
          public_identifier: string | null
          ratings_count: number | null
          ships_from_country: string | null
          total_orders: number | null
          vendor_id: string | null
        }
        Relationships: []
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "restock_offers_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_offers_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "restock_offers_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_offers_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_offers_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
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
      restock_seller_transactions_v: {
        Row: {
          buyer_city: string | null
          buyer_company: string | null
          buyer_country: string | null
          buyer_id: string | null
          buyer_name: string | null
          buyer_postal_code: string | null
          buyer_street: string | null
          cancelled_reason: string | null
          commission_amount: number | null
          commission_rate: number | null
          created_at: string | null
          delivered_at: string | null
          delivery_mode: string | null
          dispute_reason: string | null
          escrow_released_at: string | null
          final_price: number | null
          id: string | null
          offer_id: string | null
          paid_at: string | null
          penalty_applied: boolean | null
          pickup_confirmed_at: string | null
          pickup_deadline_at: string | null
          pickup_handover_code: string | null
          pickup_qr_token: string | null
          quantity: number | null
          seller_id: string | null
          seller_pickup_address: string | null
          seller_pickup_city: string | null
          seller_pickup_phone: string | null
          sendcloud_parcel_id: string | null
          shipping_cost: number | null
          status: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
        }
        Insert: {
          buyer_city?: string | null
          buyer_company?: string | null
          buyer_country?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_postal_code?: string | null
          buyer_street?: string | null
          cancelled_reason?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_mode?: string | null
          dispute_reason?: string | null
          escrow_released_at?: string | null
          final_price?: number | null
          id?: string | null
          offer_id?: string | null
          paid_at?: string | null
          penalty_applied?: boolean | null
          pickup_confirmed_at?: string | null
          pickup_deadline_at?: string | null
          pickup_handover_code?: string | null
          pickup_qr_token?: string | null
          quantity?: number | null
          seller_id?: string | null
          seller_pickup_address?: string | null
          seller_pickup_city?: string | null
          seller_pickup_phone?: string | null
          sendcloud_parcel_id?: string | null
          shipping_cost?: number | null
          status?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Update: {
          buyer_city?: string | null
          buyer_company?: string | null
          buyer_country?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_postal_code?: string | null
          buyer_street?: string | null
          cancelled_reason?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_mode?: string | null
          dispute_reason?: string | null
          escrow_released_at?: string | null
          final_price?: number | null
          id?: string | null
          offer_id?: string | null
          paid_at?: string | null
          penalty_applied?: boolean | null
          pickup_confirmed_at?: string | null
          pickup_deadline_at?: string | null
          pickup_handover_code?: string | null
          pickup_qr_token?: string | null
          quantity?: number | null
          seller_id?: string | null
          seller_pickup_address?: string | null
          seller_pickup_city?: string | null
          seller_pickup_phone?: string | null
          sendcloud_parcel_id?: string | null
          shipping_cost?: number | null
          status?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
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
      restock_transactions_seller_v: {
        Row: {
          billing_same_as_shipping: boolean | null
          buyer_city: string | null
          buyer_company: string | null
          buyer_country: string | null
          buyer_id: string | null
          buyer_name: string | null
          buyer_postal_code: string | null
          buyer_street: string | null
          cancelled_reason: string | null
          commission_amount: number | null
          commission_rate: number | null
          created_at: string | null
          delivered_at: string | null
          delivery_mode: string | null
          delivery_notes: string | null
          dispute_reason: string | null
          escrow_released_at: string | null
          final_price: number | null
          id: string | null
          invoice_buyer_id: string | null
          invoice_seller_id: string | null
          offer_id: string | null
          paid_at: string | null
          penalty_applied: boolean | null
          pickup_confirmation_method: string | null
          pickup_confirmed_at: string | null
          pickup_confirmed_by: string | null
          pickup_deadline_at: string | null
          quantity: number | null
          seller_id: string | null
          seller_pickup_address: string | null
          seller_pickup_city: string | null
          seller_pickup_instructions: string | null
          seller_pickup_phone: string | null
          sendcloud_parcel_id: string | null
          shipping_cost: number | null
          status: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
        }
        Insert: {
          billing_same_as_shipping?: boolean | null
          buyer_city?: string | null
          buyer_company?: string | null
          buyer_country?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_postal_code?: string | null
          buyer_street?: string | null
          cancelled_reason?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_mode?: string | null
          delivery_notes?: string | null
          dispute_reason?: string | null
          escrow_released_at?: string | null
          final_price?: number | null
          id?: string | null
          invoice_buyer_id?: string | null
          invoice_seller_id?: string | null
          offer_id?: string | null
          paid_at?: string | null
          penalty_applied?: boolean | null
          pickup_confirmation_method?: string | null
          pickup_confirmed_at?: string | null
          pickup_confirmed_by?: string | null
          pickup_deadline_at?: string | null
          quantity?: number | null
          seller_id?: string | null
          seller_pickup_address?: string | null
          seller_pickup_city?: string | null
          seller_pickup_instructions?: string | null
          seller_pickup_phone?: string | null
          sendcloud_parcel_id?: string | null
          shipping_cost?: number | null
          status?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_same_as_shipping?: boolean | null
          buyer_city?: string | null
          buyer_company?: string | null
          buyer_country?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_postal_code?: string | null
          buyer_street?: string | null
          cancelled_reason?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_mode?: string | null
          delivery_notes?: string | null
          dispute_reason?: string | null
          escrow_released_at?: string | null
          final_price?: number | null
          id?: string | null
          invoice_buyer_id?: string | null
          invoice_seller_id?: string | null
          offer_id?: string | null
          paid_at?: string | null
          penalty_applied?: boolean | null
          pickup_confirmation_method?: string | null
          pickup_confirmed_at?: string | null
          pickup_confirmed_by?: string | null
          pickup_deadline_at?: string | null
          quantity?: number | null
          seller_id?: string | null
          seller_pickup_address?: string | null
          seller_pickup_city?: string | null
          seller_pickup_instructions?: string | null
          seller_pickup_phone?: string | null
          sendcloud_parcel_id?: string | null
          shipping_cost?: number | null
          status?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
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
      rfq_routing_audit_v: {
        Row: {
          brand_id: string | null
          cap_applied: number | null
          created_at: string | null
          currency_code: string | null
          decision: Database["public"]["Enums"]["rfq_routing_decision"] | null
          destination_country_code: string | null
          details: Json | null
          id: string | null
          matched_reason:
            | Database["public"]["Enums"]["rfq_target_reason"]
            | null
          product_id: string | null
          quantity: number | null
          rank_position: number | null
          reason_code: string | null
          reason_label: string | null
          rfq_created_at: string | null
          rfq_id: string | null
          rfq_status: Database["public"]["Enums"]["rfq_status"] | null
          score: number | null
          vendor_company: string | null
          vendor_country: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_routing_audit_log_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_routing_audit_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "admin_sourcing_items_by_brand_v"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "rfqs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_kpis"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "rfqs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_logistics_stats"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "rfqs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vendor_top_brands_mv"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
        ]
      }
      rfq_vendor_status_v: {
        Row: {
          awarded: boolean | null
          decline_reason: string | null
          declined_at: string | null
          delivery_days: number | null
          dispatch_id: string | null
          dispatched_at: string | null
          email_opened_at: string | null
          expired_at: string | null
          is_visible_to_buyer: boolean | null
          last_transition_at: string | null
          rank_position: number | null
          reminded_at: string | null
          responded_at: string | null
          response_id: string | null
          rfq_id: string | null
          score: number | null
          target_reason: Database["public"]["Enums"]["rfq_target_reason"] | null
          unit_price_excl_vat_cents: number | null
          vendor_display_code: string | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_status:
            | Database["public"]["Enums"]["rfq_dispatch_status"]
            | null
          vendor_status_label: string | null
          viewed_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_dispatch_log_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_dispatch_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      v_buyer_subscription_overview: {
        Row: {
          bonus_ends_at: string | null
          bonus_started_at: string | null
          buyer_id: string | null
          created_at: string | null
          current_free_ends_at: string | null
          current_phase: string | null
          extension_ends_at: string | null
          extension_started_at: string | null
          free_days_remaining: number | null
          has_active_extension_request: boolean | null
          lifetime_volume_ht: number | null
          paid_started_at: string | null
          plan_id: string | null
          plan_label: string | null
          status: string | null
          subscription_id: string | null
          threshold_progress_pct: number | null
          trial_ends_at: string | null
          trial_started_at: string | null
          trial_volume_ht: number | null
          updated_at: string | null
          volume_threshold_ht: number | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_competitor_alerts_anon_v: {
        Row: {
          competitor_display_code: string | null
          competitor_price: number | null
          country_code: string | null
          created_at: string | null
          current_rank: number | null
          gap_amount: number | null
          gap_percentage: number | null
          id: string | null
          my_offer_id: string | null
          my_price: number | null
          previous_rank: number | null
          product_id: string | null
          read_at: string | null
          resolved_at: string | null
          status: string | null
          suggested_price: number | null
          total_competitors: number | null
          updated_at: string | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_competitor_alerts_my_offer_id_fkey"
            columns: ["my_offer_id"]
            isOneToOne: false
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["mk_best_offer_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_my_offer_id_fkey"
            columns: ["my_offer_id"]
            isOneToOne: false
            referencedRelation: "effective_offer_prices_v"
            referencedColumns: ["offer_id"]
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
            referencedRelation: "offers_public_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_my_offer_id_fkey"
            columns: ["my_offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_exclusivity_v"
            referencedColumns: ["offer_id"]
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
            referencedRelation: "admin_price_cockpit_mv"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pack_audit_v"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_country_stats_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_top_price_deltas"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_competitor_alerts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      vendor_market_intel_status_v: {
        Row: {
          billing_method:
            | Database["public"]["Enums"]["vendor_market_intel_billing"]
            | null
          ean_quota: number | null
          has_access: boolean | null
          monthly_price_cents: number | null
          plan_code: string | null
          plan_id: string | null
          plan_label: string | null
          status:
            | Database["public"]["Enums"]["vendor_market_intel_status"]
            | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_started_at: string | null
          trial_days_remaining: number | null
          trial_ends_at: string | null
          trial_started_at: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_market_intel_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_price_challenge_metrics_v: {
        Row: {
          avg_response_days: number | null
          avg_response_delta_pct: number | null
          last_open_challenge_at: string | null
          last_sent_at: string | null
          responded_30d: number | null
          responded_count: number | null
          response_rate_pct: number | null
          sent_30d: number | null
          total_challenges: number | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_challenges_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_rfq_kpis_v: {
        Row: {
          avg_response_minutes: number | null
          declined_count: number | null
          dispatched_count: number | null
          responded_count: number | null
          response_rate: number | null
          vendor_id: string | null
        }
        Relationships: []
      }
      vendor_sendcloud_status_v: {
        Row: {
          created_at: string | null
          has_public_key: boolean | null
          has_secret_key: boolean | null
          id: string | null
          is_connected: boolean | null
          last_verified_at: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string | null
          has_public_key?: never
          has_secret_key?: never
          id?: string | null
          is_connected?: boolean | null
          last_verified_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string | null
          has_public_key?: never
          has_secret_key?: never
          id?: string | null
          is_connected?: boolean | null
          last_verified_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_sendcloud_credentials_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_sendcloud_credentials_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
          },
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_sendcloud_credentials_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
      vendor_top_brands_mv: {
        Row: {
          brand_id: string | null
          brand_logo_url: string | null
          brand_name: string | null
          brand_slug: string | null
          offer_count: number | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "admin_orders_sla_overview_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "public_vendor_trust_signals"
            referencedColumns: ["vendor_id"]
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
            referencedRelation: "vendor_market_intel_status_v"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "offers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_rfq_kpis_v"
            referencedColumns: ["vendor_id"]
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
          company_name?: string | null
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
          name?: string | null
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
          company_name?: string | null
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
          name?: string | null
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
      _account_hash_token: { Args: { _token: string }; Returns: string }
      _apply_buyer_delivery_confirmation: {
        Args: { _lines: Json; _order_id: string; _source: string }
        Returns: Json
      }
      _cat_tokens: { Args: { _label: string }; Returns: string[] }
      _current_user_buyer_ids: { Args: never; Returns: string[] }
      _is_admin_or_service: { Args: never; Returns: boolean }
      _is_privileged_actor: { Args: never; Returns: boolean }
      _qogita_apply_sweep: {
        Args: {
          _candidate_offers: string[]
          _candidate_products: string[]
          _candidate_vendors: string[]
          _country: string
          _dry_run?: boolean
          _error_ratio?: number
          _sweep_type: string
          _sync_run_id: string
          _threshold_days: number
          _total_active_offers: number
          _total_active_products: number
          _total_active_vendors: number
        }
        Returns: Json
      }
      _recompute_order_status: {
        Args: { _order_id: string }
        Returns: undefined
      }
      _resolve_analytics_vendor: {
        Args: { _vendor_id: string }
        Returns: string
      }
      _sub_is_admin: { Args: never; Returns: boolean }
      account_accept_invitation: {
        Args: { _join_code?: string; _token?: string }
        Returns: {
          account_id: string
          account_kind: string
          role: string
        }[]
      }
      account_create_join_code: {
        Args: { _account_id: string; _kind: string; _role?: string }
        Returns: {
          invitation_id: string
          join_code: string
        }[]
      }
      account_get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          accepted: boolean
          account_kind: string
          email: string
          expired: boolean
          expires_at: string
          revoked: boolean
          role: string
          user_exists: boolean
        }[]
      }
      account_has_other_admin: {
        Args: { _account_id: string; _excluding_user: string; _kind: string }
        Returns: boolean
      }
      account_invite_by_email: {
        Args: {
          _account_id: string
          _email: string
          _kind: string
          _role?: string
        }
        Returns: {
          invitation_id: string
          token: string
        }[]
      }
      account_revoke_invitation: {
        Args: { _invitation_id: string }
        Returns: undefined
      }
      account_revoke_member: {
        Args: { _membership_id: string }
        Returns: undefined
      }
      account_update_member_role: {
        Args: { _membership_id: string; _new_role: string }
        Returns: undefined
      }
      activate_vendor_market_intel_subscription: {
        Args: {
          _billing_method: Database["public"]["Enums"]["vendor_market_intel_billing"]
          _period_end?: string
          _plan_id: string
          _stripe_subscription_id?: string
          _vendor_id: string
        }
        Returns: {
          billing_method:
            | Database["public"]["Enums"]["vendor_market_intel_billing"]
            | null
          created_at: string
          granted_by: string | null
          notes: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["vendor_market_intel_status"]
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_started_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          vendor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vendor_market_intel_entitlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_align_vendor_owner: {
        Args: { _user_id: string; _vendor_id: string }
        Returns: Json
      }
      admin_apply_product_mapping: {
        Args: {
          _brand_id?: string
          _category_id?: string
          _manufacturer_id?: string
          _mark_validated?: boolean
          _product_ids: string[]
        }
        Returns: Json
      }
      admin_bulk_create_categories_and_map: {
        Args: { _payload: Json }
        Returns: {
          category_id: string
          error: string
          products_updated: number
          raw_label: string
          slug: string
        }[]
      }
      admin_bulk_map_labels_to_category: {
        Args: {
          _category_id: string
          _labels: string[]
          _source_locale?: string
        }
        Returns: {
          error: string
          products_updated: number
          raw_label: string
        }[]
      }
      admin_category_mapping_dashboard: { Args: never; Returns: Json }
      admin_category_source_aliases_list: {
        Args: {
          _limit?: number
          _locale?: string
          _only_unmapped_products?: boolean
          _search?: string
        }
        Returns: {
          category_id: string
          category_is_active: boolean
          category_name: string
          category_slug: string
          created_at: string
          id: string
          notes: string
          pending_products: number
          source_locale: string
          source_path: string
          total_products: number
        }[]
      }
      admin_change_buyer_profile: {
        Args: {
          _auth_user_id: string
          _customer_id: string
          _new_customer_type: string
          _new_profile_id: string
          _reason: string
        }
        Returns: Json
      }
      admin_check_orders_coherence: {
        Args: { _order_ids?: string[] }
        Returns: {
          ca_ht: number
          coherence: string
          commission: number
          commission_pct: number
          cost_ht: number
          has_cost: boolean
          is_forecast: boolean
          issue: string
          marge_ht: number
          order_id: string
          order_number: string
          status: string
        }[]
      }
      admin_check_vendor_payout_coherence: {
        Args: { _order_id: string }
        Returns: Json
      }
      admin_claim_product_submission: {
        Args: { _submission_id: string }
        Returns: undefined
      }
      admin_convert_forecast_to_real: {
        Args: { _notes?: string; _order_id: string }
        Returns: {
          admin_notes: string | null
          api_key_id: string | null
          billing_address: Json
          created_at: string
          created_by_admin: string | null
          customer_id: string
          customer_validated_at: string | null
          customer_validation_email: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          delivery_confirmation_completed_at: string | null
          delivery_confirmation_requested_at: string | null
          draft_fingerprint: string | null
          draft_payload: Json | null
          estimated_delivery_date: string | null
          forecast_converted_at: string | null
          forecast_created_at: string | null
          forecast_snapshot: Json | null
          fulfillment_mode: string | null
          hidden_from_list: boolean
          id: string
          is_forecast: boolean
          is_test: boolean
          notes: string | null
          order_number: string
          payment_due_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          public_access_expires_at: string | null
          public_access_pin: string | null
          public_token: string | null
          shipped_at: string | null
          shipping_address: Json
          shipping_address_id: string | null
          show_payment_info: boolean
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal_excl_vat: number
          total_cost: number | null
          total_incl_vat: number
          total_margin: number | null
          tracking_carrier: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          vat_amount: number
          was_forecast: boolean
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_category_and_map: {
        Args: {
          _name_en?: string
          _name_fr?: string
          _name_nl?: string
          _parent_id: string
          _raw_label: string
          _source_locale?: string
        }
        Returns: {
          category_id: string
          name: string
          products_updated: number
          slug: string
        }[]
      }
      admin_create_manual_order: { Args: { _payload: Json }; Returns: Json }
      admin_create_quote_from_payload: {
        Args: { _payload: Json }
        Returns: Json
      }
      admin_customer_analytics_kpis: { Args: never; Returns: Json }
      admin_customer_analytics_monthly: {
        Args: { _months?: number }
        Returns: {
          gmv_ttc: number
          month: string
          new_customers: number
          orders_count: number
          returning_customers: number
          unique_customers: number
        }[]
      }
      admin_customer_analytics_ranking: {
        Args: {
          _limit?: number
          _offset?: number
          _search?: string
          _status?: string
        }
        Returns: {
          company_name: string
          country_code: string
          created_at: string
          customer_id: string
          customer_type: string
          days_since_last_order: number
          email: string
          first_order: string
          gmv_ttc: number
          last_order: string
          order_count: number
          status: string
          total_count: number
        }[]
      }
      admin_delete_category_source_alias: {
        Args: { _id: string }
        Returns: undefined
      }
      admin_delete_manual_order_draft: {
        Args: { _id: string }
        Returns: undefined
      }
      admin_delete_quote_line: { Args: { _line_id: string }; Returns: Json }
      admin_duplicate_order_payload: {
        Args: { _order_id: string }
        Returns: Json
      }
      admin_duplicate_quote: { Args: { _quote_id: string }; Returns: string }
      admin_email_deliverability_kpis: {
        Args: never
        Returns: {
          bounce_rate: number
          bounced: number
          complained: number
          complaint_rate: number
          failed: number
          sent: number
          success_rate: number
          suppressed: number
          total: number
          window_days: number
        }[]
      }
      admin_ensure_order_public_token: {
        Args: { _order_id: string }
        Returns: string
      }
      admin_finalize_orphan_qogita_resync_logs: {
        Args: { _stale_minutes?: number }
        Returns: {
          finalized_id: string
          minutes_stuck: number
          new_status: string
          products_processed: number
        }[]
      }
      admin_find_submission_duplicates: {
        Args: { _submission_id: string }
        Returns: {
          brand_name: string
          is_active: boolean
          manufacturer_name: string
          match_reason: string
          product_id: string
          product_name: string
          product_slug: string
          similarity: number
        }[]
      }
      admin_get_order_split_summary: {
        Args: { _order_id: string }
        Returns: Json
      }
      admin_get_sub_order_generation_logs: {
        Args: { _order_id: string }
        Returns: Json
      }
      admin_hard_delete_order: { Args: { _order_id: string }; Returns: Json }
      admin_home_showcase_kpis: {
        Args: { _days?: number }
        Returns: {
          clicks: number
          ctr: number
          impressions: number
          last_seen: string
          product_id: string
          product_name: string
          product_slug: string
          variant: string
        }[]
      }
      admin_inspect_table_grants: {
        Args: { _schema?: string; _table?: string }
        Returns: {
          grantee: string
          is_grantable: boolean
          privilege_type: string
        }[]
      }
      admin_inspect_table_rls: {
        Args: { _schema?: string; _table?: string }
        Returns: {
          cmd: string
          policy_name: string
          qual: string
          rls_enabled: boolean
          roles: string[]
          with_check: string
        }[]
      }
      admin_list_manual_order_drafts: {
        Args: never
        Returns: {
          admin_notes: string
          created_at: string
          created_by_admin: string
          customer_id: string
          customer_label: string
          id: string
          line_count: number
          order_number: string
          updated_at: string
        }[]
      }
      admin_list_order_delivery_confirmation_test_emails: {
        Args: { _order_id: string }
        Returns: {
          error_message: string
          is_test: boolean
          last_event_at: string
          message_id: string
          recipient_email: string
          status: string
        }[]
      }
      admin_list_orders: {
        Args: {
          _billing_status?: string
          _billing_updated_from?: string
          _billing_updated_to?: string
          _buyer_type?: string
          _date_from?: string
          _date_to?: string
          _forecast_filter?: string
          _hide_deleted?: boolean
          _hide_test?: boolean
          _limit?: number
          _offset?: number
          _only_with_commission?: boolean
          _payment_status?: string
          _search?: string
          _sort_by?: string
          _sort_dir?: string
          _status?: string
          _vendor_ids?: string[]
        }
        Returns: Json
      }
      admin_list_pending_invitations: {
        Args: never
        Returns: {
          account_id: string
          account_kind: string
          account_name: string
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          invited_by_name: string
          is_expired: boolean
          join_code: string
          role: string
        }[]
      }
      admin_list_vendor_owner_mismatches: {
        Args: never
        Returns: {
          company_name: string
          current_owner_email: string
          current_owner_has_auth: boolean
          current_owner_user_id: string
          pending_invitations_count: number
          reason: string
          suggested_accepted_at: string
          suggested_role: string
          suggested_user_email: string
          suggested_user_full_name: string
          suggested_user_id: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      admin_load_manual_order_draft: { Args: { _id: string }; Returns: Json }
      admin_load_order_for_edit: { Args: { _order_id: string }; Returns: Json }
      admin_log_price_challenge:
        | {
            Args: {
              _delta_pct: number
              _message: string
              _mk_price_ht: number
              _notification_id?: string
              _offer_id: string
              _product_id: string
              _reason: string
              _ref_price_ht: number
              _vendor_id: string
            }
            Returns: string
          }
        | {
            Args: {
              _delta_pct: number
              _force?: boolean
              _message: string
              _mk_price_ht: number
              _notification_id?: string
              _offer_id: string
              _product_id: string
              _reason: string
              _ref_price_ht: number
              _vendor_id: string
            }
            Returns: string
          }
      admin_normalize_product_gtins: { Args: never; Returns: Json }
      admin_notifications_get: {
        Args: { _id: string }
        Returns: {
          body: string
          created_at: string
          cta_url: string
          id: string
          payload: Json
          read_at: string
          severity: string
          source_id: string
          source_type: string
          title: string
          type: string
        }[]
      }
      admin_notifications_list: {
        Args: { _limit?: number; _only_unread?: boolean }
        Returns: {
          body: string
          created_at: string
          cta_url: string
          id: string
          payload: Json
          read_at: string
          severity: string
          source_id: string
          source_type: string
          title: string
          type: string
        }[]
      }
      admin_notifications_mark_all_read: { Args: never; Returns: number }
      admin_notifications_mark_read: {
        Args: { _id: string }
        Returns: undefined
      }
      admin_notifications_unread_count: { Args: never; Returns: number }
      admin_preview_apply_category_aliases: {
        Args: never
        Returns: {
          matching_aliases: number
          total_pending_products: number
          would_update_products: number
        }[]
      }
      admin_price_cockpit_gaps: {
        Args: { _brand_id?: string; _country?: string; _limit?: number }
        Returns: {
          brand_id: string
          brand_name: string
          cnk: string
          external_best_ht: number
          product_id: string
          product_name: string
          pvp_ttc: number
        }[]
      }
      admin_price_cockpit_gaps_v2: {
        Args: {
          _brand_id?: string
          _country?: string
          _limit?: number
          _min_rfq_count?: number
          _only_with_demand?: boolean
          _search?: string
        }
        Returns: {
          brand_id: string
          brand_name: string
          cnk: string
          external_best_ht: number
          external_offers_count: number
          last_rfq_at: string
          popularity: number
          priority_score: number
          product_id: string
          product_name: string
          pvp_ttc: number
          rfq_count_90d: number
          rfq_total_qty_90d: number
        }[]
      }
      admin_price_cockpit_kpis: { Args: { _country?: string }; Returns: Json }
      admin_price_cockpit_rows: {
        Args: {
          _brand_id?: string
          _category_id?: string
          _country?: string
          _limit?: number
          _min_delta_pct?: number
          _offset?: number
          _only_mk_higher?: boolean
        }
        Returns: {
          brand_id: string
          brand_name: string
          category_id: string
          cnk: string
          delta_vs_external_pct: number
          delta_vs_internal_pct: number
          external_best_ht: number
          external_best_source: string
          external_best_url: string
          market_grossiste_ht: number
          market_pharm_ht: number
          market_public_ht: number
          mk_2nd_ht: number
          mk_best_ht: number
          mk_best_offer_id: string
          mk_best_vendor_id: string
          mk_best_vendor_name: string
          mk_offers_count: number
          product_id: string
          product_name: string
          pvp_ttc: number
          worst_action_score: number
        }[]
      }
      admin_purge_test_orders: {
        Args: { _confirm_token?: string; _dry_run?: boolean }
        Returns: Json
      }
      admin_qogita_reconciliation_history: {
        Args: { _limit?: number }
        Returns: {
          completed_at: string
          country_code: string
          duration_ms: number
          entities_deactivated: Json
          entities_spared: Json
          id: string
          metadata: Json
          started_at: string
          status: Database["public"]["Enums"]["qogita_resync_status"]
          sweep_type: string
          sync_run_id: string
          threshold_days: number
        }[]
      }
      admin_qogita_watchdog_run: {
        Args: { _stale_minutes?: number }
        Returns: Json
      }
      admin_redispatch_catalog_notifications: {
        Args: { _source_id: string; _source_type: string }
        Returns: number
      }
      admin_reorder_home_featured: {
        Args: { _ids: string[]; _kind: string }
        Returns: undefined
      }
      admin_reprocess_order_fanout: {
        Args: { _order_id: string }
        Returns: Json
      }
      admin_resend_invitation: {
        Args: { _invitation_id: string }
        Returns: {
          account_id: string
          account_kind: string
          email: string
          role: string
          token: string
        }[]
      }
      admin_restore_order: { Args: { _order_id: string }; Returns: undefined }
      admin_review_offer_commission: {
        Args: { _decision: string; _offer_id: string; _reason?: string }
        Returns: {
          admin_hidden: boolean
          admin_hidden_at: string | null
          admin_hidden_by: string | null
          admin_hidden_reason: string | null
          applied_margin_percentage: number | null
          applied_margin_rule_id: string | null
          campaign_id: string | null
          carton_size_override: number | null
          commission_model: string | null
          commission_override_created_via_admin_shortcut: boolean
          commission_override_reason: string | null
          commission_override_status:
            | Database["public"]["Enums"]["commission_override_status"]
            | null
          commission_override_updated_at: string | null
          commission_override_updated_by: string | null
          commission_rate: number | null
          commission_valid_from: string | null
          commission_valid_until: string | null
          country_code: string | null
          country_codes: string[]
          created_at: string
          delivery_days: number | null
          down_payment_pct: number | null
          estimated_delivery_days: number | null
          fixed_commission_amount: number | null
          has_extended_delivery: boolean | null
          id: string
          is_active: boolean
          is_qogita_backed: boolean
          is_top_seller: boolean | null
          is_traceable: boolean | null
          last_sync_run_id: string | null
          margin_amount: number | null
          margin_split_pct: number | null
          max_delivery_days: number | null
          min_delivery_days: number | null
          moq: number
          mov: number | null
          mov_amount: number | null
          mov_currency: string | null
          pack_size_override: number | null
          packaging_languages: string[] | null
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
          source_supplier: string | null
          stock_quantity: number
          stock_status: Database["public"]["Enums"]["stock_status_enum"]
          suggested_retail_price_cents: number | null
          suggested_retail_price_source:
            | Database["public"]["Enums"]["pvp_source_enum"]
            | null
          synced_at: string | null
          updated_at: string
          vat_rate: number
          vendor_id: string
          vendor_note: string | null
        }
        SetofOptions: {
          from: "*"
          to: "offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_review_product_commission: {
        Args: { _decision: string; _id: string; _reason?: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          commission_model: string
          commission_rate: number | null
          created_at: string
          created_by: string | null
          created_via_admin_shortcut: boolean
          fixed_commission_amount: number | null
          id: string
          margin_split_pct: number | null
          note: string | null
          product_id: string
          rejected_reason: string | null
          status: Database["public"]["Enums"]["commission_override_status"]
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          vendor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vendor_product_commissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_review_product_submission: {
        Args: {
          _comment?: string
          _decision: string
          _merge_into_product_id?: string
          _submission_id: string
        }
        Returns: Json
      }
      admin_run_apply_category_aliases: {
        Args: never
        Returns: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          triggered_by: string | null
          updated_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "category_alias_apply_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_save_manual_order_draft: {
        Args: { _draft_id: string; _payload: Json }
        Returns: string
      }
      admin_search_brands_fuzzy: {
        Args: { _limit?: number; _q: string }
        Returns: {
          country_of_origin: string
          description: string
          id: string
          is_active: boolean
          is_featured: boolean
          logo_url: string
          match_type: string
          name: string
          product_count: number
          similarity: number
          slug: string
          website_url: string
        }[]
      }
      admin_search_by_country: {
        Args: { _days?: number }
        Returns: {
          click_rate: number
          clicks: number
          country_code: string
          searches: number
          share: number
          zero_result_rate: number
          zero_results: number
        }[]
      }
      admin_search_by_profession: {
        Args: { _days?: number }
        Returns: {
          click_rate: number
          clicks: number
          profession_name: string
          profession_type_id: string
          searches: number
          share: number
          zero_result_rate: number
          zero_results: number
        }[]
      }
      admin_search_kpis: { Args: { _days?: number }; Returns: Json }
      admin_search_top_by_country: {
        Args: { _days?: number; _per_group?: number }
        Returns: {
          click_rate: number
          country_code: string
          normalized_query: string
          rank: number
          sample_query: string
          searches: number
          zero_result_rate: number
        }[]
      }
      admin_search_top_by_profession: {
        Args: { _days?: number; _per_group?: number }
        Returns: {
          click_rate: number
          normalized_query: string
          profession_name: string
          profession_type_id: string
          rank: number
          sample_query: string
          searches: number
          zero_result_rate: number
        }[]
      }
      admin_search_top_queries: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          click_rate: number
          clicks: number
          last_searched_at: string
          normalized_query: string
          sample_query: string
          searches: number
          zero_result_rate: number
          zero_result_searches: number
        }[]
      }
      admin_search_zero_results: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          last_searched_at: string
          normalized_query: string
          sample_query: string
          searches: number
        }[]
      }
      admin_search_zero_results_with_suggestions: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          last_searched_at: string
          matching_products_count: number
          normalized_query: string
          recommendation: string
          sample_query: string
          searches: number
          suggested_brands: Json
          suggested_categories: Json
        }[]
      }
      admin_security_audit_kpis: { Args: { _from?: string }; Returns: Json }
      admin_security_audit_query: {
        Args: {
          _actor_id?: string
          _category?: string
          _from?: string
          _limit?: number
          _offset?: number
          _search?: string
          _severity?: string
          _to?: string
        }
        Returns: {
          action: string
          actor_email: string
          actor_id: string
          actor_role: string
          category: string
          created_at: string
          id: string
          payload: Json
          severity: string
          target_id: string
          target_type: string
          total_count: number
        }[]
      }
      admin_set_order_public_access: {
        Args: { _expires_at?: string; _order_id: string; _pin?: string }
        Returns: undefined
      }
      admin_sla_open_alerts_count: {
        Args: never
        Returns: {
          criticals: number
          total: number
          warnings: number
        }[]
      }
      admin_soft_delete_order: {
        Args: { _order_id: string; _reason?: string }
        Returns: undefined
      }
      admin_test_privileged_column_guards: { Args: never; Returns: Json }
      admin_test_show_payment_info_toggle: { Args: never; Returns: Json }
      admin_unmapped_categories: {
        Args: { _limit?: number }
        Returns: {
          has_alias: boolean
          mapped_to_name: string
          mapped_to_slug: string
          product_count: number
          raw_label: string
        }[]
      }
      admin_update_manual_order: {
        Args: { _order_id: string; _payload: Json }
        Returns: Json
      }
      admin_update_quote_from_payload: {
        Args: { _payload: Json; _quote_id: string }
        Returns: Json
      }
      admin_update_quote_line: {
        Args: {
          _commission_amount_cents?: number
          _commission_basis?: string
          _commission_rate?: number
          _label?: string
          _line_id: string
          _qty: number
          _unit_price_ht_cents: number
          _vat_rate: number
        }
        Returns: Json
      }
      admin_upsert_category_source_alias: {
        Args: {
          _category_id: string
          _id: string
          _notes: string
          _source_locale: string
          _source_path: string
        }
        Returns: string
      }
      admin_upsert_offer_commission: {
        Args: {
          _commission_model: string
          _commission_override_reason?: string
          _commission_rate?: number
          _commission_valid_from?: string
          _commission_valid_until?: string
          _fixed_commission_amount?: number
          _margin_split_pct?: number
          _offer_id: string
        }
        Returns: {
          admin_hidden: boolean
          admin_hidden_at: string | null
          admin_hidden_by: string | null
          admin_hidden_reason: string | null
          applied_margin_percentage: number | null
          applied_margin_rule_id: string | null
          campaign_id: string | null
          carton_size_override: number | null
          commission_model: string | null
          commission_override_created_via_admin_shortcut: boolean
          commission_override_reason: string | null
          commission_override_status:
            | Database["public"]["Enums"]["commission_override_status"]
            | null
          commission_override_updated_at: string | null
          commission_override_updated_by: string | null
          commission_rate: number | null
          commission_valid_from: string | null
          commission_valid_until: string | null
          country_code: string | null
          country_codes: string[]
          created_at: string
          delivery_days: number | null
          down_payment_pct: number | null
          estimated_delivery_days: number | null
          fixed_commission_amount: number | null
          has_extended_delivery: boolean | null
          id: string
          is_active: boolean
          is_qogita_backed: boolean
          is_top_seller: boolean | null
          is_traceable: boolean | null
          last_sync_run_id: string | null
          margin_amount: number | null
          margin_split_pct: number | null
          max_delivery_days: number | null
          min_delivery_days: number | null
          moq: number
          mov: number | null
          mov_amount: number | null
          mov_currency: string | null
          pack_size_override: number | null
          packaging_languages: string[] | null
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
          source_supplier: string | null
          stock_quantity: number
          stock_status: Database["public"]["Enums"]["stock_status_enum"]
          suggested_retail_price_cents: number | null
          suggested_retail_price_source:
            | Database["public"]["Enums"]["pvp_source_enum"]
            | null
          synced_at: string | null
          updated_at: string
          vat_rate: number
          vendor_id: string
          vendor_note: string | null
        }
        SetofOptions: {
          from: "*"
          to: "offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_upsert_product_commission: {
        Args: {
          _commission_model: string
          _commission_rate?: number
          _fixed_commission_amount?: number
          _margin_split_pct?: number
          _note?: string
          _product_id: string
          _valid_from?: string
          _valid_until?: string
          _vendor_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          commission_model: string
          commission_rate: number | null
          created_at: string
          created_by: string | null
          created_via_admin_shortcut: boolean
          fixed_commission_amount: number | null
          id: string
          margin_split_pct: number | null
          note: string | null
          product_id: string
          rejected_reason: string | null
          status: Database["public"]["Enums"]["commission_override_status"]
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          vendor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vendor_product_commissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_vendor_fanout_status: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          email_attempts: number
          emails_failed: number
          emails_sent: number
          expected_vendors: number
          last_attempt_at: string
          last_error: string
          last_error_at: string
          missing_vendors: number
          order_id: string
          order_number: string
          order_status: string
          paid_at: string
          payment_status: string
          sub_orders_count: number
          total_incl_vat: number
        }[]
      }
      apply_category_aliases: {
        Args: never
        Returns: {
          updated_count: number
        }[]
      }
      apply_product_category_anomaly_suggestion: {
        Args: { _id: string }
        Returns: undefined
      }
      apply_qogita_llm_mapping: {
        Args: { _proposal_id: string }
        Returns: Json
      }
      apply_qogita_llm_mappings_bulk: {
        Args: { _min_confidence?: number }
        Returns: Json
      }
      assign_extension_request: {
        Args: { _req_id: string }
        Returns: undefined
      }
      audit_backup_tables_rls: {
        Args: never
        Returns: {
          anon_has_grants: boolean
          authenticated_has_grants: boolean
          issues: string[]
          policy_count: number
          rls_enabled: boolean
          status: string
          table_name: string
        }[]
      }
      auto_cancel_pickup_transaction: {
        Args: { _transaction_id: string }
        Returns: Json
      }
      auto_merge_brand_duplicates: {
        Args: { _dry_run?: boolean }
        Returns: Json
      }
      auto_merge_product_duplicates: {
        Args: { _dry_run?: boolean }
        Returns: Json
      }
      auto_promote_proprietary_codes: { Args: never; Returns: number }
      bulk_override_requested: { Args: never; Returns: boolean }
      bulk_set_cnk_codes: { Args: { pairs: Json }; Returns: number }
      bump_contract_template: {
        Args: { _new_version: string; _notes?: string; _type: string }
        Returns: {
          articles: Json
          contract_type: string
          created_at: string
          created_by: string | null
          effective_at: string | null
          id: string
          medikong_data: Json
          notes: string | null
          required_fields: Json
          status: string
          updated_at: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "contract_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bump_translation_cache_hit: {
        Args: { _source_hash: string }
        Returns: undefined
      }
      buyer_get_delivery_confirmation: {
        Args: { _token: string }
        Returns: Json
      }
      buyer_get_delivery_confirmation_by_auth: {
        Args: { _order_id: string }
        Returns: Json
      }
      buyer_p2p_get_contact: {
        Args: { _listing_id: string; _role: string }
        Returns: {
          buyer_id: string
          email: string
          pharmacy_name: string
        }[]
      }
      buyer_submit_delivery_confirmation: {
        Args: { _lines: Json; _token: string }
        Returns: Json
      }
      buyer_submit_delivery_confirmation_by_auth: {
        Args: { _lines: Json; _order_id: string }
        Returns: Json
      }
      calculate_offer_price_for_quantity: {
        Args: { p_offer_id: string; p_quantity: number }
        Returns: {
          mov_threshold: number
          price_excl_vat: number
          price_incl_vat: number
          tier_index: number
          total_excl_vat: number
          total_incl_vat: number
        }[]
      }
      can_vendor_set_suggested_price: {
        Args: { _product_id: string; _vendor_id: string }
        Returns: boolean
      }
      cancel_subscription: {
        Args: { _reason?: string; _sub_id: string }
        Returns: undefined
      }
      cancel_vendor_market_intel_subscription: {
        Args: { _vendor_id: string }
        Returns: {
          billing_method:
            | Database["public"]["Enums"]["vendor_market_intel_billing"]
            | null
          created_at: string
          granted_by: string | null
          notes: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["vendor_market_intel_status"]
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_started_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          vendor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vendor_market_intel_entitlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      category_descendants: {
        Args: { root_slug: string }
        Returns: {
          id: string
        }[]
      }
      check_price_challenge_cooldown: {
        Args: { _product_id: string; _vendor_id: string }
        Returns: {
          allowed: boolean
          block_reason: string
          last_sent_at: string
          next_allowed_at: string
          sent_today: number
        }[]
      }
      check_qogita_stale_refresh_alert: { Args: never; Returns: undefined }
      cleanup_old_savings_simulations: { Args: never; Returns: number }
      confirm_pickup: {
        Args: { _code?: string; _qr_token?: string; _transaction_id: string }
        Returns: Json
      }
      consume_qogita_tokens: { Args: { _amount: number }; Returns: Json }
      convert_quote_to_order:
        | { Args: { _quote_id: string }; Returns: Json }
        | { Args: { _force?: boolean; _quote_id: string }; Returns: Json }
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
      create_admin_notification: {
        Args: {
          _body: string
          _cta_url: string
          _payload?: Json
          _severity: string
          _source_id: string
          _source_type: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      create_buyer_delivery_token: {
        Args: { _order_id: string }
        Returns: string
      }
      create_offers_from_products: {
        Args: { _country_code?: string }
        Returns: Json
      }
      current_active_account_id: { Args: never; Returns: string }
      current_active_account_kind: { Args: never; Returns: string }
      current_buyer_id: { Args: never; Returns: string }
      current_buyer_profile_id: { Args: never; Returns: string }
      current_guarantee_version_id: { Args: never; Returns: string }
      current_user_buyer_account_ids: { Args: never; Returns: string[] }
      current_user_vendor_account_ids: { Args: never; Returns: string[] }
      current_vendor_id: { Args: never; Returns: string }
      decrement_offer_stock: {
        Args: { p_offer_id: string; p_quantity: number }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_user_account: { Args: { _user_id: string }; Returns: undefined }
      detect_market_delta_anomalies: {
        Args: { _threshold_pct?: number; _triggered_by?: string }
        Returns: {
          anomalies_found: number
          offers_scanned: number
          offers_with_market: number
          run_id: string
        }[]
      }
      detect_market_price_pack_anomalies: {
        Args: { _source_id_filter?: string }
        Returns: {
          anomalies_created: number
          history_rows_updated: number
        }[]
      }
      detect_price_alerts_batch: {
        Args: { _th_crit?: number; _th_info?: number; _th_warn?: number }
        Returns: Json
      }
      detect_product_category_anomalies: {
        Args: { _limit?: number; _product_id?: string }
        Returns: {
          closed: number
          flagged: number
          scanned: number
        }[]
      }
      detect_vendor_competitor_alerts: { Args: never; Returns: Json }
      dismiss_product_category_anomaly: {
        Args: { _id: string; _note?: string }
        Returns: undefined
      }
      dispatch_brand_activation_notifications: {
        Args: { _brand_id: string }
        Returns: number
      }
      dispatch_product_activation_notifications: {
        Args: { _product_id: string }
        Returns: number
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      end_buyer_impersonation: {
        Args: { _ended_reason?: string; _session_id: string }
        Returns: undefined
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enqueue_qogita_fast_refresh_batch: {
        Args: { _batch_size?: number; _max_age_hours?: number; _tier?: string }
        Returns: Json
      }
      enqueue_qogita_resync_batch: {
        Args: {
          _batch_size?: number
          _mode?: Database["public"]["Enums"]["qogita_resync_mode"]
        }
        Returns: Json
      }
      ensure_buyer_subscription: { Args: never; Returns: string }
      evaluate_vendor_price_alerts: {
        Args: { _vendor_id: string }
        Returns: Json
      }
      expire_vendor_exclusivities: { Args: never; Returns: number }
      expire_vendor_market_intel_trials: { Args: never; Returns: number }
      export_table_as_sql: {
        Args: { _table_name: string }
        Returns: {
          sql_line: string
        }[]
      }
      extract_pack_size_from_name_sql: {
        Args: { _name: string }
        Returns: number
      }
      f_unaccent: { Args: { "": string }; Returns: string }
      fanout_order_to_vendors: {
        Args: { _order_id: string }
        Returns: {
          line_count: number
          magic_token: string
          order_number: string
          order_total_incl_vat: number
          sub_order_id: string
          vendor_email: string
          vendor_id: string
          vendor_name: string
          vendor_subtotal_incl_vat: number
        }[]
      }
      finalize_orphan_qogita_resync_logs: {
        Args: { _stale_minutes?: number }
        Returns: {
          finalized_id: string
          minutes_stuck: number
          new_status: string
          products_processed: number
        }[]
      }
      finalize_qogita_resync_log: {
        Args: {
          _id: string
          _stats?: Json
          _status: Database["public"]["Enums"]["qogita_resync_status"]
        }
        Returns: undefined
      }
      find_brand_duplicates: {
        Args: never
        Returns: {
          brand_ids: string[]
          brand_names: string[]
          norm_key: string
          product_counts: number[]
          variant_count: number
        }[]
      }
      find_product_duplicates: {
        Args: never
        Returns: {
          cnks: string[]
          gtins: string[]
          has_images: boolean[]
          is_active_flags: boolean[]
          match_key: string
          match_type: string
          offer_counts: number[]
          product_ids: string[]
          product_names: string[]
          variant_count: number
        }[]
      }
      force_bonus_volume: {
        Args: { _reason: string; _sub_id: string }
        Returns: undefined
      }
      force_bulk_deactivate: {
        Args: { _ids: string[]; _table_name: string }
        Returns: Json
      }
      force_switch_to_paid: { Args: { _sub_id: string }; Returns: undefined }
      generate_quote_number: { Args: never; Returns: string }
      get_action_center: { Args: { _scope: string }; Returns: Json }
      get_active_contract_template: {
        Args: { _type?: string }
        Returns: {
          articles: Json
          contract_type: string
          created_at: string
          created_by: string | null
          effective_at: string | null
          id: string
          medikong_data: Json
          notes: string | null
          required_fields: Json
          status: string
          updated_at: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "contract_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_admin_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      get_best_offers_for_products: {
        Args: {
          _buyer_profile_id?: string
          _country: string
          _product_ids: string[]
        }
        Returns: {
          delivery_days: number
          effective_price_excl_vat: number
          effective_price_incl_vat: number
          exclusivity_mode: Database["public"]["Enums"]["vendor_exclusivity_mode"]
          is_exclusive_winner: boolean
          offer_count: number
          offer_id: string
          price_source: string
          product_id: string
          stock_quantity: number
          total_stock: number
          vendor_company_name: string
          vendor_display_code: string
          vendor_display_name: string
          vendor_id: string
          vendor_is_verified: boolean
          vendor_name: string
          vendor_show_real_name: boolean
          vendor_show_real_name_resolved: boolean
        }[]
      }
      get_effective_offer_price: {
        Args: { _buyer_profile_id: string; _offer_id: string }
        Returns: {
          base_price_excl_vat: number
          base_price_incl_vat: number
          buyer_profile_id: string
          effective_price_excl_vat: number
          effective_price_incl_vat: number
          offer_id: string
          price_source: string
          product_id: string
          vendor_id: string
        }[]
      }
      get_my_accounts: {
        Args: never
        Returns: {
          account_id: string
          display_name: string
          is_owner: boolean
          kind: string
          role: string
          status: string
        }[]
      }
      get_my_restock_transaction_contact: {
        Args: { _tx_id: string }
        Returns: {
          buyer_email: string
          buyer_phone: string
          buyer_vat_number: string
          id: string
        }[]
      }
      get_my_vendor_banking: {
        Args: never
        Returns: {
          bank_name: string
          bic: string
          iban: string
          vendor_id: string
        }[]
      }
      get_offer_cost_details: {
        Args: { _offer_id: string }
        Returns: {
          applied_margin_percentage: number
          commission_model: string
          commission_rate: number
          fixed_commission_amount: number
          id: string
          margin_split_pct: number
          purchase_price: number
          purchase_price_excl_vat: number
          qogita_base_price: number
        }[]
      }
      get_pickup_details: { Args: { _transaction_id: string }; Returns: Json }
      get_product_category_anomalies: {
        Args: { _product_ids: string[] }
        Returns: {
          current_category_id: string
          details: Json
          product_id: string
          reason: string
          score: number
          severity: string
          status: string
          suggested_category_id: string
        }[]
      }
      get_quote_by_token: { Args: { _token: string }; Returns: Json }
      get_recent_import_runs: {
        Args: { _limit?: number }
        Returns: {
          completed_at: string
          duration_ms: number
          message: string
          metadata: Json
          rows_created: number
          rows_failed: number
          rows_processed: number
          rows_updated: number
          run_type: string
          source: string
          started_at: string
          status: string
        }[]
      }
      get_rfq_target_vendor_ids: {
        Args: { _rfq_id: string }
        Returns: {
          vendor_id: string
        }[]
      }
      get_savings_simulation_lines_public: {
        Args: { _sim_id: string }
        Returns: {
          detected_brand: string
          detected_cnk: string
          detected_name: string
          detected_quantity: number
          detected_unit_price_excl_vat: number
          id: string
          line_number: number
          line_savings: number
          line_savings_pct: number
          match_confidence: number
          match_method: string
          matched_product_id: string
          matched_product_name: string
          matched_product_slug: string
          medikong_min_price_excl_vat: number
          medikong_supplier_count: number
        }[]
      }
      get_savings_simulation_public: {
        Args: { _sim_id: string }
        Returns: {
          created_at: string
          error_message: string
          id: string
          match_rate: number
          matched_lines: number
          medikong_total_excl_vat: number
          savings_amount: number
          savings_pct: number
          source_file_type: string
          source_supplier: string
          source_total_excl_vat: number
          status: string
          total_lines: number
          updated_at: string
        }[]
      }
      get_source_mapping_issues: {
        Args: { _kind?: string; _limit?: number; _source: string }
        Returns: {
          example_product_id: string
          example_product_name: string
          product_count: number
          raw_value: string
        }[]
      }
      get_source_mapping_overview: {
        Args: never
        Returns: {
          manually_validated: number
          source: string
          total_products: number
          unresolved_brand_values: number
          unresolved_category_values: number
          without_brand: number
          without_category: number
          without_manufacturer: number
        }[]
      }
      get_source_mapping_products: {
        Args: {
          _filter?: string
          _limit?: number
          _offset?: number
          _search?: string
          _source: string
        }
        Returns: {
          brand_id: string
          brand_name_raw: string
          brand_name_resolved: string
          category_id: string
          category_name_raw: string
          category_name_resolved: string
          manual_mapping_validated: boolean
          manual_mapping_validated_at: string
          manufacturer_id: string
          manufacturer_name: string
          product_id: string
          product_image: string
          product_name: string
          source: string
          total_count: number
        }[]
      }
      get_vendor_buyer_profile: {
        Args: { _customer_id: string }
        Returns: Json
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
      get_vendor_delegate_contact: {
        Args: { _id: string }
        Returns: {
          email: string
          first_name: string
          last_name: string
          phone: string
        }[]
      }
      get_vendor_delegate_public: {
        Args: { _id: string }
        Returns: {
          bio: string
          booking_url: string
          country_codes: string[]
          display_order: number
          email: string
          first_name: string
          id: string
          is_active: boolean
          job_title: string
          languages: string[]
          last_name: string
          phone: string
          photo_url: string
          postal_codes: string[]
          primary_target_profiles: string[]
          regions: string[]
          target_profiles: string[]
          vendor_id: string
        }[]
      }
      get_vendor_gmv_progress: { Args: { _vendor_id: string }; Returns: Json }
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
      get_vendor_order_buyer_contact: {
        Args: { _order_id: string }
        Returns: {
          company_name: string
          customer_type: string
          email: string
          phone: string
        }[]
      }
      grant_subscription_extension: {
        Args: { _months?: number; _notes?: string; _req_id: string }
        Returns: undefined
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      increment_offer_stock: {
        Args: { p_offer_id: string; p_quantity: number }
        Returns: Json
      }
      increment_proprietary_code_observation: {
        Args: { _code: string; _supplier: string }
        Returns: undefined
      }
      is_account_admin: {
        Args: { _account_id: string; _kind: string }
        Returns: boolean
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      is_customer_order: { Args: { _order_id: string }; Returns: boolean }
      is_order_vendor: { Args: { _order_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_verified_buyer_or_admin: { Args: { _uid?: string }; Returns: boolean }
      link_customer_to_current_user: {
        Args: { _customer_id: string }
        Returns: Json
      }
      list_admin_users: {
        Args: never
        Returns: {
          display_name: string
          email: string
          user_id: string
        }[]
      }
      list_reseller_offers: {
        Args: { _country?: string; _limit?: number; _offset?: number }
        Returns: {
          country_code: string
          moq: number
          mov_amount: number
          offer_id: string
          price_excl_vat: number
          price_source: string
          product_id: string
          stock_quantity: number
          vendor_id: string
        }[]
      }
      list_vendor_delegates_public: {
        Args: { _vendor_id: string }
        Returns: {
          bio: string
          booking_url: string
          country_codes: string[]
          display_order: number
          email: string
          first_name: string
          id: string
          is_active: boolean
          job_title: string
          languages: string[]
          last_name: string
          phone: string
          photo_url: string
          postal_codes: string[]
          primary_target_profiles: string[]
          regions: string[]
          target_profiles: string[]
          vendor_id: string
        }[]
      }
      log_active_products_without_offers: {
        Args: never
        Returns: {
          active_products_count: number
          country_code: string
          missing_offers_count: number
        }[]
      }
      log_admin_audit_event: {
        Args: {
          _action: string
          _metadata?: Json
          _path?: string
          _target_id?: string
          _target_type?: string
        }
        Returns: string
      }
      log_offer_data_issue: {
        Args: {
          _details?: Json
          _issue_code: string
          _offer_id: string
          _product_id: string
        }
        Returns: undefined
      }
      log_product_category_anomaly_action: {
        Args: {
          _action: string
          _anomaly_id: string
          _note?: string
          _to_category_id?: string
        }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          _action: string
          _category: string
          _payload?: Json
          _severity?: string
          _target_id?: string
          _target_type?: string
        }
        Returns: string
      }
      mark_extension_contacted: {
        Args: { _notes?: string; _req_id: string }
        Returns: undefined
      }
      mark_overdue_vendor_invoices: { Args: never; Returns: number }
      mark_quote_paid: { Args: { _quote_id: string }; Returns: Json }
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
      match_product_by_name: {
        Args: { query_brand?: string; query_name: string; threshold?: number }
        Returns: {
          id: string
          name: string
          similarity: number
        }[]
      }
      match_products_by_names_batch: {
        Args: { _queries: Json; _threshold?: number }
        Returns: {
          idx: number
          product_id: string
          similarity: number
        }[]
      }
      merge_brands: { Args: { _drop: string; _keep: string }; Returns: Json }
      merge_products: { Args: { _drop: string; _keep: string }; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      normalize_brand_name: { Args: { _name: string }; Returns: string }
      normalize_product_gtin: { Args: { _gtin: string }; Returns: string }
      offer_exclusivity_flags: {
        Args: {
          p_country_code?: string
          p_product_id: string
          p_vendor_id: string
        }
        Returns: {
          exclusive_vendor_id: string
          exclusivity_id: string
          exclusivity_mode: Database["public"]["Enums"]["vendor_exclusivity_mode"]
          is_blocked: boolean
          is_hidden: boolean
          is_showcase_dimmed: boolean
        }[]
      }
      offer_is_hidden_by_exclusivity: {
        Args: { _product_id: string; _vendor_id: string }
        Returns: boolean
      }
      order_should_show_payment_info: {
        Args: { _order_id: string }
        Returns: boolean
      }
      override_volume_threshold: {
        Args: { _new_threshold: number; _sub_id: string }
        Returns: undefined
      }
      pause_subscription: {
        Args: { _reason?: string; _sub_id: string }
        Returns: undefined
      }
      pick_media_banner: {
        Args: { p_brand_id?: string; p_manufacturer_id?: string }
        Returns: {
          created_at: string
          cta_label: string | null
          cta_url: string | null
          enabled: boolean
          ends_at: string | null
          id: string
          logo_url: string | null
          name: string
          partner_name: string | null
          priority: number
          scope: string
          starts_at: string | null
          subtitle: string | null
          target_brand_ids: string[]
          target_manufacturer_ids: string[]
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "media_banners"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      public_active_offers_count: {
        Args: { _country_code?: string }
        Returns: number
      }
      public_get_order_by_token: {
        Args: { _pin?: string; _token: string }
        Returns: Json
      }
      public_search_brands_fuzzy: {
        Args: { _limit?: number; _q: string }
        Returns: {
          id: string
          logo_url: string
          name: string
          product_count: number
          similarity: number
          slug: string
        }[]
      }
      public_validate_order: {
        Args: { _email?: string; _pin?: string; _token: string }
        Returns: Json
      }
      public_verified_vendors_count: { Args: never; Returns: number }
      publish_contract_template: {
        Args: { _effective_at?: string; _id: string }
        Returns: {
          articles: Json
          contract_type: string
          created_at: string
          created_by: string | null
          effective_at: string | null
          id: string
          medikong_data: Json
          notes: string | null
          required_fields: Json
          status: string
          updated_at: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "contract_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      purge_admin_audit_log: { Args: never; Returns: number }
      purge_anonymous_savings_simulations: { Args: never; Returns: number }
      purge_bulk_deactivation_events: { Args: never; Returns: number }
      purge_security_audit_logs: { Args: never; Returns: Json }
      qogita_backed_vendor_ids: {
        Args: never
        Returns: {
          vendor_id: string
        }[]
      }
      qogita_deactivate_zero_stock_offers: {
        Args: { _offer_ids: string[] }
        Returns: number
      }
      qogita_reactivate_entity: {
        Args: { _id: string; _kind: string; _reason?: string }
        Returns: Json
      }
      qogita_sweep_run_id: {
        Args: { _country?: string; _dry_run?: boolean; _sync_run_id: string }
        Returns: Json
      }
      qogita_sweep_staleness: {
        Args: {
          _country?: string
          _dry_run?: boolean
          _threshold_days?: number
        }
        Returns: Json
      }
      qogita_watchdog_run: { Args: { _stale_minutes?: number }; Returns: Json }
      quote_public_action: {
        Args: { _action: string; _ip?: string; _token: string }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_brand_top20: { Args: never; Returns: undefined }
      recompute_brand_top20_with_log: { Args: never; Returns: string }
      recompute_buyer_volume: {
        Args: { _buyer_id: string }
        Returns: undefined
      }
      recompute_qogita_sync_tiers: { Args: never; Returns: Json }
      recompute_quote_totals: {
        Args: { _quote_id: string }
        Returns: undefined
      }
      recompute_rfq_response_ranks: {
        Args: { _rfq_id: string }
        Returns: undefined
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
      refresh_admin_price_cockpit_mv: { Args: never; Returns: Json }
      refresh_best_bundle_sizes: {
        Args: { _only_flagged?: boolean }
        Returns: Json
      }
      refresh_public_marketplace_metrics: { Args: never; Returns: undefined }
      refresh_vendor_top_brands_mv_with_log: { Args: never; Returns: undefined }
      reject_extension_request: {
        Args: { _reason: string; _req_id: string }
        Returns: undefined
      }
      request_subscription_extension: {
        Args: { _callback_window?: string; _reason?: string }
        Returns: string
      }
      request_vendor_market_intel_trial_renewal: {
        Args: { _message?: string }
        Returns: {
          created_at: string
          created_by: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          kind: string
          message: string | null
          status: string
          vendor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vendor_market_intel_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_buyer_profile_for_user: {
        Args: { _user_id: string }
        Returns: string
      }
      resolve_effective_commission: {
        Args: { _offer_id: string }
        Returns: {
          commission_model: string
          commission_rate: number
          fixed_commission_amount: number
          margin_split_pct: number
          source: string
          valid_from: string
          valid_until: string
          via_admin_shortcut: boolean
        }[]
      }
      resolve_effective_pack_size: {
        Args: { _external_offer_id: string }
        Returns: {
          pack_size: number
          source: string
        }[]
      }
      resolve_invoice_payment_eligibility: {
        Args: {
          _amount_cents: number
          _customer_id: string
          _vendor_id: string
        }
        Returns: {
          eligible: boolean
          net_days: number
          reason: string
          rule_id: string
        }[]
      }
      resolve_market_delta_threshold: {
        Args: { _product_id: string }
        Returns: number
      }
      resolve_offer_exclusivity: {
        Args: {
          _buyer_profile_id?: string
          _country: string
          _product_id: string
        }
        Returns: {
          applied_buyer_profile_id: string
          exclusivity_id: string
          mode: Database["public"]["Enums"]["vendor_exclusivity_mode"]
          scope: Database["public"]["Enums"]["vendor_exclusivity_scope"]
          valid_until: string
          vendor_id: string
        }[]
      }
      resolve_offer_price_for_profile: {
        Args: { _buyer_profile_id: string; _offer_id: string }
        Returns: {
          price_excl_vat: number
          source: string
        }[]
      }
      resolve_product_brands: { Args: never; Returns: undefined }
      resolve_product_categories: { Args: never; Returns: undefined }
      resolve_product_manufacturers: {
        Args: { _dry_run?: boolean; _limit?: number }
        Returns: Json
      }
      resolve_product_pvp: {
        Args: { _country_code?: string; _product_id: string }
        Returns: {
          pvp_ttc_cents: number
          source: Database["public"]["Enums"]["pvp_source_enum"]
          source_label: string
          updated_at: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      resolve_product_vat_rate: {
        Args: { _country_code?: string; _product_id: string }
        Returns: {
          source: string
          vat_rate: number
        }[]
      }
      resolve_vendor_by_public_code: {
        Args: { _code: string }
        Returns: {
          country_code: string
          created_at: string
          display_code: string
          id: string
          is_active: boolean
        }[]
      }
      restock_get_buyer_contact_for_seller: {
        Args: { _tx_id: string }
        Returns: {
          buyer_email: string
          buyer_phone: string
          buyer_vat_number: string
        }[]
      }
      restock_pickup_watchdog_targets: {
        Args: never
        Returns: {
          action: string
          pickup_deadline_at: string
          transaction_id: string
        }[]
      }
      restore_brands_from_backup: {
        Args: { _backup_table_name?: string }
        Returns: Json
      }
      rfq_admin_add_vendor: {
        Args: {
          _bypass_eligibility?: boolean
          _rfq_id: string
          _vendor_id: string
        }
        Returns: Json
      }
      rfq_admin_eligible_vendors_not_targeted: {
        Args: { _rfq_id: string }
        Returns: {
          reason: Database["public"]["Enums"]["rfq_target_reason"]
          score: number
          vendor_company: string
          vendor_country: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      rfq_admin_grant_access: {
        Args: {
          _expires_at?: string
          _notes?: string
          _reason?: string
          _rfq_id: string
          _user_id: string
        }
        Returns: string
      }
      rfq_admin_invite_external_vendor: {
        Args: {
          _contact_email: string
          _contact_name?: string
          _external_vendor_id: string
          _rfq_id: string
        }
        Returns: Json
      }
      rfq_admin_revoke_access: {
        Args: { _notes?: string; _rfq_id: string; _user_id: string }
        Returns: undefined
      }
      rfq_admin_send_reminder_now: {
        Args: { _rfq_id: string; _template_id: string; _vendor_id: string }
        Returns: Json
      }
      rfq_audit_routing: { Args: { _rfq_id: string }; Returns: number }
      rfq_buyer_can_view_results: {
        Args: { _rfq_id: string; _user_id: string }
        Returns: boolean
      }
      rfq_check_quota: { Args: { _user_id?: string }; Returns: Json }
      rfq_close_expired: { Args: never; Returns: number }
      rfq_consume_credit: {
        Args: { _rfq_id: string; _user_id: string }
        Returns: Json
      }
      rfq_dispatch: {
        Args: { _rfq_id: string }
        Returns: {
          reason: Database["public"]["Enums"]["rfq_target_reason"]
          vendor_id: string
          was_new: boolean
        }[]
      }
      rfq_dispatch_auto_pending_review: { Args: never; Returns: number }
      rfq_eligible_vendor_countries: {
        Args: { _buyer_country: string }
        Returns: {
          country_code: string
        }[]
      }
      rfq_ensure_buyer_balance: {
        Args: { _user_id: string }
        Returns: {
          active_plan_id: string | null
          created_at: string
          current_period_start: string
          is_unlimited: boolean
          monthly_quota: number
          monthly_used: number
          permanent_credits: number
          plan_expires_at: string | null
          plan_started_at: string | null
          rfq_unlimited_override: boolean
          total_consumed: number
          total_purchased: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "rfq_buyer_balances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rfq_external_get_invitation: { Args: { _token: string }; Returns: Json }
      rfq_external_submit_response: {
        Args: {
          _attachments_urls?: string[]
          _comment?: string
          _contact_email?: string
          _contact_name?: string
          _currency_code?: string
          _decline?: boolean
          _lead_time_days?: number
          _payment_terms?: string
          _quantity_available?: number
          _token: string
          _unit_price_excl_vat_cents: number
          _validity_days?: number
        }
        Returns: Json
      }
      rfq_grant_credits: {
        Args: {
          _extra_credits?: number
          _plan_code?: string
          _reason?: string
          _user_id: string
        }
        Returns: Json
      }
      rfq_mark_followup: {
        Args: { _rfq_id: string; _wave?: number }
        Returns: {
          admin_curated: boolean
          awarded_at: string | null
          brand_id: string | null
          buyer_user_id: string
          closed_at: string | null
          comment: string | null
          created_at: string
          currency_code: string
          current_wave: number
          delivery_address: Json | null
          desired_delivery_date: string | null
          destination_country_code: string
          dispatched_at: string | null
          id: string
          is_paid_feature: boolean
          last_reminded_at: string | null
          max_target_vendors: number | null
          payment_terms: string | null
          product_id: string | null
          quantity: number
          required_offer_validity_days: number | null
          responses_deadline: string
          status: Database["public"]["Enums"]["rfq_status"]
          target_price_excl_vat_cents: number | null
          target_scope: Database["public"]["Enums"]["rfq_target_scope"]
          total_responded: number
          total_targeted: number
          updated_at: string
          wave_started_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rfqs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rfq_monthly_reset_quotas: { Args: never; Returns: number }
      rfq_recompute_response_scores: {
        Args: { _rfq_id: string }
        Returns: undefined
      }
      rfq_record_reminder_sent: {
        Args: {
          _email_message_id?: string
          _error?: string
          _rfq_id: string
          _template_id: string
          _vendor_id: string
          _wave: number
        }
        Returns: string
      }
      rfq_resolve_target_vendors: {
        Args: { _rfq_id: string }
        Returns: {
          reason: Database["public"]["Enums"]["rfq_target_reason"]
          vendor_id: string
        }[]
      }
      rfq_routing_self_test: {
        Args: never
        Returns: {
          actual: number
          details: string
          expected: number
          ok: boolean
          scenario: string
        }[]
      }
      rfq_routing_self_test_admin: {
        Args: never
        Returns: {
          actual: number
          details: string
          expected: number
          ok: boolean
          scenario: string
        }[]
      }
      rfq_score_target_vendors: {
        Args: { _rfq_id: string }
        Returns: {
          reason: Database["public"]["Enums"]["rfq_target_reason"]
          score: number
          score_availability: number
          score_latency: number
          score_price: number
          score_rating: number
          score_reason: number
          score_response: number
          vendor_id: string
        }[]
      }
      rfq_select_reminder_targets: {
        Args: { _max_per_run?: number }
        Returns: {
          body_fr: string
          deadline_in_hours: number
          dispatch_id: string
          next_wave: number
          product_name: string
          quantity: number
          responses_deadline: string
          rfq_id: string
          subject_fr: string
          template_id: string
          tracking_token: string
          vendor_email: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      rfq_select_top_vendors: {
        Args: { _rfq_id: string }
        Returns: {
          rank_pos: number
          reason: Database["public"]["Enums"]["rfq_target_reason"]
          score: number
          vendor_id: string
        }[]
      }
      rfq_send_now: {
        Args: { _rfq_id: string }
        Returns: {
          admin_curated: boolean
          awarded_at: string | null
          brand_id: string | null
          buyer_user_id: string
          closed_at: string | null
          comment: string | null
          created_at: string
          currency_code: string
          current_wave: number
          delivery_address: Json | null
          desired_delivery_date: string | null
          destination_country_code: string
          dispatched_at: string | null
          id: string
          is_paid_feature: boolean
          last_reminded_at: string | null
          max_target_vendors: number | null
          payment_terms: string | null
          product_id: string | null
          quantity: number
          required_offer_validity_days: number | null
          responses_deadline: string
          status: Database["public"]["Enums"]["rfq_status"]
          target_price_excl_vat_cents: number | null
          target_scope: Database["public"]["Enums"]["rfq_target_scope"]
          total_responded: number
          total_targeted: number
          updated_at: string
          wave_started_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rfqs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rfq_send_reminders: { Args: never; Returns: number }
      rfq_track_event: {
        Args: { _event: string; _token: string }
        Returns: boolean
      }
      rfq_vendor_open_count: { Args: { _vendor_id: string }; Returns: number }
      rfq_vendor_state_label: {
        Args: { _status: Database["public"]["Enums"]["rfq_dispatch_status"] }
        Returns: string
      }
      run_market_delta_anomaly_job: {
        Args: { _threshold_pct?: number; _triggered_by?: string }
        Returns: Json
      }
      run_pack_mismatch_alert_job: { Args: never; Returns: Json }
      scan_order_line_sla_alerts: {
        Args: never
        Returns: {
          alerts_created: number
          lines_overdue: number
        }[]
      }
      search_discount_offers: {
        Args: {
          _brand_ids?: string[]
          _category_ids?: string[]
          _country?: string
          _limit?: number
          _manufacturer_ids?: string[]
          _min_discount_pct?: number
          _offset?: number
          _reference?: string
        }
        Returns: {
          best_price_htva_cents: number
          brand_id: string
          brand_name: string
          cnk: string
          country_code: string
          delivery_days: number
          discount_pct: number
          manufacturer_id: string
          manufacturer_name: string
          moq: number
          mov_eur_cents: number
          offer_id: string
          product_id: string
          product_name: string
          product_slug: string
          reference_kind: string
          reference_price_cents: number
          stock_quantity: number
          total_count: number
          vendor_id: string
          vendor_name: string
        }[]
      }
      search_discount_offers_by_vendor: {
        Args: {
          _brand_ids?: string[]
          _category_ids?: string[]
          _country?: string
          _limit?: number
          _manufacturer_ids?: string[]
          _max_products_per_vendor?: number
          _min_discount_pct?: number
          _reference?: string
        }
        Returns: {
          avg_discount_pct: number
          max_mov_eur_cents: number
          min_basket_at_moq_eur_cents: number
          product_count: number
          products: Json
          total_savings_eur_cents: number
          vendor_id: string
          vendor_name: string
        }[]
      }
      self_start_vendor_market_intel_trial: {
        Args: never
        Returns: {
          billing_method:
            | Database["public"]["Enums"]["vendor_market_intel_billing"]
            | null
          created_at: string
          granted_by: string | null
          notes: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["vendor_market_intel_status"]
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_started_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          vendor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vendor_market_intel_entitlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_active_account: {
        Args: { _account_id: string; _kind: string }
        Returns: Json
      }
      set_user_preference: {
        Args: { _key: string; _value: string }
        Returns: undefined
      }
      slugify_category_label: { Args: { _label: string }; Returns: string }
      snapshot_vendor_offer_history: { Args: never; Returns: Json }
      start_buyer_impersonation: {
        Args: { _reason?: string; _target_user_id: string }
        Returns: string
      }
      start_vendor_market_intel_trial: {
        Args: { _notes?: string; _trial_days?: number; _vendor_id: string }
        Returns: {
          billing_method:
            | Database["public"]["Enums"]["vendor_market_intel_billing"]
            | null
          created_at: string
          granted_by: string | null
          notes: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["vendor_market_intel_status"]
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_started_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          vendor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vendor_market_intel_entitlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_brand_review: {
        Args: {
          _brand_id: string
          _comment?: string
          _rating_delivery: number
          _rating_documentation: number
          _rating_margin: number
          _rating_quality: number
          _rating_support: number
        }
        Returns: string
      }
      subscription_run_daily_tick: { Args: never; Returns: Json }
      sync_quote_to_forecast_order: {
        Args: { _quote_id: string }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_brand_product_counts: { Args: never; Returns: undefined }
      update_contract_template_draft: {
        Args: {
          _articles: Json
          _id: string
          _medikong_data: Json
          _notes: string
          _required_fields: Json
        }
        Returns: {
          articles: Json
          contract_type: string
          created_at: string
          created_by: string | null
          effective_at: string | null
          id: string
          medikong_data: Json
          notes: string | null
          required_fields: Json
          status: string
          updated_at: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "contract_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_manufacturer_product_counts: { Args: never; Returns: undefined }
      update_market_delta_anomaly: {
        Args: {
          _assigned_to?: string
          _clear_assignee?: boolean
          _id: string
          _notes?: string
          _status?: string
        }
        Returns: {
          assigned_at: string | null
          assigned_to: string | null
          delta_abs: number
          delta_pct: number
          detected_at: string
          direction: string
          id: string
          market_sample_size: number
          market_unit_price_median: number
          mk_pack_size: number
          mk_unit_price: number
          notes: string | null
          notes_updated_at: string | null
          notes_updated_by: string | null
          offer_id: string
          product_id: string
          resolved_at: string | null
          resolved_by: string | null
          run_id: string
          status: string
          threshold_pct: number
          vendor_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "market_delta_anomalies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_cron_shared_secret: {
        Args: { _name: string; _secret: string }
        Returns: string
      }
      upsert_market_prices: { Args: { rows: Json }; Returns: number }
      upsert_sourcing_item: {
        Args: {
          _brand_id: string
          _buyer_price_cents: number
          _cnk: string
          _dedupe_key: string
          _gtin: string
          _product_id: string
          _quantity: number
          _raw_brand: string
          _raw_name: string
          _status: string
          _user_id: string
        }
        Returns: string
      }
      user_has_ordered_brand: {
        Args: { _brand_id: string; _user_id: string }
        Returns: boolean
      }
      validate_cron_secret: { Args: { _secret: string }; Returns: boolean }
      vendor_accept_guarantee: {
        Args: { _version_id: string }
        Returns: string
      }
      vendor_analytics_by_country:
        | {
            Args: { _from: string; _to: string }
            Returns: {
              ca_htva_cents: number
              country_code: string
              orders_count: number
              share: number
            }[]
          }
        | {
            Args: { _from: string; _to: string; _vendor_id?: string }
            Returns: {
              ca_htva_cents: number
              country_code: string
              orders_count: number
              share: number
            }[]
          }
      vendor_analytics_by_customer_type:
        | {
            Args: { _from: string; _to: string }
            Returns: {
              ca_htva_cents: number
              customer_type: string
              orders_count: number
              share: number
            }[]
          }
        | {
            Args: { _from: string; _to: string; _vendor_id?: string }
            Returns: {
              ca_htva_cents: number
              customer_type: string
              orders_count: number
              share: number
            }[]
          }
      vendor_analytics_cohorts:
        | {
            Args: { _months?: number }
            Returns: {
              active_m1: number
              active_m2: number
              active_m3: number
              cohort_month: string
              cohort_size: number
            }[]
          }
        | {
            Args: { _months?: number; _vendor_id?: string }
            Returns: {
              active_m1: number
              active_m2: number
              active_m3: number
              cohort_month: string
              cohort_size: number
            }[]
          }
      vendor_analytics_customer_locations:
        | {
            Args: { _from: string; _to: string }
            Returns: {
              ca_htva_cents: number
              city: string
              country_code: string
              customers_count: number
              orders_count: number
              postal_code: string
            }[]
          }
        | {
            Args: { _from: string; _to: string; _vendor_id?: string }
            Returns: {
              ca_htva_cents: number
              city: string
              country_code: string
              customers_count: number
              orders_count: number
              postal_code: string
            }[]
          }
        | {
            Args: {
              _from: string
              _product_id?: string
              _to: string
              _vendor_id?: string
            }
            Returns: {
              ca_htva_cents: number
              city: string
              country_code: string
              customers_count: number
              orders_count: number
              postal_code: string
            }[]
          }
      vendor_analytics_kpis:
        | {
            Args: { _from: string; _to: string }
            Returns: {
              active_customers: number
              avg_basket_cents: number
              ca_htva_cents: number
              commission_cents: number
              margin_cents: number
              orders_count: number
              prev_active_customers: number
              prev_avg_basket_cents: number
              prev_ca_htva_cents: number
              prev_commission_cents: number
              prev_margin_cents: number
              prev_orders_count: number
            }[]
          }
        | {
            Args: { _from: string; _to: string; _vendor_id?: string }
            Returns: {
              active_customers: number
              avg_basket_cents: number
              ca_htva_cents: number
              commission_cents: number
              margin_cents: number
              orders_count: number
              prev_active_customers: number
              prev_avg_basket_cents: number
              prev_ca_htva_cents: number
              prev_commission_cents: number
              prev_margin_cents: number
              prev_orders_count: number
            }[]
          }
      vendor_analytics_recurrence:
        | {
            Args: { _from: string; _to: string }
            Returns: {
              avg_days_between_orders: number
              avg_orders_per_customer: number
              churn_risk_count: number
              new_customers: number
              returning_customers: number
              total_customers: number
            }[]
          }
        | {
            Args: { _from: string; _to: string; _vendor_id?: string }
            Returns: {
              avg_days_between_orders: number
              avg_orders_per_customer: number
              churn_risk_count: number
              new_customers: number
              returning_customers: number
              total_customers: number
            }[]
          }
      vendor_analytics_top_customers:
        | {
            Args: { _from: string; _limit?: number; _to: string }
            Returns: {
              ca_htva_cents: number
              city: string
              company_name: string
              country_code: string
              customer_id: string
              customer_type: string
              last_order_at: string
              orders_count: number
              postal_code: string
              share: number
            }[]
          }
        | {
            Args: {
              _from: string
              _limit?: number
              _to: string
              _vendor_id?: string
            }
            Returns: {
              ca_htva_cents: number
              city: string
              company_name: string
              country_code: string
              customer_id: string
              customer_type: string
              last_order_at: string
              orders_count: number
              postal_code: string
              share: number
            }[]
          }
      vendor_analytics_top_products:
        | {
            Args: { _from: string; _limit?: number; _to: string }
            Returns: {
              ca_htva_cents: number
              commission_cents: number
              margin_cents: number
              product_id: string
              product_name: string
              units: number
            }[]
          }
        | {
            Args: {
              _from: string
              _limit?: number
              _to: string
              _vendor_id?: string
            }
            Returns: {
              ca_htva_cents: number
              commission_cents: number
              margin_cents: number
              product_id: string
              product_name: string
              units: number
            }[]
          }
      vendor_gmv_filters_self_test: {
        Args: never
        Returns: {
          actual: number
          details: string
          expected: number
          ok: boolean
          scenario: string
        }[]
      }
      vendor_gmv_filters_self_test_admin: {
        Args: never
        Returns: {
          actual: number
          details: string
          expected: number
          ok: boolean
          scenario: string
        }[]
      }
      vendor_has_accepted_current_guarantee: {
        Args: { _vendor_id: string }
        Returns: boolean
      }
      vendor_market_intel_access: {
        Args: { _vendor_id: string }
        Returns: boolean
      }
      vendor_sell_in_vs_sell_out: {
        Args: { _report_id: string }
        Returns: {
          cnk_code: string
          delta_units: number
          gtin: string
          product_id: string
          product_name: string
          sell_in_ca_htva_cents: number
          sell_in_units: number
          sell_out_net_cents: number
          sell_out_units: number
          sell_through_pct: number
        }[]
      }
      vendor_top_brands: {
        Args: { _limit?: number; _vendor_id: string }
        Returns: {
          brand_id: string
          brand_logo_url: string
          brand_name: string
          brand_slug: string
          offer_count: number
        }[]
      }
      vendor_update_order_line_status: {
        Args: {
          _cancellation_reason?: string
          _line_id: string
          _quantity_shipped?: number
          _refunded_amount_incl_vat?: number
          _status: string
          _tracking_number?: string
          _tracking_url?: string
        }
        Returns: {
          buyer_confirmation_note: string | null
          buyer_confirmation_source: string | null
          buyer_confirmation_status:
            | Database["public"]["Enums"]["buyer_line_confirmation_status"]
            | null
          buyer_confirmed_at: string | null
          buyer_confirmed_quantity: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          commission_amount: number | null
          commission_basis: string | null
          commission_rate: number | null
          cost_price: number | null
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          line_cost: number | null
          line_margin: number | null
          line_total_excl_vat: number
          line_total_incl_vat: number
          manual_label: string | null
          offer_id: string | null
          order_id: string
          product_id: string | null
          qogita_offer_qid: string | null
          qogita_order_status: string
          qogita_seller_fid: string | null
          quantity: number
          quantity_shipped: number | null
          refunded_amount_incl_vat: number | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          tracking_number: string | null
          tracking_url: string | null
          unit_price_excl_vat: number
          unit_price_incl_vat: number
          updated_at: string
          vat_rate: number
          vendor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "order_lines"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      app_role: "super_admin" | "admin" | "moderator" | "user"
      buyer_line_confirmation_status:
        | "confirmed"
        | "partial"
        | "damaged"
        | "refused"
      buyer_p2p_commission_payer: "seller" | "buyer" | "split"
      buyer_p2p_status:
        | "draft"
        | "sent"
        | "accepted"
        | "declined"
        | "expired"
        | "cancelled"
        | "paid"
        | "shipped"
        | "completed"
      catalog_submission_status:
        | "active"
        | "pending_review"
        | "rejected"
        | "archived"
      commission_model_enum: "flat_percentage" | "margin_split" | "fixed_amount"
      commission_override_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "expired"
      customer_type:
        | "pharmacy"
        | "hospital"
        | "clinic"
        | "lab"
        | "other"
        | "wholesaler"
        | "doctor"
        | "nursing_home"
        | "retail"
        | "dentist"
        | "veterinary"
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
      guarantee_acceptance_source: "onboarding" | "backfill" | "admin_override"
      home_featured_badge: "bestseller" | "top_vente" | "nouveau" | "promo"
      home_featured_locale: "fr" | "nl" | "de" | "en" | "all"
      import_job_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      import_job_type: "buyer_comparator" | "product_submission"
      media_asset_type: "catalogue" | "affiche" | "video" | "fiche" | "brochure"
      media_link_entity: "product" | "brand" | "offer" | "cms"
      media_visibility: "public" | "authenticated" | "premium"
      notification_channel: "in_app" | "email" | "push"
      notification_sender: "system" | "superadmin"
      order_source: "web" | "api" | "manual_admin"
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
      payment_method_enum: "invoice" | "bank_transfer" | "card" | "mixed"
      payment_status_enum:
        | "pending"
        | "paid"
        | "overdue"
        | "refunded"
        | "pending_payment_manual"
      product_source:
        | "qogita"
        | "medikong"
        | "vendor"
        | "medi-market"
        | "valerco"
        | "vanheek"
      product_submission_status:
        | "submitted"
        | "in_review"
        | "approved"
        | "rejected"
        | "needs_changes"
      pvp_source_enum: "apb" | "pmr" | "manufacturer" | "distributor" | "manual"
      qogita_resync_mode:
        | "daily_stale_refresh"
        | "mute_detection"
        | "incremental"
        | "full"
        | "manual"
        | "reconciliation_sweep"
      qogita_resync_status:
        | "running"
        | "success"
        | "partial"
        | "failed"
        | "needs_review"
        | "skipped_guardrail"
      quote_payment_method: "invoice" | "stripe"
      quote_status:
        | "draft"
        | "sent"
        | "accepted"
        | "paid"
        | "declined"
        | "converted"
        | "expired"
      reshipment_status_enum:
        | "not_applicable"
        | "awaiting_reception"
        | "received_at_warehouse"
        | "repackaging"
        | "reshipped"
      rfq_dispatch_status:
        | "dispatched"
        | "viewed"
        | "pending_review"
        | "reminded"
        | "responded"
        | "declined"
        | "expired"
        | "awarded"
        | "lost"
      rfq_ledger_kind:
        | "consume"
        | "grant_admin"
        | "purchase_pack"
        | "subscribe_plan"
        | "monthly_reset"
        | "refund"
        | "expire_plan"
      rfq_plan_type:
        | "free_quota"
        | "credit_pack"
        | "monthly_plan"
        | "unlimited_plan"
      rfq_routing_decision: "selected" | "excluded" | "over_cap"
      rfq_status:
        | "draft"
        | "open"
        | "dispatched"
        | "in_followup"
        | "closed"
        | "awarded"
        | "cancelled"
      rfq_target_reason:
        | "product_offer"
        | "brand_interest"
        | "manufacturer_interest"
        | "product_interest"
        | "manual"
        | "category_interest"
      rfq_target_scope: "product_only" | "brand_only" | "product_and_brand"
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
        | "vendor_top_brands_mv"
      urgency_enum: "low" | "medium" | "high"
      vendor_exclusivity_mode: "showcase" | "hide" | "block"
      vendor_exclusivity_scope:
        | "brand"
        | "manufacturer"
        | "product"
        | "category"
      vendor_market_intel_billing: "stripe" | "medikong_invoice"
      vendor_market_intel_status:
        | "none"
        | "trial"
        | "active"
        | "expired"
        | "cancelled"
      vendor_offer_campaign_source:
        | "catalog_pick"
        | "xlsx_upload"
        | "manual"
        | "mixed"
      vendor_offer_campaign_status:
        | "draft"
        | "pending_validation"
        | "active"
        | "paused"
        | "archived"
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
      app_role: ["super_admin", "admin", "moderator", "user"],
      buyer_line_confirmation_status: [
        "confirmed",
        "partial",
        "damaged",
        "refused",
      ],
      buyer_p2p_commission_payer: ["seller", "buyer", "split"],
      buyer_p2p_status: [
        "draft",
        "sent",
        "accepted",
        "declined",
        "expired",
        "cancelled",
        "paid",
        "shipped",
        "completed",
      ],
      catalog_submission_status: [
        "active",
        "pending_review",
        "rejected",
        "archived",
      ],
      commission_model_enum: [
        "flat_percentage",
        "margin_split",
        "fixed_amount",
      ],
      commission_override_status: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "expired",
      ],
      customer_type: [
        "pharmacy",
        "hospital",
        "clinic",
        "lab",
        "other",
        "wholesaler",
        "doctor",
        "nursing_home",
        "retail",
        "dentist",
        "veterinary",
      ],
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
      guarantee_acceptance_source: ["onboarding", "backfill", "admin_override"],
      home_featured_badge: ["bestseller", "top_vente", "nouveau", "promo"],
      home_featured_locale: ["fr", "nl", "de", "en", "all"],
      import_job_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      import_job_type: ["buyer_comparator", "product_submission"],
      media_asset_type: ["catalogue", "affiche", "video", "fiche", "brochure"],
      media_link_entity: ["product", "brand", "offer", "cms"],
      media_visibility: ["public", "authenticated", "premium"],
      notification_channel: ["in_app", "email", "push"],
      notification_sender: ["system", "superadmin"],
      order_source: ["web", "api", "manual_admin"],
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
      payment_method_enum: ["invoice", "bank_transfer", "card", "mixed"],
      payment_status_enum: [
        "pending",
        "paid",
        "overdue",
        "refunded",
        "pending_payment_manual",
      ],
      product_source: [
        "qogita",
        "medikong",
        "vendor",
        "medi-market",
        "valerco",
        "vanheek",
      ],
      product_submission_status: [
        "submitted",
        "in_review",
        "approved",
        "rejected",
        "needs_changes",
      ],
      pvp_source_enum: ["apb", "pmr", "manufacturer", "distributor", "manual"],
      qogita_resync_mode: [
        "daily_stale_refresh",
        "mute_detection",
        "incremental",
        "full",
        "manual",
        "reconciliation_sweep",
      ],
      qogita_resync_status: [
        "running",
        "success",
        "partial",
        "failed",
        "needs_review",
        "skipped_guardrail",
      ],
      quote_payment_method: ["invoice", "stripe"],
      quote_status: [
        "draft",
        "sent",
        "accepted",
        "paid",
        "declined",
        "converted",
        "expired",
      ],
      reshipment_status_enum: [
        "not_applicable",
        "awaiting_reception",
        "received_at_warehouse",
        "repackaging",
        "reshipped",
      ],
      rfq_dispatch_status: [
        "dispatched",
        "viewed",
        "pending_review",
        "reminded",
        "responded",
        "declined",
        "expired",
        "awarded",
        "lost",
      ],
      rfq_ledger_kind: [
        "consume",
        "grant_admin",
        "purchase_pack",
        "subscribe_plan",
        "monthly_reset",
        "refund",
        "expire_plan",
      ],
      rfq_plan_type: [
        "free_quota",
        "credit_pack",
        "monthly_plan",
        "unlimited_plan",
      ],
      rfq_routing_decision: ["selected", "excluded", "over_cap"],
      rfq_status: [
        "draft",
        "open",
        "dispatched",
        "in_followup",
        "closed",
        "awarded",
        "cancelled",
      ],
      rfq_target_reason: [
        "product_offer",
        "brand_interest",
        "manufacturer_interest",
        "product_interest",
        "manual",
        "category_interest",
      ],
      rfq_target_scope: ["product_only", "brand_only", "product_and_brand"],
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
        "vendor_top_brands_mv",
      ],
      urgency_enum: ["low", "medium", "high"],
      vendor_exclusivity_mode: ["showcase", "hide", "block"],
      vendor_exclusivity_scope: [
        "brand",
        "manufacturer",
        "product",
        "category",
      ],
      vendor_market_intel_billing: ["stripe", "medikong_invoice"],
      vendor_market_intel_status: [
        "none",
        "trial",
        "active",
        "expired",
        "cancelled",
      ],
      vendor_offer_campaign_source: [
        "catalog_pick",
        "xlsx_upload",
        "manual",
        "mixed",
      ],
      vendor_offer_campaign_status: [
        "draft",
        "pending_validation",
        "active",
        "paused",
        "archived",
      ],
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
