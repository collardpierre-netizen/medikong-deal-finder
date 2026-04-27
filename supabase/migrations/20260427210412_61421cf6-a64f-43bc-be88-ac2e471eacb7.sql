-- Table singleton du token bucket
CREATE TABLE IF NOT EXISTS public.qogita_rate_limit (
  key TEXT PRIMARY KEY,
  capacity INTEGER NOT NULL DEFAULT 2000,
  refill_per_minute INTEGER NOT NULL DEFAULT 200,
  available_tokens NUMERIC NOT NULL DEFAULT 2000,
  last_refill_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.qogita_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read qogita_rate_limit"
ON public.qogita_rate_limit FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role manages qogita_rate_limit"
ON public.qogita_rate_limit FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Bucket global par défaut
INSERT INTO public.qogita_rate_limit (key, capacity, refill_per_minute, available_tokens)
VALUES ('global', 2000, 200, 2000)
ON CONFLICT (key) DO NOTHING;

-- RPC : consommer N tokens (refill paresseux)
CREATE OR REPLACE FUNCTION public.consume_qogita_tokens(_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.qogita_rate_limit%ROWTYPE;
  v_elapsed_minutes numeric;
  v_refill numeric;
  v_new_available numeric;
  v_allowed boolean := false;
BEGIN
  -- Lock la ligne le temps de la transaction
  SELECT * INTO v_row FROM public.qogita_rate_limit WHERE key = 'global' FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.qogita_rate_limit (key) VALUES ('global')
    ON CONFLICT DO NOTHING;
    SELECT * INTO v_row FROM public.qogita_rate_limit WHERE key = 'global' FOR UPDATE;
  END IF;

  -- Refill paresseux
  v_elapsed_minutes := EXTRACT(EPOCH FROM (now() - v_row.last_refill_at)) / 60.0;
  v_refill := v_elapsed_minutes * v_row.refill_per_minute;
  v_new_available := LEAST(v_row.available_tokens + v_refill, v_row.capacity);

  -- Tentative de consommation
  IF v_new_available >= _amount THEN
    v_new_available := v_new_available - _amount;
    v_allowed := true;
  END IF;

  UPDATE public.qogita_rate_limit
  SET available_tokens = v_new_available,
      last_refill_at = now(),
      updated_at = now()
  WHERE key = 'global';

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'available', FLOOR(v_new_available)::int,
    'capacity', v_row.capacity,
    'requested', _amount
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_qogita_tokens(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_qogita_tokens(integer) TO service_role;

-- RPC : enqueue un mini-batch (priorité muets puis stale)
CREATE OR REPLACE FUNCTION public.enqueue_qogita_resync_batch(
  _batch_size integer DEFAULT 500,
  _mode public.qogita_resync_mode DEFAULT 'daily_stale_refresh'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota jsonb;
  v_log_id uuid;
  v_mute_count integer := 0;
  v_stale_count integer := 0;
  v_remaining integer;
BEGIN
  -- 1) Demande de tokens au bucket
  v_quota := public.consume_qogita_tokens(_batch_size);
  IF NOT (v_quota->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'enqueued', 0,
      'rate_limited', true,
      'available', v_quota->>'available',
      'requested', _batch_size
    );
  END IF;

  -- 2) Création du log de run
  INSERT INTO public.qogita_resync_logs (mode, status, triggered_by, country_code, products_targeted)
  VALUES (_mode, 'running', 'cron-batch', 'BE', _batch_size)
  RETURNING id INTO v_log_id;

  -- 3) Phase prioritaire : produits muets (max 60% du batch)
  v_remaining := GREATEST((_batch_size * 6 / 10)::int, 1);
  WITH mute_batch AS (
    SELECT DISTINCT p.id
    FROM products p
    WHERE p.qogita_qid IS NOT NULL
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
  )
  UPDATE products p
  SET synced_at = NULL
  FROM mute_batch mb
  WHERE p.id = mb.id;
  GET DIAGNOSTICS v_mute_count = ROW_COUNT;

  -- 4) Backlog stale pour compléter
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
    )
    UPDATE products p
    SET synced_at = NULL
    FROM stale_batch sb
    WHERE p.id = sb.id;
    GET DIAGNOSTICS v_stale_count = ROW_COUNT;
  END IF;

  -- 5) Met à jour le log avec ce qui a réellement été enqueue
  UPDATE public.qogita_resync_logs
  SET products_targeted = v_mute_count + v_stale_count,
      mute_products_detected = v_mute_count,
      metadata = jsonb_build_object(
        'mute_products_queued', v_mute_count,
        'stale_products_queued', v_stale_count,
        'rate_limit_quota', v_quota
      )
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'enqueued', v_mute_count + v_stale_count,
    'mute', v_mute_count,
    'stale', v_stale_count,
    'rate_limited', false,
    'log_id', v_log_id,
    'quota', v_quota
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_qogita_resync_batch(integer, public.qogita_resync_mode) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_qogita_resync_batch(integer, public.qogita_resync_mode) TO service_role;