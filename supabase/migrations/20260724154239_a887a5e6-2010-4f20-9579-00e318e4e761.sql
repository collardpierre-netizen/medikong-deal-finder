-- 1) products.mv_last_probed_at : timestamp de la dernière tentative /offers/
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS mv_last_probed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_mv_last_probed_at
  ON public.products (mv_last_probed_at)
  WHERE qogita_qid IS NOT NULL;

-- 2) offers.price_stale : flag "prix indicatif — non vérifié"
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS price_stale BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_stale_since TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_offers_price_stale
  ON public.offers (price_stale)
  WHERE price_stale = true;

-- 3) enqueue_qogita_resync_batch : exclure produits probés < 7 jours du hot loop
CREATE OR REPLACE FUNCTION public.enqueue_qogita_resync_batch(
  _batch_size integer DEFAULT 500,
  _mode qogita_resync_mode DEFAULT 'daily_stale_refresh'::qogita_resync_mode
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quota jsonb;
  v_log_id uuid;
  v_mute_count integer := 0;
  v_stale_count integer := 0;
  v_remaining integer;
  v_mute_ids uuid[] := ARRAY[]::uuid[];
  v_stale_ids uuid[] := ARRAY[]::uuid[];
  v_product_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  v_quota := public.consume_qogita_tokens(_batch_size);
  IF NOT (v_quota->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'enqueued', 0,
      'rate_limited', true,
      'available', v_quota->>'available',
      'requested', _batch_size,
      'product_ids', jsonb_build_array()
    );
  END IF;

  INSERT INTO public.qogita_resync_logs (mode, status, triggered_by, country_code, products_targeted)
  VALUES (_mode, 'running', 'cron-batch', 'BE', _batch_size)
  RETURNING id INTO v_log_id;

  v_remaining := GREATEST((_batch_size * 6 / 10)::int, 1);
  WITH mute_batch AS (
    SELECT DISTINCT p.id
    FROM products p
    WHERE p.qogita_qid IS NOT NULL
      -- P0 damage control : ne pas retaper un produit probé récemment (endpoint mort)
      AND (p.mv_last_probed_at IS NULL OR p.mv_last_probed_at < now() - interval '7 days')
      AND EXISTS (
        SELECT 1 FROM offers o
        WHERE o.product_id = p.id
          AND o.is_qogita_backed = true
          AND o.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM offer_price_tiers t
            WHERE t.offer_id = o.id AND t.tier_index > 0
          )
      )
    ORDER BY p.id
    LIMIT v_remaining
  ), updated AS (
    UPDATE products p
    SET synced_at = NULL
    FROM mute_batch mb
    WHERE p.id = mb.id
    RETURNING p.id
  )
  SELECT count(*)::integer, COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_mute_count, v_mute_ids
  FROM updated;

  v_remaining := _batch_size - v_mute_count;
  IF v_remaining > 0 THEN
    WITH stale_batch AS (
      SELECT p.id
      FROM products p
      WHERE p.synced_at IS NOT NULL
        AND p.synced_at < now() - interval '24 hours'
        AND p.qogita_qid IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM offers o
          WHERE o.product_id = p.id
            AND o.is_qogita_backed = true
            AND o.is_active = true
        )
      ORDER BY p.synced_at ASC
      LIMIT v_remaining
    ), updated AS (
      UPDATE products p
      SET synced_at = NULL
      FROM stale_batch sb
      WHERE p.id = sb.id
      RETURNING p.id
    )
    SELECT count(*)::integer, COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_stale_count, v_stale_ids
    FROM updated;
  END IF;

  v_product_ids := v_mute_ids || v_stale_ids;

  UPDATE public.qogita_resync_logs
  SET products_targeted = v_mute_count + v_stale_count,
      mute_products_detected = v_mute_count,
      metadata = jsonb_build_object(
        'mute_products_queued', v_mute_count,
        'stale_products_queued', v_stale_count,
        'product_ids', to_jsonb(v_product_ids),
        'rate_limit_quota', v_quota
      )
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'enqueued', v_mute_count + v_stale_count,
    'mute', v_mute_count,
    'stale', v_stale_count,
    'rate_limited', false,
    'log_id', v_log_id,
    'product_ids', to_jsonb(v_product_ids),
    'quota', v_quota
  );
END;
$function$;