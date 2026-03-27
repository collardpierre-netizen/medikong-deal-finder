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
      offers: {
        Row: {
          bundle_size: number
          created_at: string | null
          delivery_days: number
          id: string
          is_active: boolean | null
          last_updated: string | null
          mov_eur: number
          price_tiers: Json | null
          product_id: string
          seller_id: string
          ship_from_country: string
          stock_quantity: number
          unit_price_eur: number
        }
        Insert: {
          bundle_size?: number
          created_at?: string | null
          delivery_days?: number
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          mov_eur: number
          price_tiers?: Json | null
          product_id: string
          seller_id: string
          ship_from_country?: string
          stock_quantity?: number
          unit_price_eur: number
        }
        Update: {
          bundle_size?: number
          created_at?: string | null
          delivery_days?: number
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          mov_eur?: number
          price_tiers?: Json | null
          product_id?: string
          seller_id?: string
          ship_from_country?: string
          stock_quantity?: number
          unit_price_eur?: number
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
            foreignKeyName: "offers_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_brand: string
          product_id: string
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_brand: string
          product_id: string
          product_name: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_brand?: string
          product_id?: string
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
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
      orders: {
        Row: {
          created_at: string
          id: string
          order_number: string
          payment_method: string
          shipping_address: string
          shipping_cost: number
          shipping_method: string
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_number: string
          payment_method?: string
          shipping_address: string
          shipping_cost?: number
          shipping_method?: string
          status?: string
          subtotal: number
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_number?: string
          payment_method?: string
          shipping_address?: string
          shipping_cost?: number
          shipping_method?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_reports: {
        Row: {
          created_at: string | null
          description: string
          id: string
          product_id: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          reporter_id: string | null
          reporter_role: Database["public"]["Enums"]["reporter_role"] | null
          status: Database["public"]["Enums"]["report_status"] | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          product_id?: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          reporter_id?: string | null
          reporter_role?: Database["public"]["Enums"]["reporter_role"] | null
          status?: Database["public"]["Enums"]["report_status"] | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          product_id?: string | null
          report_type?: Database["public"]["Enums"]["report_type"]
          reporter_id?: string | null
          reporter_role?: Database["public"]["Enums"]["reporter_role"] | null
          status?: Database["public"]["Enums"]["report_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suggestions: {
        Row: {
          created_at: string | null
          gtin: string
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["suggestion_status"] | null
          suggested_brand: string | null
          suggested_category: string | null
          suggested_image_url: string | null
          suggested_name: string | null
        }
        Insert: {
          created_at?: string | null
          gtin: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"] | null
          suggested_brand?: string | null
          suggested_category?: string | null
          suggested_image_url?: string | null
          suggested_name?: string | null
        }
        Update: {
          created_at?: string | null
          gtin?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"] | null
          suggested_brand?: string | null
          suggested_category?: string | null
          suggested_image_url?: string | null
          suggested_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_suggestions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string
          category_l1: string
          category_l2: string
          category_l3: string
          category_l4: string | null
          created_at: string | null
          created_by: string | null
          depth_cm: number | null
          description_short: string | null
          gtin: string
          height_cm: number | null
          id: string
          ingredients: string | null
          mpn: string | null
          primary_image_url: string
          product_name: string
          rrp_eur: number | null
          secondary_images: Json | null
          status: Database["public"]["Enums"]["product_status"] | null
          updated_at: string | null
          weight_g: number
          width_cm: number | null
        }
        Insert: {
          brand: string
          category_l1: string
          category_l2: string
          category_l3: string
          category_l4?: string | null
          created_at?: string | null
          created_by?: string | null
          depth_cm?: number | null
          description_short?: string | null
          gtin: string
          height_cm?: number | null
          id?: string
          ingredients?: string | null
          mpn?: string | null
          primary_image_url?: string
          product_name: string
          rrp_eur?: number | null
          secondary_images?: Json | null
          status?: Database["public"]["Enums"]["product_status"] | null
          updated_at?: string | null
          weight_g: number
          width_cm?: number | null
        }
        Update: {
          brand?: string
          category_l1?: string
          category_l2?: string
          category_l3?: string
          category_l4?: string | null
          created_at?: string | null
          created_by?: string | null
          depth_cm?: number | null
          description_short?: string | null
          gtin?: string
          height_cm?: number | null
          id?: string
          ingredients?: string | null
          mpn?: string | null
          primary_image_url?: string
          product_name?: string
          rrp_eur?: number | null
          secondary_images?: Json | null
          status?: Database["public"]["Enums"]["product_status"] | null
          updated_at?: string | null
          weight_g?: number
          width_cm?: number | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      search_products: {
        Args: { search_query: string }
        Returns: {
          brand: string
          category_l1: string
          category_l2: string
          category_l3: string
          category_l4: string | null
          created_at: string | null
          created_by: string | null
          depth_cm: number | null
          description_short: string | null
          gtin: string
          height_cm: number | null
          id: string
          ingredients: string | null
          mpn: string | null
          primary_image_url: string
          product_name: string
          rrp_eur: number | null
          secondary_images: Json | null
          status: Database["public"]["Enums"]["product_status"] | null
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
    },
  },
} as const
