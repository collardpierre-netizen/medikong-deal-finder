ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS scan_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS be_pharmacy_id uuid NULL REFERENCES public.be_pharmacies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS customers_be_pharmacy_id_idx ON public.customers(be_pharmacy_id);

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS scan_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.normalize_cnk(_v text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public AS $$
  SELECT NULLIF(regexp_replace(coalesce(_v, ''), '\D', '', 'g'), '')
$$;

ALTER TABLE public.wholesaler_profiles
  ADD COLUMN IF NOT EXISTS display_prices_allowed boolean NOT NULL DEFAULT false;

ALTER TABLE public.market_prices ADD COLUMN IF NOT EXISTS period date NULL;
CREATE UNIQUE INDEX IF NOT EXISTS market_prices_source_product_period_uidx
  ON public.market_prices(source_id, product_id, period) WHERE period IS NOT NULL;

ALTER TABLE public.market_price_sources
  ADD COLUMN IF NOT EXISTS wholesaler_profile_id uuid NULL REFERENCES public.wholesaler_profiles(id) ON DELETE SET NULL;

CREATE TABLE public.wholesaler_depots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_profile_id uuid NOT NULL REFERENCES public.wholesaler_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  postal_code text,
  country_code text NOT NULL DEFAULT 'BE',
  latitude numeric,
  longitude numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wholesaler_profile_id, name)
);
GRANT SELECT ON public.wholesaler_depots TO authenticated;
GRANT ALL ON public.wholesaler_depots TO service_role;
ALTER TABLE public.wholesaler_depots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "depots read active" ON public.wholesaler_depots
  FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "depots admin manage" ON public.wholesaler_depots
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.pharmacist_wholesaler_settings
  ADD COLUMN IF NOT EXISTS customer_id uuid NULL REFERENCES public.customers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS pws_customer_id_idx ON public.pharmacist_wholesaler_settings(customer_id);

CREATE POLICY "pws_customer_members_all" ON public.pharmacist_wholesaler_settings
  FOR ALL TO authenticated
  USING (customer_id IS NOT NULL AND customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
    UNION SELECT public.current_user_buyer_account_ids()))
  WITH CHECK (customer_id IS NOT NULL AND customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
    UNION SELECT public.current_user_buyer_account_ids()));

CREATE OR REPLACE FUNCTION public.scan_list_wholesalers()
RETURNS TABLE(id uuid, slug text, display_name text, country text, discount_mechanic text,
              default_discount_pct numeric, display_prices_allowed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, slug, display_name, country, discount_mechanic, default_discount_pct, display_prices_allowed
  FROM public.wholesaler_profiles WHERE is_active AND auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.scan_list_wholesalers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.scan_list_wholesalers() TO authenticated;

CREATE TABLE public.scan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('single','burst')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT ON public.scan_sessions TO authenticated;
GRANT ALL ON public.scan_sessions TO service_role;
ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan sessions own read" ON public.scan_sessions FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
                         UNION SELECT public.current_user_buyer_account_ids()));
CREATE POLICY "scan sessions admin read" ON public.scan_sessions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE public.scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.scan_sessions(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  symbology text NOT NULL CHECK (symbology IN ('ean13','datamatrix','manual_cnk','other')),
  raw_code text NOT NULL,
  gtin text, cnk text, lot text, expiry_date date,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  match_status text NOT NULL CHECK (match_status IN ('matched','ambiguous_match','not_found')),
  candidate_product_ids uuid[] NOT NULL DEFAULT '{}',
  in_test_scope boolean NOT NULL DEFAULT false,
  result text NOT NULL CHECK (result IN ('offer','known_no_offer','unknown')),
  best_offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  best_price_excl_vat numeric,
  ref_price_excl_vat numeric,
  ref_source text,
  delta_excl_vat numeric,
  verdict text CHECK (verdict IN ('green','orange','red','none')),
  action text NOT NULL DEFAULT 'none' CHECK (action IN ('none','added_to_cart','price_alert','stock_report','sourcing_request')),
  latency_ms integer
);
CREATE INDEX scan_events_customer_scanned_idx ON public.scan_events(customer_id, scanned_at DESC);
CREATE INDEX scan_events_gtin_idx ON public.scan_events(gtin);
GRANT SELECT ON public.scan_events TO authenticated;
GRANT ALL ON public.scan_events TO service_role;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan events own read" ON public.scan_events FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
                         UNION SELECT public.current_user_buyer_account_ids()));
CREATE POLICY "scan events admin read" ON public.scan_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE public.scan_cart_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  scan_event_id uuid NOT NULL REFERENCES public.scan_events(id) ON DELETE CASCADE,
  order_line_id uuid NULL REFERENCES public.order_lines(id) ON DELETE SET NULL,
  matched_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scan_cart_attr_lookup_idx ON public.scan_cart_attributions(customer_id, offer_id, created_at DESC);
GRANT SELECT, INSERT ON public.scan_cart_attributions TO authenticated;
GRANT ALL ON public.scan_cart_attributions TO service_role;
ALTER TABLE public.scan_cart_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan attr own" ON public.scan_cart_attributions FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
                         UNION SELECT public.current_user_buyer_account_ids()));
CREATE POLICY "scan attr own insert" ON public.scan_cart_attributions FOR INSERT TO authenticated
  WITH CHECK (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
                              UNION SELECT public.current_user_buyer_account_ids())
              AND EXISTS (SELECT 1 FROM public.scan_events e WHERE e.id = scan_cart_attributions.scan_event_id AND e.customer_id = scan_cart_attributions.customer_id));
CREATE POLICY "scan attr admin read" ON public.scan_cart_attributions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public._scan_attribute_order_line()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _customer uuid;
BEGIN
  SELECT o.customer_id INTO _customer FROM public.orders o WHERE o.id = NEW.order_id;
  IF _customer IS NULL OR NEW.offer_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.scan_cart_attributions a SET order_line_id = NEW.id, matched_at = now()
  WHERE a.id = (SELECT id FROM public.scan_cart_attributions
                WHERE customer_id = _customer AND offer_id = NEW.offer_id
                  AND order_line_id IS NULL AND created_at >= now() - interval '7 days'
                ORDER BY created_at DESC LIMIT 1);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_scan_attribute_order_line AFTER INSERT ON public.order_lines
  FOR EACH ROW EXECUTE FUNCTION public._scan_attribute_order_line();

ALTER TABLE public.sourcing_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS monthly_quantity integer,
  ADD COLUMN IF NOT EXISTS current_price_excl_vat numeric,
  ADD COLUMN IF NOT EXISTS current_supplier text,
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS sourcing_item_id uuid REFERENCES public.buyer_comparator_sourcing_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scan_event_id uuid REFERENCES public.scan_events(id) ON DELETE SET NULL;

CREATE TABLE public.product_gtin_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  proposed_gtin text NOT NULL,
  source_id uuid REFERENCES public.market_price_sources(id) ON DELETE SET NULL,
  matched_cnk text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, proposed_gtin)
);
GRANT SELECT, INSERT, UPDATE ON public.product_gtin_proposals TO authenticated;
GRANT ALL ON public.product_gtin_proposals TO service_role;
ALTER TABLE public.product_gtin_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gtin proposals admin" ON public.product_gtin_proposals FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));