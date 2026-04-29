-- =========================================================================
-- Module Catalogue & Offres vendeurs — Fondations DB
-- =========================================================================

-- 1. Helper : current_vendor_id()
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_vendor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.vendors
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

-- 2. Référentiel des profils acheteur
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buyer_profiles (
  id text PRIMARY KEY,
  label text NOT NULL,
  description text,
  display_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.buyer_profiles (id, label, display_order) VALUES
  ('pharmacie_independante', 'Pharmacie indépendante', 1),
  ('groupement',             'Pharmacie en groupement', 2),
  ('hopital',                'Hôpital / établissement de soins', 3),
  ('autre',                  'Autre professionnel de santé', 4)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.buyer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyer_profiles_read_authenticated" ON public.buyer_profiles;
CREATE POLICY "buyer_profiles_read_authenticated"
  ON public.buyer_profiles FOR SELECT
  TO authenticated
  USING (true);

-- 3. Extensions products / brands / manufacturers : cycle de vie soumission
-- -----------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.catalog_submission_status AS ENUM (
    'active', 'pending_review', 'rejected', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS submission_status public.catalog_submission_status DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS proposed_by_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submission_approved_by uuid,
  ADD COLUMN IF NOT EXISTS submission_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS submission_rejected_reason text;

CREATE INDEX IF NOT EXISTS idx_products_submission_status
  ON public.products(submission_status)
  WHERE submission_status <> 'active';

CREATE INDEX IF NOT EXISTS idx_products_proposed_by_vendor
  ON public.products(proposed_by_vendor_id)
  WHERE proposed_by_vendor_id IS NOT NULL;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS submission_status public.catalog_submission_status DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS proposed_by_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submission_approved_by uuid,
  ADD COLUMN IF NOT EXISTS submission_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS submission_rejected_reason text;

CREATE INDEX IF NOT EXISTS idx_brands_submission_status
  ON public.brands(submission_status)
  WHERE submission_status <> 'active';

ALTER TABLE public.manufacturers
  ADD COLUMN IF NOT EXISTS submission_status public.catalog_submission_status DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS proposed_by_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submission_approved_by uuid,
  ADD COLUMN IF NOT EXISTS submission_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS submission_rejected_reason text;

CREATE INDEX IF NOT EXISTS idx_manufacturers_submission_status
  ON public.manufacturers(submission_status)
  WHERE submission_status <> 'active';

-- 4. Campagnes d'offres vendeur
-- -----------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.vendor_offer_campaign_source AS ENUM (
    'catalog_pick', 'xlsx_upload', 'manual', 'mixed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.vendor_offer_campaign_status AS ENUM (
    'draft', 'pending_validation', 'active', 'paused', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.vendor_offer_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_mode public.vendor_offer_campaign_source NOT NULL,
  status public.vendor_offer_campaign_status NOT NULL DEFAULT 'draft',
  default_currency text NOT NULL DEFAULT 'EUR',
  default_vat_rate numeric(5,2),
  default_lead_time_days int,
  default_zones text[],
  global_mov_cents bigint,
  imported_brand_ids uuid[],
  imported_manufacturer_ids uuid[],
  xlsx_source_url text,
  notes text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_offer_campaigns_vendor
  ON public.vendor_offer_campaigns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_offer_campaigns_status
  ON public.vendor_offer_campaigns(status);

DROP TRIGGER IF EXISTS trg_vendor_offer_campaigns_updated_at ON public.vendor_offer_campaigns;
CREATE TRIGGER trg_vendor_offer_campaigns_updated_at
  BEFORE UPDATE ON public.vendor_offer_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vendor_offer_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voc_vendor_select_own" ON public.vendor_offer_campaigns;
CREATE POLICY "voc_vendor_select_own"
  ON public.vendor_offer_campaigns FOR SELECT
  TO authenticated
  USING (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "voc_vendor_insert_own" ON public.vendor_offer_campaigns;
CREATE POLICY "voc_vendor_insert_own"
  ON public.vendor_offer_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "voc_vendor_update_own" ON public.vendor_offer_campaigns;
CREATE POLICY "voc_vendor_update_own"
  ON public.vendor_offer_campaigns FOR UPDATE
  TO authenticated
  USING (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "voc_vendor_delete_own" ON public.vendor_offer_campaigns;
CREATE POLICY "voc_vendor_delete_own"
  ON public.vendor_offer_campaigns FOR DELETE
  TO authenticated
  USING (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.vendor_offer_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_offers_campaign
  ON public.offers(campaign_id)
  WHERE campaign_id IS NOT NULL;

-- 5. Prix HTVA par profil acheteur (par offre)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offer_buyer_profile_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  buyer_profile_id text NOT NULL REFERENCES public.buyer_profiles(id),
  price_excl_vat numeric(12,4) NOT NULL CHECK (price_excl_vat >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, buyer_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_obpp_offer ON public.offer_buyer_profile_prices(offer_id);

DROP TRIGGER IF EXISTS trg_obpp_updated_at ON public.offer_buyer_profile_prices;
CREATE TRIGGER trg_obpp_updated_at
  BEFORE UPDATE ON public.offer_buyer_profile_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.offer_buyer_profile_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obpp_vendor_select_own" ON public.offer_buyer_profile_prices;
CREATE POLICY "obpp_vendor_select_own"
  ON public.offer_buyer_profile_prices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_id
        AND (o.vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "obpp_vendor_write_own" ON public.offer_buyer_profile_prices;
CREATE POLICY "obpp_vendor_write_own"
  ON public.offer_buyer_profile_prices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_id
        AND (o.vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_id
        AND (o.vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()))
    )
  );

-- 6. Soumissions produit
-- -----------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.product_submission_status AS ENUM (
    'submitted', 'in_review', 'approved', 'rejected', 'needs_changes'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.product_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.vendor_offer_campaigns(id) ON DELETE SET NULL,
  proposed_payload jsonb NOT NULL,
  status public.product_submission_status NOT NULL DEFAULT 'submitted',
  resulting_manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  resulting_brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  resulting_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_submissions_vendor
  ON public.product_submissions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_product_submissions_status
  ON public.product_submissions(status);
CREATE INDEX IF NOT EXISTS idx_product_submissions_campaign
  ON public.product_submissions(campaign_id)
  WHERE campaign_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_product_submissions_updated_at ON public.product_submissions;
CREATE TRIGGER trg_product_submissions_updated_at
  BEFORE UPDATE ON public.product_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.product_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ps_vendor_select_own" ON public.product_submissions;
CREATE POLICY "ps_vendor_select_own"
  ON public.product_submissions FOR SELECT
  TO authenticated
  USING (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "ps_vendor_insert_own" ON public.product_submissions;
CREATE POLICY "ps_vendor_insert_own"
  ON public.product_submissions FOR INSERT
  TO authenticated
  WITH CHECK (vendor_id = public.current_vendor_id());

DROP POLICY IF EXISTS "ps_vendor_update_own_pending" ON public.product_submissions;
CREATE POLICY "ps_vendor_update_own_pending"
  ON public.product_submissions FOR UPDATE
  TO authenticated
  USING (
    (vendor_id = public.current_vendor_id() AND status IN ('submitted', 'needs_changes'))
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "ps_admin_delete" ON public.product_submissions;
CREATE POLICY "ps_admin_delete"
  ON public.product_submissions FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 7. Centres d'intérêt vendeur
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_catalog_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  notify_new_product boolean NOT NULL DEFAULT true,
  notify_new_brand boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    manufacturer_id IS NOT NULL
    OR brand_id IS NOT NULL
    OR category_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vci_vendor_manufacturer
  ON public.vendor_catalog_interests(vendor_id, manufacturer_id)
  WHERE manufacturer_id IS NOT NULL AND brand_id IS NULL AND category_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vci_vendor_brand
  ON public.vendor_catalog_interests(vendor_id, brand_id)
  WHERE brand_id IS NOT NULL AND manufacturer_id IS NULL AND category_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vci_vendor_category
  ON public.vendor_catalog_interests(vendor_id, category_id)
  WHERE category_id IS NOT NULL AND manufacturer_id IS NULL AND brand_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_vci_vendor ON public.vendor_catalog_interests(vendor_id);

ALTER TABLE public.vendor_catalog_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vci_vendor_select_own" ON public.vendor_catalog_interests;
CREATE POLICY "vci_vendor_select_own"
  ON public.vendor_catalog_interests FOR SELECT
  TO authenticated
  USING (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "vci_vendor_write_own" ON public.vendor_catalog_interests;
CREATE POLICY "vci_vendor_write_own"
  ON public.vendor_catalog_interests FOR ALL
  TO authenticated
  USING (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()))
  WITH CHECK (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));

-- 8. Notifications vendeur
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  payload jsonb DEFAULT '{}'::jsonb,
  cta_url text,
  email_sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vn_vendor ON public.vendor_notifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vn_vendor_unread
  ON public.vendor_notifications(vendor_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vn_type ON public.vendor_notifications(type);

ALTER TABLE public.vendor_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vn_vendor_select_own" ON public.vendor_notifications;
CREATE POLICY "vn_vendor_select_own"
  ON public.vendor_notifications FOR SELECT
  TO authenticated
  USING (vendor_id = public.current_vendor_id() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "vn_vendor_update_own" ON public.vendor_notifications;
CREATE POLICY "vn_vendor_update_own"
  ON public.vendor_notifications FOR UPDATE
  TO authenticated
  USING (vendor_id = public.current_vendor_id())
  WITH CHECK (vendor_id = public.current_vendor_id());

DROP POLICY IF EXISTS "vn_admin_insert" ON public.vendor_notifications;
CREATE POLICY "vn_admin_insert"
  ON public.vendor_notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "vn_admin_delete" ON public.vendor_notifications;
CREATE POLICY "vn_admin_delete"
  ON public.vendor_notifications FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));