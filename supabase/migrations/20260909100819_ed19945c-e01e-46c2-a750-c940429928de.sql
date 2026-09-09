ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS qogita_auto_deactivated_at timestamptz;

COMMENT ON COLUMN public.products.qogita_auto_deactivated_at IS
  'Horodatage de désactivation automatique (aucune offre acheteur Qogita au refresh). Non NULL = candidat au repêchage automatique : le sync qogita-offers-api re-teste ces produits et les réactive dès qu''une offre valide revient.';

CREATE INDEX IF NOT EXISTS idx_products_qogita_auto_deactivated
  ON public.products (qogita_auto_deactivated_at)
  WHERE qogita_auto_deactivated_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.deactivate_dead_legacy_qogita_products(_limit integer DEFAULT 1000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_offers integer := 0;
  v_products integer := 0;
  v_logged integer := 0;
BEGIN
  IF NOT (
    current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR coalesce(public.is_admin(), false)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT array_agg(id) INTO v_ids
  FROM (
    SELECT p.id
    FROM public.products p
    WHERE p.is_active = true
      AND p.mv_last_probed_at > now() - interval '4 days'
      AND EXISTS (
        SELECT 1 FROM public.offers o
        JOIN public.vendors v ON v.id = o.vendor_id
        WHERE o.product_id = p.id AND o.is_active = true AND v.type = 'qogita'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.offers o2
        JOIN public.vendors v2 ON v2.id = o2.vendor_id
        WHERE o2.product_id = p.id AND o2.is_active = true AND v2.type = 'qogita_virtual'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.qogita_price_write_anomalies a
        WHERE a.product_id = p.id AND a.created_at > now() - interval '4 days'
      )
    ORDER BY p.id
    LIMIT greatest(_limit, 0)
  ) s;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('products_deactivated', 0, 'offers_deactivated', 0, 'logged', 0);
  END IF;

  WITH tgt AS (
    SELECT o.id, o.product_id
    FROM public.offers o
    JOIN public.vendors v ON v.id = o.vendor_id
    WHERE o.product_id = ANY(v_ids) AND o.is_active = true AND v.type = 'qogita'
  ), ins AS (
    INSERT INTO public.offer_data_quality_logs (product_id, offer_id, issue_code, details)
    SELECT t.product_id, t.id, 'legacy_qogita_no_buyer_offer_deactivated',
           jsonb_build_object(
             'reason', 'plus d''offre acheteur Qogita, confirmé au refresh',
             'deactivated_at', now(),
             'reversible', true
           )
    FROM tgt t
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM tgt), (SELECT count(*) FROM ins) INTO v_offers, v_logged;

  UPDATE public.offers o
  SET is_active = false, updated_at = now()
  WHERE o.id IN (
    SELECT o2.id FROM public.offers o2
    JOIN public.vendors v2 ON v2.id = o2.vendor_id
    WHERE o2.product_id = ANY(v_ids) AND o2.is_active = true AND v2.type = 'qogita'
  );

  UPDATE public.products p
  SET is_active = false,
      qogita_auto_deactivated_at = now(),
      updated_at = now()
  WHERE p.id = ANY(v_ids) AND p.is_active = true;
  GET DIAGNOSTICS v_products = ROW_COUNT;

  RETURN jsonb_build_object(
    'products_deactivated', v_products,
    'offers_deactivated', v_offers,
    'logged', v_logged
  );
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_dead_legacy_qogita_products(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_dead_legacy_qogita_products(integer) TO service_role;