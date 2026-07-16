
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS is_authorized_distributor boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendors.is_authorized_distributor IS
  'Le vendeur déclare être distributeur autorisé pour les marques qu''il référence. Requis (avec mandate_signed_at) pour publier une offre active.';

CREATE TABLE IF NOT EXISTS public.vendor_brand_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  authorization_type text NOT NULL DEFAULT 'authorized_distributor',
  document_reference text,
  valid_from date,
  valid_until date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vba_vendor ON public.vendor_brand_authorizations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vba_brand  ON public.vendor_brand_authorizations(brand_id);

GRANT SELECT ON public.vendor_brand_authorizations TO anon, authenticated;
GRANT ALL    ON public.vendor_brand_authorizations TO service_role;

ALTER TABLE public.vendor_brand_authorizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vba_public_read ON public.vendor_brand_authorizations;
CREATE POLICY vba_public_read
  ON public.vendor_brand_authorizations FOR SELECT USING (true);

DROP POLICY IF EXISTS vba_admin_write ON public.vendor_brand_authorizations;
CREATE POLICY vba_admin_write
  ON public.vendor_brand_authorizations FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_vba_updated_at ON public.vendor_brand_authorizations;
CREATE TRIGGER trg_vba_updated_at
  BEFORE UPDATE ON public.vendor_brand_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP VIEW IF EXISTS public.vendors_public;
CREATE VIEW public.vendors_public
WITH (security_invoker = true) AS
SELECT id,
       slug,
       CASE
           WHEN show_real_name = true THEN COALESCE(company_name, name)
           ELSE COALESCE(NULLIF(tagline, ''::text), 'Vendeur vérifié'::text)
       END AS display_name,
       name,
       company_name,
       type,
       country_code,
       city,
       logo_url,
       cover_image_url,
       description,
       tagline,
       website,
       linkedin_url,
       facebook_url,
       instagram_url,
       twitter_url,
       youtube_url,
       is_verified,
       is_top_seller,
       rating,
       total_sales,
       display_code,
       show_real_name,
       preferred_language,
       is_authorized_distributor,
       (mandate_signed_at IS NOT NULL) AS billing_mandate_signed,
       created_at
  FROM vendors
 WHERE is_active = true;

GRANT SELECT ON public.vendors_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_offer_publication_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_auth boolean;
  v_mandate timestamptz;
BEGIN
  IF COALESCE(NEW.is_active, false) = false THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.is_active = true
     AND OLD.vendor_id IS NOT DISTINCT FROM NEW.vendor_id THEN
    RETURN NEW;
  END IF;

  SELECT name, is_authorized_distributor, mandate_signed_at
    INTO v_name, v_auth, v_mandate
    FROM public.vendors
   WHERE id = NEW.vendor_id;

  IF v_name = 'Balooh' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_auth, false) = false OR v_mandate IS NULL THEN
    RAISE EXCEPTION
      'Offre non publiable : le vendeur doit être distributeur autorisé (is_authorized_distributor) ET avoir signé le mandat de facturation (mandate_signed_at).'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offers_publication_guard ON public.offers;
CREATE TRIGGER trg_offers_publication_guard
  BEFORE INSERT OR UPDATE OF is_active, vendor_id ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_publication_guard();

CREATE OR REPLACE FUNCTION public.resolve_offer_trust(
  _offer_id uuid,
  _brand_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id uuid;
  v_vendor record;
  v_kyc boolean := false;
  v_brand_auth jsonb := NULL;
BEGIN
  SELECT vendor_id INTO v_vendor_id FROM public.offers WHERE id = _offer_id;
  IF v_vendor_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT id, display_code, name, company_name, show_real_name, country_code,
         is_authorized_distributor, mandate_signed_at, created_at
    INTO v_vendor
    FROM public.vendors
   WHERE id = v_vendor_id;

  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.vendor_kyc_submissions
       WHERE vendor_id = v_vendor_id
         AND status IN ('approved','accepted')
    ) INTO v_kyc;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_kyc := false;
  END;

  IF _brand_id IS NOT NULL THEN
    SELECT to_jsonb(vba) INTO v_brand_auth
      FROM public.vendor_brand_authorizations vba
     WHERE vba.vendor_id = v_vendor_id
       AND (vba.brand_id = _brand_id OR vba.brand_id IS NULL)
       AND (vba.valid_from IS NULL OR vba.valid_from <= CURRENT_DATE)
       AND (vba.valid_until IS NULL OR vba.valid_until >= CURRENT_DATE)
     ORDER BY (vba.brand_id = _brand_id) DESC NULLS LAST,
              vba.valid_until DESC NULLS LAST
     LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'vendor_id', v_vendor.id,
    'display_code', v_vendor.display_code,
    'name', v_vendor.name,
    'company_name', v_vendor.company_name,
    'show_real_name', v_vendor.show_real_name,
    'country_code', v_vendor.country_code,
    'is_authorized_distributor', COALESCE(v_vendor.is_authorized_distributor, false),
    'billing_mandate_signed', (v_vendor.mandate_signed_at IS NOT NULL),
    'mandate_signed_at', v_vendor.mandate_signed_at,
    'is_kyc_verified', COALESCE(v_kyc, false),
    'vendor_since', v_vendor.created_at,
    'brand_authorization', v_brand_auth,
    'guarantee_label', 'Garantie légale européenne de conformité — 2 ans'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_offer_trust(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_offer_trust(uuid, uuid) TO anon, authenticated, service_role;
