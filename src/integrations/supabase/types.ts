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
          categories: string[] | null
          certifications: string[] | null
          country: string | null
          created_at: string
          description_fr: string | null
          founded: number | null
          gmv_month: number | null
          id: string
          logo_url: string | null
          manufacturer_id: string | null
          name: string
          products_count: number | null
          slug: string
          status: string
          tier: string | null
          website: string | null
        }
        Insert: {
          categories?: string[] | null
          certifications?: string[] | null
          country?: string | null
          created_at?: string
          description_fr?: string | null
          founded?: number | null
          gmv_month?: number | null
          id?: string
          logo_url?: string | null
          manufacturer_id?: string | null
          name: string
          products_count?: number | null
          slug: string
          status?: string
          tier?: string | null
          website?: string | null
        }
        Update: {
          categories?: string[] | null
          certifications?: string[] | null
          country?: string | null
          created_at?: string
          description_fr?: string | null
          founded?: number | null
          gmv_month?: number | null
          id?: string
          logo_url?: string | null
          manufacturer_id?: string | null
          name?: string
          products_count?: number | null
          slug?: string
          status?: string
          tier?: string | null
          website?: string | null
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
      buyers: {
        Row: {
          address: string | null
          avg_payment_delay: string | null
          city: string | null
          company_name: string
          contact_name: string | null
          country: string | null
          created_at: string
          credit_limit: number | null
          credit_used: number | null
          email: string | null
          id: string
          payment_terms_default: string | null
          phone: string | null
          postal_code: string | null
          risk_score: string | null
          type: Database["public"]["Enums"]["buyer_type"]
          user_id: string | null
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          avg_payment_delay?: string | null
          city?: string | null
          company_name: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          credit_used?: number | null
          email?: string | null
          id?: string
          payment_terms_default?: string | null
          phone?: string | null
          postal_code?: string | null
          risk_score?: string | null
          type?: Database["public"]["Enums"]["buyer_type"]
          user_id?: string | null
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          avg_payment_delay?: string | null
          city?: string | null
          company_name?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          credit_used?: number | null
          email?: string | null
          id?: string
          payment_terms_default?: string | null
          phone?: string | null
          postal_code?: string | null
          risk_score?: string | null
          type?: Database["public"]["Enums"]["buyer_type"]
          user_id?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name_de: string | null
          name_fr: string
          name_nl: string | null
          parent_id: string | null
          product_count: number | null
          slug: string
          sort_order: number | null
          status: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name_de?: string | null
          name_fr: string
          name_nl?: string | null
          parent_id?: string | null
          product_count?: number | null
          slug: string
          sort_order?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name_de?: string | null
          name_fr?: string
          name_nl?: string | null
          parent_id?: string | null
          product_count?: number | null
          slug?: string
          sort_order?: number | null
          status?: string
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
      compliance_records: {
        Row: {
          afmps_notification: string | null
          afmps_status: string | null
          ce_expiry: string | null
          ce_marked: boolean | null
          created_at: string
          id: string
          last_audit: string | null
          mdr_class: Database["public"]["Enums"]["mdr_class"] | null
          next_audit: string | null
          product_id: string | null
          risk_level: string | null
        }
        Insert: {
          afmps_notification?: string | null
          afmps_status?: string | null
          ce_expiry?: string | null
          ce_marked?: boolean | null
          created_at?: string
          id?: string
          last_audit?: string | null
          mdr_class?: Database["public"]["Enums"]["mdr_class"] | null
          next_audit?: string | null
          product_id?: string | null
          risk_level?: string | null
        }
        Update: {
          afmps_notification?: string | null
          afmps_status?: string | null
          ce_expiry?: string | null
          ce_marked?: boolean | null
          created_at?: string
          id?: string
          last_audit?: string | null
          mdr_class?: Database["public"]["Enums"]["mdr_class"] | null
          next_audit?: string | null
          product_id?: string | null
          risk_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          amount: number | null
          buyer_id: string | null
          created_at: string
          dispute_number: string
          id: string
          order_id: string | null
          reason: string
          resolved_at: string | null
          sla_deadline: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          vendor_id: string | null
        }
        Insert: {
          amount?: number | null
          buyer_id?: string | null
          created_at?: string
          dispute_number: string
          id?: string
          order_id?: string | null
          reason: string
          resolved_at?: string | null
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          vendor_id?: string | null
        }
        Update: {
          amount?: number | null
          buyer_id?: string | null
          created_at?: string
          dispute_number?: string
          id?: string
          order_id?: string | null
          reason?: string
          resolved_at?: string | null
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          column_mapping: Json | null
          created_at: string
          duration_seconds: number | null
          file_name: string
          format: string
          id: string
          rows_created: number | null
          rows_errors: number | null
          rows_total: number | null
          rows_updated: number | null
          status: string
          vendor_id: string | null
        }
        Insert: {
          column_mapping?: Json | null
          created_at?: string
          duration_seconds?: number | null
          file_name: string
          format?: string
          id?: string
          rows_created?: number | null
          rows_errors?: number | null
          rows_total?: number | null
          rows_updated?: number | null
          status?: string
          vendor_id?: string | null
        }
        Update: {
          column_mapping?: Json | null
          created_at?: string
          duration_seconds?: number | null
          file_name?: string
          format?: string
          id?: string
          rows_created?: number | null
          rows_errors?: number | null
          rows_total?: number | null
          rows_updated?: number | null
          status?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      invest_subscriptions: {
        Row: {
          address: string
          amount: number
          city: string
          company: string | null
          country: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          national_number: string | null
          net_cost: number
          notes: string | null
          phone: string
          postal_code: string
          shares: number
          status: string
          tax_reduction: number
          user_id: string | null
        }
        Insert: {
          address: string
          amount: number
          city: string
          company?: string | null
          country?: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          national_number?: string | null
          net_cost?: number
          notes?: string | null
          phone: string
          postal_code: string
          shares: number
          status?: string
          tax_reduction?: number
          user_id?: string | null
        }
        Update: {
          address?: string
          amount?: number
          city?: string
          company?: string | null
          country?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          national_number?: string | null
          net_cost?: number
          notes?: string | null
          phone?: string
          postal_code?: string
          shares?: number
          status?: string
          tax_reduction?: number
          user_id?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_ht: number
          amount_ttc: number | null
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          party_id: string | null
          party_type: string
          status: string
          tva_amount: number | null
          tva_rate: number | null
          type: string
        }
        Insert: {
          amount_ht?: number
          amount_ttc?: number | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          party_id?: string | null
          party_type?: string
          status?: string
          tva_amount?: number | null
          tva_rate?: number | null
          type?: string
        }
        Update: {
          amount_ht?: number
          amount_ttc?: number | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          party_id?: string | null
          party_type?: string
          status?: string
          tva_amount?: number | null
          tva_rate?: number | null
          type?: string
        }
        Relationships: []
      }
      leads_partners: {
        Row: {
          clicks_30d: number | null
          conversions_30d: number | null
          cpa_cpc_amount: number | null
          created_at: string
          feed_type: string | null
          id: string
          last_sync: string | null
          model: Database["public"]["Enums"]["lead_model"] | null
          name: string
          products_count: number | null
          revenue_30d: number | null
          status: string
          top_categories: string[] | null
          type: string | null
          url: string | null
        }
        Insert: {
          clicks_30d?: number | null
          conversions_30d?: number | null
          cpa_cpc_amount?: number | null
          created_at?: string
          feed_type?: string | null
          id?: string
          last_sync?: string | null
          model?: Database["public"]["Enums"]["lead_model"] | null
          name: string
          products_count?: number | null
          revenue_30d?: number | null
          status?: string
          top_categories?: string[] | null
          type?: string | null
          url?: string | null
        }
        Update: {
          clicks_30d?: number | null
          conversions_30d?: number | null
          cpa_cpc_amount?: number | null
          created_at?: string
          feed_type?: string | null
          id?: string
          last_sync?: string | null
          model?: Database["public"]["Enums"]["lead_model"] | null
          name?: string
          products_count?: number | null
          revenue_30d?: number | null
          status?: string
          top_categories?: string[] | null
          type?: string | null
          url?: string | null
        }
        Relationships: []
      }
      manufacturers: {
        Row: {
          brands: string[] | null
          certifications: string[] | null
          city: string | null
          compliance_status: string | null
          contacts: Json | null
          country: string | null
          created_at: string
          description_fr: string | null
          employees: string | null
          founded: number | null
          id: string
          name: string
          products_on_mk: number | null
          revenue: string | null
          slug: string
          status: string
          website: string | null
        }
        Insert: {
          brands?: string[] | null
          certifications?: string[] | null
          city?: string | null
          compliance_status?: string | null
          contacts?: Json | null
          country?: string | null
          created_at?: string
          description_fr?: string | null
          employees?: string | null
          founded?: number | null
          id?: string
          name: string
          products_on_mk?: number | null
          revenue?: string | null
          slug: string
          status?: string
          website?: string | null
        }
        Update: {
          brands?: string[] | null
          certifications?: string[] | null
          city?: string | null
          compliance_status?: string | null
          contacts?: Json | null
          country?: string | null
          created_at?: string
          description_fr?: string | null
          employees?: string | null
          founded?: number | null
          id?: string
          name?: string
          products_on_mk?: number | null
          revenue?: string | null
          slug?: string
          status?: string
          website?: string | null
        }
        Relationships: []
      }
      offers_direct: {
        Row: {
          commission_rate: number | null
          created_at: string
          delivery_days: number | null
          id: string
          is_buy_box: boolean | null
          moq: number | null
          mov: number | null
          price_ht: number
          price_ttc: number | null
          product_id: string
          rating: number | null
          status: string
          stock: number
          tva_rate: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          commission_rate?: number | null
          created_at?: string
          delivery_days?: number | null
          id?: string
          is_buy_box?: boolean | null
          moq?: number | null
          mov?: number | null
          price_ht: number
          price_ttc?: number | null
          product_id: string
          rating?: number | null
          status?: string
          stock?: number
          tva_rate?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          commission_rate?: number | null
          created_at?: string
          delivery_days?: number | null
          id?: string
          is_buy_box?: boolean | null
          moq?: number | null
          mov?: number | null
          price_ht?: number
          price_ttc?: number | null
          product_id?: string
          rating?: number | null
          status?: string
          stock?: number
          tva_rate?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_direct_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_direct_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      offers_indirect: {
        Row: {
          clicks_30d: number | null
          conversion_rate: number | null
          conversions_30d: number | null
          cpa_amount: number | null
          created_at: string
          external_url: string | null
          id: string
          in_stock: boolean | null
          last_sync: string | null
          model: Database["public"]["Enums"]["lead_model"] | null
          partner_id: string | null
          price: number | null
          product_id: string
          revenue_30d: number | null
          source_type: string | null
          status: string
        }
        Insert: {
          clicks_30d?: number | null
          conversion_rate?: number | null
          conversions_30d?: number | null
          cpa_amount?: number | null
          created_at?: string
          external_url?: string | null
          id?: string
          in_stock?: boolean | null
          last_sync?: string | null
          model?: Database["public"]["Enums"]["lead_model"] | null
          partner_id?: string | null
          price?: number | null
          product_id: string
          revenue_30d?: number | null
          source_type?: string | null
          status?: string
        }
        Update: {
          clicks_30d?: number | null
          conversion_rate?: number | null
          conversions_30d?: number | null
          cpa_amount?: number | null
          created_at?: string
          external_url?: string | null
          id?: string
          in_stock?: boolean | null
          last_sync?: string | null
          model?: Database["public"]["Enums"]["lead_model"] | null
          partner_id?: string | null
          price?: number | null
          product_id?: string
          revenue_30d?: number | null
          source_type?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_indirect_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      offers_market: {
        Row: {
          created_at: string
          id: string
          in_stock: boolean | null
          last_change_date: string | null
          last_change_from: number | null
          last_change_to: number | null
          match_confidence: number | null
          method: string | null
          price: number | null
          product_id: string
          source_name: string
          source_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          in_stock?: boolean | null
          last_change_date?: string | null
          last_change_from?: number | null
          last_change_to?: number | null
          match_confidence?: number | null
          method?: string | null
          price?: number | null
          product_id: string
          source_name: string
          source_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          in_stock?: boolean | null
          last_change_date?: string | null
          last_change_from?: number | null
          last_change_to?: number | null
          match_confidence?: number | null
          method?: string | null
          price?: number | null
          product_id?: string
          source_name?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_market_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string | null
          buyer_type: string | null
          channel: string | null
          created_at: string
          due_date: string | null
          id: string
          items_count: number | null
          order_number: string
          payment_method: string
          po_reference: string | null
          shipping_address: string
          shipping_cost: number
          shipping_method: string
          status: string
          subtotal: number
          total: number
          total_ht: number | null
          total_ttc: number | null
          tva_amount: number | null
          tva_rate: number | null
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          buyer_id?: string | null
          buyer_type?: string | null
          channel?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          items_count?: number | null
          order_number: string
          payment_method?: string
          po_reference?: string | null
          shipping_address: string
          shipping_cost?: number
          shipping_method?: string
          status?: string
          subtotal: number
          total: number
          total_ht?: number | null
          total_ttc?: number | null
          tva_amount?: number | null
          tva_rate?: number | null
          updated_at?: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          buyer_id?: string | null
          buyer_type?: string | null
          channel?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          items_count?: number | null
          order_number?: string
          payment_method?: string
          po_reference?: string | null
          shipping_address?: string
          shipping_cost?: number
          shipping_method?: string
          status?: string
          subtotal?: number
          total?: number
          total_ht?: number | null
          total_ttc?: number | null
          tva_amount?: number | null
          tva_rate?: number | null
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          afmps_notification: string | null
          attributes: Json | null
          brand: string
          brand_id: string | null
          category_id: string | null
          category_l1: string
          category_l2: string
          category_l3: string
          category_l4: string | null
          ce_marked: boolean | null
          cnk: string | null
          created_at: string | null
          created_by: string | null
          depth_cm: number | null
          description_de: string | null
          description_nl: string | null
          description_short: string | null
          gtin: string
          height_cm: number | null
          id: string
          ingredients: string | null
          manufacturer_id: string | null
          mdr_class: string | null
          mpn: string | null
          primary_image_url: string
          product_name: string
          rrp_eur: number | null
          secondary_images: Json | null
          status: Database["public"]["Enums"]["product_status"] | null
          sub_category_id: string | null
          updated_at: string | null
          weight_g: number
          width_cm: number | null
        }
        Insert: {
          afmps_notification?: string | null
          attributes?: Json | null
          brand: string
          brand_id?: string | null
          category_id?: string | null
          category_l1: string
          category_l2: string
          category_l3: string
          category_l4?: string | null
          ce_marked?: boolean | null
          cnk?: string | null
          created_at?: string | null
          created_by?: string | null
          depth_cm?: number | null
          description_de?: string | null
          description_nl?: string | null
          description_short?: string | null
          gtin: string
          height_cm?: number | null
          id?: string
          ingredients?: string | null
          manufacturer_id?: string | null
          mdr_class?: string | null
          mpn?: string | null
          primary_image_url?: string
          product_name: string
          rrp_eur?: number | null
          secondary_images?: Json | null
          status?: Database["public"]["Enums"]["product_status"] | null
          sub_category_id?: string | null
          updated_at?: string | null
          weight_g: number
          width_cm?: number | null
        }
        Update: {
          afmps_notification?: string | null
          attributes?: Json | null
          brand?: string
          brand_id?: string | null
          category_id?: string | null
          category_l1?: string
          category_l2?: string
          category_l3?: string
          category_l4?: string | null
          ce_marked?: boolean | null
          cnk?: string | null
          created_at?: string | null
          created_by?: string | null
          depth_cm?: number | null
          description_de?: string | null
          description_nl?: string | null
          description_short?: string | null
          gtin?: string
          height_cm?: number | null
          id?: string
          ingredients?: string | null
          manufacturer_id?: string | null
          mdr_class?: string | null
          mpn?: string | null
          primary_image_url?: string
          product_name?: string
          rrp_eur?: number | null
          secondary_images?: Json | null
          status?: Database["public"]["Enums"]["product_status"] | null
          sub_category_id?: string | null
          updated_at?: string | null
          weight_g?: number
          width_cm?: number | null
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
          {
            foreignKeyName: "products_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
          sector?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      sellers: {
        Row: {
          company_name: string
          company_registration: string | null
          contact_email: string
          contact_phone: string | null
          country: string
          created_at: string | null
          id: string
          is_top_rated: boolean | null
          is_verified: boolean | null
          user_id: string | null
          vat_number: string | null
        }
        Insert: {
          company_name: string
          company_registration?: string | null
          contact_email: string
          contact_phone?: string | null
          country?: string
          created_at?: string | null
          id?: string
          is_top_rated?: boolean | null
          is_verified?: boolean | null
          user_id?: string | null
          vat_number?: string | null
        }
        Update: {
          company_name?: string
          company_registration?: string | null
          contact_email?: string
          contact_phone?: string | null
          country?: string
          created_at?: string | null
          id?: string
          is_top_rated?: boolean | null
          is_verified?: boolean | null
          user_id?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      vendor_onboarding: {
        Row: {
          documents: Json | null
          id: string
          notes: string | null
          progress_percent: number | null
          started_at: string
          step: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          documents?: Json | null
          id?: string
          notes?: string | null
          progress_percent?: number | null
          started_at?: string
          step?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          documents?: Json | null
          id?: string
          notes?: string | null
          progress_percent?: number | null
          started_at?: string
          step?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_onboarding_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          about_text: string | null
          account_manager: string | null
          activation_date: string | null
          address: string | null
          afmps_number: string | null
          bce: string | null
          bic: string | null
          city: string | null
          commission_rate: number | null
          company_name: string
          contact_name: string | null
          contact_role: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          default_language: string | null
          delivery_days: number | null
          display_name: string | null
          email: string
          franco_ht: number | null
          hours: Json | null
          iban: string | null
          id: string
          insurance_expiry: string | null
          insurance_number: string | null
          insurance_provider: string | null
          internal_score: number | null
          is_public: boolean | null
          languages: string[] | null
          legal_form: string | null
          legal_name: string | null
          logo_url: string | null
          min_order_ht: number | null
          onboarding_date: string | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          risk_level: string | null
          shipping_methods: Json | null
          slug: string
          status: Database["public"]["Enums"]["vendor_status"]
          tagline: string | null
          tier: Database["public"]["Enums"]["vendor_tier"]
          updated_at: string
          user_id: string | null
          vat_number: string | null
          vat_verified: boolean | null
          warehouse_address: string | null
          website: string | null
          wholesale_license: string | null
          wholesale_license_expiry: string | null
        }
        Insert: {
          about_text?: string | null
          account_manager?: string | null
          activation_date?: string | null
          address?: string | null
          afmps_number?: string | null
          bce?: string | null
          bic?: string | null
          city?: string | null
          commission_rate?: number | null
          company_name: string
          contact_name?: string | null
          contact_role?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          default_language?: string | null
          delivery_days?: number | null
          display_name?: string | null
          email: string
          franco_ht?: number | null
          hours?: Json | null
          iban?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_number?: string | null
          insurance_provider?: string | null
          internal_score?: number | null
          is_public?: boolean | null
          languages?: string[] | null
          legal_form?: string | null
          legal_name?: string | null
          logo_url?: string | null
          min_order_ht?: number | null
          onboarding_date?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          risk_level?: string | null
          shipping_methods?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["vendor_status"]
          tagline?: string | null
          tier?: Database["public"]["Enums"]["vendor_tier"]
          updated_at?: string
          user_id?: string | null
          vat_number?: string | null
          vat_verified?: boolean | null
          warehouse_address?: string | null
          website?: string | null
          wholesale_license?: string | null
          wholesale_license_expiry?: string | null
        }
        Update: {
          about_text?: string | null
          account_manager?: string | null
          activation_date?: string | null
          address?: string | null
          afmps_number?: string | null
          bce?: string | null
          bic?: string | null
          city?: string | null
          commission_rate?: number | null
          company_name?: string
          contact_name?: string | null
          contact_role?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          default_language?: string | null
          delivery_days?: number | null
          display_name?: string | null
          email?: string
          franco_ht?: number | null
          hours?: Json | null
          iban?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_number?: string | null
          insurance_provider?: string | null
          internal_score?: number | null
          is_public?: boolean | null
          languages?: string[] | null
          legal_form?: string | null
          legal_name?: string | null
          logo_url?: string | null
          min_order_ht?: number | null
          onboarding_date?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          risk_level?: string | null
          shipping_methods?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["vendor_status"]
          tagline?: string | null
          tier?: Database["public"]["Enums"]["vendor_tier"]
          updated_at?: string
          user_id?: string | null
          vat_number?: string | null
          vat_verified?: boolean | null
          warehouse_address?: string | null
          website?: string | null
          wholesale_license?: string | null
          wholesale_license_expiry?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      get_admin_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      search_products: {
        Args: { search_query: string }
        Returns: {
          afmps_notification: string | null
          attributes: Json | null
          brand: string
          brand_id: string | null
          category_id: string | null
          category_l1: string
          category_l2: string
          category_l3: string
          category_l4: string | null
          ce_marked: boolean | null
          cnk: string | null
          created_at: string | null
          created_by: string | null
          depth_cm: number | null
          description_de: string | null
          description_nl: string | null
          description_short: string | null
          gtin: string
          height_cm: number | null
          id: string
          ingredients: string | null
          manufacturer_id: string | null
          mdr_class: string | null
          mpn: string | null
          primary_image_url: string
          product_name: string
          rrp_eur: number | null
          secondary_images: Json | null
          status: Database["public"]["Enums"]["product_status"] | null
          sub_category_id: string | null
          updated_at: string | null
          weight_g: number
          width_cm: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      admin_role:
        | "super_admin"
        | "admin"
        | "moderateur"
        | "support"
        | "comptable"
      buyer_type:
        | "pharmacie"
        | "mrs"
        | "hopital"
        | "cabinet"
        | "parapharmacie"
        | "infirmier"
        | "dentiste"
      dispute_status:
        | "reclamation"
        | "enquete"
        | "reponse_vendeur"
        | "decision"
        | "resolu"
        | "rejete"
      lead_model: "CPA" | "CPC"
      mdr_class: "I" | "IIa" | "IIb" | "III"
      product_status: "draft" | "active" | "archived"
      report_status: "open" | "in_review" | "resolved" | "dismissed"
      report_type:
        | "wrong_name"
        | "wrong_image"
        | "wrong_category"
        | "wrong_brand"
        | "duplicate"
        | "other"
      reporter_role: "seller" | "buyer"
      suggestion_status: "pending" | "approved" | "rejected"
      vendor_status:
        | "pending"
        | "active"
        | "probation"
        | "suspended"
        | "rejected"
      vendor_tier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Strategic"
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
      buyer_type: [
        "pharmacie",
        "mrs",
        "hopital",
        "cabinet",
        "parapharmacie",
        "infirmier",
        "dentiste",
      ],
      dispute_status: [
        "reclamation",
        "enquete",
        "reponse_vendeur",
        "decision",
        "resolu",
        "rejete",
      ],
      lead_model: ["CPA", "CPC"],
      mdr_class: ["I", "IIa", "IIb", "III"],
      product_status: ["draft", "active", "archived"],
      report_status: ["open", "in_review", "resolved", "dismissed"],
      report_type: [
        "wrong_name",
        "wrong_image",
        "wrong_category",
        "wrong_brand",
        "duplicate",
        "other",
      ],
      reporter_role: ["seller", "buyer"],
      suggestion_status: ["pending", "approved", "rejected"],
      vendor_status: [
        "pending",
        "active",
        "probation",
        "suspended",
        "rejected",
      ],
      vendor_tier: ["Bronze", "Silver", "Gold", "Platinum", "Strategic"],
    },
  },
} as const
