CREATE TABLE public.scan_field_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  wholesaler_profile_id uuid NOT NULL REFERENCES public.wholesaler_profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('confirm','unavailable','price')),
  price_excl_vat_cents integer CHECK (price_excl_vat_cents IS NULL OR (price_excl_vat_cents > 0 AND price_excl_vat_cents <= 10000000)),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('info','pending','validated','rejected')),
  validated_via text CHECK (validated_via IN ('consensus','admin')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'price') = (price_excl_vat_cents IS NOT NULL))
);
CREATE INDEX ON public.scan_field_reports (product_id, wholesaler_profile_id, created_at DESC);
CREATE INDEX ON public.scan_field_reports (customer_id, product_id, wholesaler_profile_id, created_at DESC);
CREATE INDEX ON public.scan_field_reports (status) WHERE status = 'pending';
GRANT SELECT ON public.scan_field_reports TO authenticated;
GRANT ALL ON public.scan_field_reports TO service_role;
ALTER TABLE public.scan_field_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pharmacy members read own field reports" ON public.scan_field_reports
FOR SELECT TO authenticated USING (customer_id IN (
  SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
  UNION SELECT x FROM public.current_user_buyer_account_ids() x));
CREATE POLICY "Admins read field reports" ON public.scan_field_reports
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Prix issus des signalements : séparés des prix officiels, jamais écrasés.
CREATE TABLE public.scan_field_report_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  wholesaler_profile_id uuid NOT NULL REFERENCES public.wholesaler_profiles(id) ON DELETE CASCADE,
  price_excl_vat_cents integer NOT NULL CHECK (price_excl_vat_cents > 0),
  validated_via text NOT NULL CHECK (validated_via IN ('consensus','admin')),
  report_ids uuid[] NOT NULL,
  validated_by uuid,
  validated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.scan_field_report_prices (product_id, wholesaler_profile_id, validated_at DESC);
