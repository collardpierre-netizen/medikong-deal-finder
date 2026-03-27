
-- Drop existing tables that will be replaced
DROP TABLE IF EXISTS public.offers CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.product_reports CASCADE;
DROP TABLE IF EXISTS public.product_suggestions CASCADE;

-- =============================================
-- ENUM TYPES
-- =============================================
CREATE TYPE public.vendor_status AS ENUM ('pending', 'active', 'probation', 'suspended', 'rejected');
CREATE TYPE public.vendor_tier AS ENUM ('Bronze', 'Silver', 'Gold', 'Platinum', 'Strategic');
CREATE TYPE public.admin_role AS ENUM ('super_admin', 'admin', 'moderateur', 'support', 'comptable');
CREATE TYPE public.buyer_type AS ENUM ('pharmacie', 'mrs', 'hopital', 'cabinet', 'parapharmacie', 'infirmier', 'dentiste');
CREATE TYPE public.dispute_status AS ENUM ('reclamation', 'enquete', 'reponse_vendeur', 'decision', 'resolu', 'rejete');
CREATE TYPE public.mdr_class AS ENUM ('I', 'IIa', 'IIb', 'III');
CREATE TYPE public.lead_model AS ENUM ('CPA', 'CPC');

-- =============================================
-- ADMIN USERS (references auth.users)
-- =============================================
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role admin_role NOT NULL DEFAULT 'support',
  is_active boolean NOT NULL DEFAULT true,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- =============================================
-- MANUFACTURERS
-- =============================================
CREATE TABLE public.manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  country text,
  city text,
  website text,
  founded int,
  employees text,
  revenue text,
  description_fr text,
  brands text[] DEFAULT '{}',
  products_on_mk int DEFAULT 0,
  certifications text[] DEFAULT '{}',
  contacts jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'active',
  compliance_status text DEFAULT 'compliant',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- BRANDS
-- =============================================
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  country text,
  website text,
  founded int,
  description_fr text,
  categories text[] DEFAULT '{}',
  products_count int DEFAULT 0,
  gmv_month numeric DEFAULT 0,
  certifications text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  tier text DEFAULT 'Bronze',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CATEGORIES (self-referencing)
-- =============================================
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_fr text NOT NULL,
  name_nl text,
  name_de text,
  slug text NOT NULL UNIQUE,
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  icon text,
  sort_order int DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  product_count int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VENDORS
-- =============================================
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  company_name text NOT NULL,
  legal_name text,
  legal_form text,
  vat_number text,
  vat_verified boolean DEFAULT false,
  bce text,
  iban text,
  bic text,
  insurance_number text,
  insurance_provider text,
  insurance_expiry date,
  wholesale_license text,
  wholesale_license_expiry date,
  afmps_number text,
  contact_name text,
  contact_role text,
  email text NOT NULL,
  phone text,
  website text,
  address text,
  postal_code text,
  city text,
  country text DEFAULT 'BE',
  warehouse_address text,
  display_name text,
  tagline text,
  about_text text,
  logo_url text,
  cover_image_url text,
  delivery_days int DEFAULT 3,
  franco_ht numeric DEFAULT 0,
  payment_terms text DEFAULT 'Net 30',
  shipping_methods jsonb DEFAULT '[]',
  min_order_ht numeric DEFAULT 0,
  hours jsonb,
  status vendor_status NOT NULL DEFAULT 'pending',
  risk_level text DEFAULT 'low',
  tier vendor_tier NOT NULL DEFAULT 'Bronze',
  commission_rate numeric DEFAULT 12,
  onboarding_date date,
  activation_date date,
  account_manager text,
  internal_score int DEFAULT 0,
  is_public boolean DEFAULT false,
  default_language text DEFAULT 'fr',
  languages text[] DEFAULT '{fr}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PRODUCTS (new version with FKs)
-- =============================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cnk text,
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sub_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description_nl text,
  ADD COLUMN IF NOT EXISTS description_de text,
  ADD COLUMN IF NOT EXISTS mdr_class text,
  ADD COLUMN IF NOT EXISTS ce_marked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS afmps_notification text,
  ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{}';

-- =============================================
-- BUYERS
-- =============================================
CREATE TABLE public.buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  type buyer_type NOT NULL DEFAULT 'pharmacie',
  vat_number text,
  contact_name text,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  country text DEFAULT 'BE',
  credit_limit numeric DEFAULT 0,
  credit_used numeric DEFAULT 0,
  payment_terms_default text DEFAULT 'Net 30',
  risk_score text DEFAULT 'A',
  avg_payment_delay text DEFAULT '0j',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- OFFERS DIRECT (vendor marketplace offers)