GRANT SELECT ON public.scan_field_report_prices TO authenticated;
GRANT ALL ON public.scan_field_report_prices TO service_role;
ALTER TABLE public.scan_field_report_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read field report prices" ON public.scan_field_report_prices
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public._scan_current_customer()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id FROM public.customers c
  WHERE c.scan_enabled = true
    AND (c.auth_user_id = auth.uid() OR c.id IN (SELECT x FROM public.current_user_buyer_account_ids() x))
  ORDER BY (c.auth_user_id = auth.uid()) DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._scan_current_customer() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.scan_submit_field_report(_product_id uuid, _wholesaler_profile_id uuid, _kind text, _price_excl_vat_cents integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_customer uuid;
  v_id uuid;
  v_twin record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _kind NOT IN ('confirm','unavailable','price') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
  IF _kind = 'price' AND (_price_excl_vat_cents IS NULL OR _price_excl_vat_cents <= 0 OR _price_excl_vat_cents > 10000000) THEN RAISE EXCEPTION 'invalid_price'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.site_config sc WHERE sc.id = 1 AND sc.scan_enabled = true) THEN RAISE EXCEPTION 'scan_disabled'; END IF;
  v_customer := public._scan_current_customer();
  IF v_customer IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id) OR NOT EXISTS (SELECT 1 FROM public.wholesaler_profiles WHERE id = _wholesaler_profile_id) THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;
  -- Anti-abus : un signalement par officine, produit et grossiste par 24 h.
  IF EXISTS (SELECT 1 FROM public.scan_field_reports r WHERE r.customer_id = v_customer AND r.product_id = _product_id
             AND r.wholesaler_profile_id = _wholesaler_profile_id AND r.created_at > now() - interval '24 hours') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_reported_24h');
  END IF;

  INSERT INTO public.scan_field_reports (customer_id, user_id, product_id, wholesaler_profile_id, kind, price_excl_vat_cents, status)
  VALUES (v_customer, v_user, _product_id, _wholesaler_profile_id, _kind,
          CASE WHEN _kind = 'price' THEN _price_excl_vat_cents END,
          CASE WHEN _kind = 'confirm' THEN 'info' ELSE 'pending' END)
  RETURNING id INTO v_id;

  -- Consensus : 2 officines différentes, écart ≤ 2 %, sous 14 jours.
  IF _kind = 'price' THEN
    SELECT r.id, r.price_excl_vat_cents INTO v_twin FROM public.scan_field_reports r
    WHERE r.kind = 'price' AND r.status = 'pending' AND r.product_id = _product_id
      AND r.wholesaler_profile_id = _wholesaler_profile_id AND r.customer_id <> v_customer
      AND r.created_at > now() - interval '14 days'
      AND abs(r.price_excl_vat_cents - _price_excl_vat_cents)::numeric / GREATEST(r.price_excl_vat_cents, _price_excl_vat_cents) <= 0.02
    ORDER BY r.created_at DESC LIMIT 1;
    IF v_twin.id IS NOT NULL THEN
      UPDATE public.scan_field_reports SET status = 'validated', validated_via = 'consensus', reviewed_at = now()
      WHERE id IN (v_id, v_twin.id);
      INSERT INTO public.scan_field_report_prices (product_id, wholesaler_profile_id, price_excl_vat_cents, validated_via, report_ids)
      VALUES (_product_id, _wholesaler_profile_id, round((v_twin.price_excl_vat_cents + _price_excl_vat_cents) / 2.0)::integer, 'consensus', ARRAY[v_twin.id, v_id]);
    END IF;
  ELSIF _kind = 'unavailable' THEN
    IF EXISTS (SELECT 1 FROM public.scan_field_reports r WHERE r.kind = 'unavailable' AND r.status = 'pending'
               AND r.product_id = _product_id AND r.wholesaler_profile_id = _wholesaler_profile_id
               AND r.customer_id <> v_customer AND r.created_at > now() - interval '14 days') THEN
      UPDATE public.scan_field_reports SET status = 'validated', validated_via = 'consensus', reviewed_at = now()
      WHERE kind = 'unavailable' AND status = 'pending' AND product_id = _product_id
        AND wholesaler_profile_id = _wholesaler_profile_id AND created_at > now() - interval '14 days';
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;
REVOKE ALL ON FUNCTION public.scan_submit_field_report(uuid, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_submit_field_report(uuid, uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_field_report(_report_id uuid, _approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.scan_field_reports%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.scan_field_reports WHERE id = _report_id FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
  UPDATE public.scan_field_reports
  SET status = CASE WHEN _approve THEN 'validated' ELSE 'rejected' END,
      validated_via = CASE WHEN _approve THEN 'admin' END,
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = r.id;
  IF _approve AND r.kind = 'price' THEN
    INSERT INTO public.scan_field_report_prices (product_id, wholesaler_profile_id, price_excl_vat_cents, validated_via, report_ids, validated_by)
    VALUES (r.product_id, r.wholesaler_profile_id, r.price_excl_vat_cents, 'admin', ARRAY[r.id], auth.uid());
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.admin_review_field_report(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_field_report(uuid, boolean) TO authenticated;

-- Résumé anonyme par grossiste pour un produit (aucune officine identifiée).
CREATE OR REPLACE FUNCTION public.scan_field_report_summary(_product_id uuid)
RETURNS TABLE(wholesaler_profile_id uuid, last_confirmed_at timestamptz, unavailable_pharmacies integer, validated_price_cents integer, validated_price_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id,
    (SELECT max(r.created_at) FROM public.scan_field_reports r WHERE r.product_id = _product_id AND r.wholesaler_profile_id = w.id AND r.kind = 'confirm'),
    (SELECT count(DISTINCT r.customer_id)::int FROM public.scan_field_reports r WHERE r.product_id = _product_id AND r.wholesaler_profile_id = w.id
       AND r.kind = 'unavailable' AND r.status IN ('pending','validated') AND r.created_at > now() - interval '14 days'),
    p.price_excl_vat_cents, p.validated_at
  FROM public.wholesaler_profiles w
  LEFT JOIN LATERAL (SELECT fp.price_excl_vat_cents, fp.validated_at FROM public.scan_field_report_prices fp
    WHERE fp.product_id = _product_id AND fp.wholesaler_profile_id = w.id ORDER BY fp.validated_at DESC LIMIT 1) p ON true
  WHERE public._scan_current_customer() IS NOT NULL OR public.is_admin(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.scan_field_report_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_field_report_summary(uuid) TO authenticated;

-- Compteur Sentinelle : signalements VALIDÉS uniquement.
CREATE OR REPLACE FUNCTION public.admin_field_report_sentinel_counts()
RETURNS TABLE(customer_id uuid, customer_name text, validated_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, COALESCE(c.company_name, c.id::text), count(*)::int
  FROM public.scan_field_reports r JOIN public.customers c ON c.id = r.customer_id
  WHERE r.status = 'validated' AND public.is_admin(auth.uid()) AND COALESCE(c.is_test, false) = false
  GROUP BY c.id, c.company_name ORDER BY 3 DESC
$$;
REVOKE ALL ON FUNCTION public.admin_field_report_sentinel_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_field_report_sentinel_counts() TO authenticated;