-- =============================================
CREATE TABLE public.offers_direct (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  price_ht numeric NOT NULL,
  tva_rate numeric NOT NULL DEFAULT 6,
  price_ttc numeric GENERATED ALWAYS AS (price_ht * (1 + tva_rate / 100)) STORED,
  stock int NOT NULL DEFAULT 0,
  moq int DEFAULT 1,
  mov numeric DEFAULT 0,
  delivery_days int DEFAULT 3,
  status text NOT NULL DEFAULT 'active',
  is_buy_box boolean DEFAULT false,
  commission_rate numeric DEFAULT 12,
  rating numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.offers_direct ENABLE ROW LEVEL SECURITY;

-- =============================================
-- OFFERS INDIRECT (affiliation/lead partners)
-- =============================================
CREATE TABLE public.offers_indirect (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  partner_id uuid,
  external_url text,
  price numeric,
  in_stock boolean DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  source_type text,
  model lead_model DEFAULT 'CPA',
  cpa_amount numeric DEFAULT 0,
  clicks_30d int DEFAULT 0,
  conversions_30d int DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  revenue_30d numeric DEFAULT 0,
  last_sync timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.offers_indirect ENABLE ROW LEVEL SECURITY;

-- =============================================
-- OFFERS MARKET (price watch / competitor prices)
-- =============================================
CREATE TABLE public.offers_market (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  source_url text,
  price numeric,
  in_stock boolean DEFAULT true,
  method text DEFAULT 'scraping',
  match_confidence int DEFAULT 100,
  last_change_date date,
  last_change_from numeric,
  last_change_to numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.offers_market ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ORDERS (new version)
-- =============================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES public.buyers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_type text,
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS items_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ht numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tva_rate numeric DEFAULT 6,
  ADD COLUMN IF NOT EXISTS tva_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ttc numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS po_reference text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'marketplace';

-- =============================================
-- DISPUTES
-- =============================================
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_number text NOT NULL UNIQUE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  buyer_id uuid REFERENCES public.buyers(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  reason text NOT NULL,
  amount numeric DEFAULT 0,
  status dispute_status NOT NULL DEFAULT 'reclamation',
  sla_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- COMPLIANCE RECORDS
-- =============================================
CREATE TABLE public.compliance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  mdr_class mdr_class,
  ce_marked boolean DEFAULT false,
  ce_expiry date,
  afmps_notification text,
  afmps_status text DEFAULT 'active',
  last_audit date,
  next_audit date,
  risk_level text DEFAULT 'LOW',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compliance_records ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VENDOR ONBOARDING
-- =============================================
CREATE TABLE public.vendor_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  step text NOT NULL DEFAULT 'inscription',
  progress_percent int DEFAULT 0,
  documents jsonb DEFAULT '{}',
  notes text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_onboarding ENABLE ROW LEVEL SECURITY;

-- =============================================
-- IMPORT JOBS
-- =============================================
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  format text NOT NULL DEFAULT 'CSV',
  rows_total int DEFAULT 0,
  rows_created int DEFAULT 0,
  rows_updated int DEFAULT 0,
  rows_errors int DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  duration_seconds int DEFAULT 0,
  column_mapping jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- INVOICES
-- =============================================
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  party_id uuid,
  party_type text NOT NULL DEFAULT 'vendor',
  type text NOT NULL DEFAULT 'commission',
  amount_ht numeric NOT NULL DEFAULT 0,
  tva_rate numeric DEFAULT 21,
  tva_amount numeric DEFAULT 0,
  amount_ttc numeric DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- =============================================
-- LEADS PARTNERS
-- =============================================
CREATE TABLE public.leads_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text,
  type text DEFAULT 'indirect',
  model lead_model DEFAULT 'CPA',
  cpa_cpc_amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  products_count int DEFAULT 0,
  clicks_30d int DEFAULT 0,
  conversions_30d int DEFAULT 0,
  revenue_30d numeric DEFAULT 0,
  top_categories text[] DEFAULT '{}',
  last_sync timestamptz DEFAULT now(),
  feed_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leads_partners ENABLE ROW LEVEL SECURITY;

-- =============================================
-- AUDIT LOGS
-- =============================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  user_role text,
  action text NOT NULL,
  detail text,
  module text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TRIGGERS for updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER offers_direct_updated_at BEFORE UPDATE ON public.offers_direct FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER vendor_onboarding_updated_at BEFORE UPDATE ON public.vendor_onboarding FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
