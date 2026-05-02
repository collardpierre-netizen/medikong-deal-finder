CREATE OR REPLACE FUNCTION public.extract_pack_size_from_name_sql(_name text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cleaned text;
  m text[];
  n integer;
  prev_token text;
BEGIN
  IF _name IS NULL THEN RETURN NULL; END IF;
  cleaned := btrim(_name);
  IF cleaned = '' THEN RETURN NULL; END IF;

  m := regexp_match(cleaned, '(?:^|\s)\/\s*(\d{1,3})\s*$');
  IF m IS NOT NULL THEN
    n := m[1]::int;
    IF n >= 2 AND n <= 500 THEN RETURN n; END IF;
  END IF;

  m := regexp_match(cleaned, '(?:^|\s)([A-Za-zÀ-ÿ./]+)\s+(\d{1,3})\s*$');
  IF m IS NOT NULL THEN
    prev_token := lower(regexp_replace(m[1], '\.$', ''));
    n := m[2]::int;
    IF prev_token !~ '^(mg|ml|g|kg|cl|l|kcal|cc|oz|mcg|µg|ug|ui|iu|mm|cm|m|%)$'
       AND n >= 2 AND n <= 50 THEN
      RETURN n;
    END IF;
  END IF;

  m := regexp_match(cleaned, '\m(\d{1,3})\s*[x×]\s*\d+(?:[.,]\d+)?\s*(ml|cl|l|g|mg|kg|cc)\M', 'i');
  IF m IS NOT NULL THEN
    n := m[1]::int;
    IF n >= 2 AND n <= 500 THEN RETURN n; END IF;
  END IF;

  m := regexp_match(cleaned, '\m(\d{1,4})\s*(caps?|capsules?|cps|comprim[eé]s?|cpr?|g[eé]lules?|sachets?|sticks?|ampoules?|doses?|tabl(?:ettes)?|pastilles?|suppositoires?|ovules?|lingettes?|pi[èe]ces?|pcs?)\M', 'i');
  IF m IS NOT NULL THEN
    n := m[1]::int;
    IF n >= 2 AND n <= 1000 THEN RETURN n; END IF;
  END IF;

  m := regexp_match(cleaned, '\m(?:bo[iî]te|pack|lot|paquet|box|set)\s*(?:de|d[''’]|of)\s*(\d{1,4})\M', 'i');
  IF m IS NOT NULL THEN
    n := m[1]::int;
    IF n >= 2 AND n <= 1000 THEN RETURN n; END IF;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.extract_pack_size_from_name_sql(text) IS
'Équivalent SQL de src/lib/pack-size.ts:extractPackSizeFromName. Cf. mem://regles-metier/cerp-pack-suffix-convention.';

CREATE TABLE IF NOT EXISTS public.market_price_pack_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.market_price_sources(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ean text,
  cnk text,
  last_pack_size integer,
  last_raw_title text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mppach_source_ean
  ON public.market_price_pack_history(source_id, ean) WHERE ean IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mppach_source_cnk
  ON public.market_price_pack_history(source_id, cnk) WHERE cnk IS NOT NULL AND ean IS NULL;

ALTER TABLE public.market_price_pack_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read pack history" ON public.market_price_pack_history;
CREATE POLICY "Admins read pack history"
  ON public.market_price_pack_history FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage pack history" ON public.market_price_pack_history;
CREATE POLICY "Admins manage pack history"
  ON public.market_price_pack_history FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.market_price_pack_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.market_price_sources(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ean text,
  cnk text,
  previous_pack_size integer,
  current_pack_size integer,
  pack_ratio numeric,
  previous_raw_title text,
  current_raw_title text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','false_positive','resolved')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mppa_status ON public.market_price_pack_anomalies(status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_mppa_source ON public.market_price_pack_anomalies(source_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_mppa_product ON public.market_price_pack_anomalies(product_id) WHERE product_id IS NOT NULL;

ALTER TABLE public.market_price_pack_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read pack anomalies" ON public.market_price_pack_anomalies;
CREATE POLICY "Admins read pack anomalies"
  ON public.market_price_pack_anomalies FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage pack anomalies" ON public.market_price_pack_anomalies;
CREATE POLICY "Admins manage pack anomalies"
  ON public.market_price_pack_anomalies FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.detect_market_price_pack_anomalies(_source_id_filter uuid DEFAULT NULL)
RETURNS TABLE(anomalies_created integer, history_rows_updated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anomalies integer := 0;
  v_history integer := 0;
  rec record;
  v_prev_pack integer;
  v_prev_title text;
  v_prev_id uuid;
  v_ratio numeric;
  v_existing_open uuid;
BEGIN
  FOR rec IN
    SELECT DISTINCT ON (mp.source_id, COALESCE(mp.ean, '∅'), COALESCE(mp.cnk, '∅'))
      mp.source_id,
      mp.product_id,
      mp.ean,
      mp.cnk,
      mp.product_name_source,
      mp.imported_at,
      public.extract_pack_size_from_name_sql(mp.product_name_source) AS current_pack
    FROM public.market_prices mp
    WHERE (_source_id_filter IS NULL OR mp.source_id = _source_id_filter)
      AND mp.product_name_source IS NOT NULL
      AND (mp.ean IS NOT NULL OR mp.cnk IS NOT NULL)
    ORDER BY mp.source_id, COALESCE(mp.ean, '∅'), COALESCE(mp.cnk, '∅'), mp.imported_at DESC
  LOOP
    v_prev_pack := NULL; v_prev_title := NULL; v_prev_id := NULL; v_existing_open := NULL;

    SELECT id, last_pack_size, last_raw_title
      INTO v_prev_id, v_prev_pack, v_prev_title
    FROM public.market_price_pack_history h
    WHERE h.source_id = rec.source_id
      AND (
        (rec.ean IS NOT NULL AND h.ean = rec.ean)
        OR (rec.ean IS NULL AND rec.cnk IS NOT NULL AND h.cnk = rec.cnk AND h.ean IS NULL)
      )
    LIMIT 1;

    IF v_prev_pack IS NOT NULL AND rec.current_pack IS NOT NULL AND v_prev_pack <> rec.current_pack THEN
      v_ratio := GREATEST(rec.current_pack, v_prev_pack)::numeric / NULLIF(LEAST(rec.current_pack, v_prev_pack), 0);

      IF v_ratio >= 1.5 OR ABS(rec.current_pack - v_prev_pack) >= 1 THEN
        SELECT id INTO v_existing_open
        FROM public.market_price_pack_anomalies a
        WHERE a.source_id = rec.source_id
          AND COALESCE(a.ean, '∅') = COALESCE(rec.ean, '∅')
          AND COALESCE(a.cnk, '∅') = COALESCE(rec.cnk, '∅')
          AND a.previous_pack_size IS NOT DISTINCT FROM v_prev_pack
          AND a.current_pack_size IS NOT DISTINCT FROM rec.current_pack
          AND a.status = 'open'
        LIMIT 1;

        IF v_existing_open IS NULL THEN
          INSERT INTO public.market_price_pack_anomalies(
            source_id, product_id, ean, cnk,
            previous_pack_size, current_pack_size, pack_ratio,
            previous_raw_title, current_raw_title
          ) VALUES (
            rec.source_id, rec.product_id, rec.ean, rec.cnk,
            v_prev_pack, rec.current_pack, ROUND(v_ratio, 2),
            v_prev_title, rec.product_name_source
          );
          v_anomalies := v_anomalies + 1;
        END IF;
      END IF;
    END IF;

    IF v_prev_pack IS NOT NULL AND rec.current_pack IS NULL AND v_prev_title IS DISTINCT FROM rec.product_name_source THEN
      SELECT id INTO v_existing_open
      FROM public.market_price_pack_anomalies a
      WHERE a.source_id = rec.source_id
        AND COALESCE(a.ean, '∅') = COALESCE(rec.ean, '∅')
        AND COALESCE(a.cnk, '∅') = COALESCE(rec.cnk, '∅')
        AND a.previous_pack_size IS NOT DISTINCT FROM v_prev_pack
        AND a.current_pack_size IS NULL
        AND a.status = 'open'
      LIMIT 1;

      IF v_existing_open IS NULL THEN
        INSERT INTO public.market_price_pack_anomalies(
          source_id, product_id, ean, cnk,
          previous_pack_size, current_pack_size, pack_ratio,
          previous_raw_title, current_raw_title
        ) VALUES (
          rec.source_id, rec.product_id, rec.ean, rec.cnk,
          v_prev_pack, NULL, NULL,
          v_prev_title, rec.product_name_source
        );
        v_anomalies := v_anomalies + 1;
      END IF;
    END IF;

    IF v_prev_id IS NOT NULL THEN
      UPDATE public.market_price_pack_history
      SET last_pack_size = rec.current_pack,
          last_raw_title = rec.product_name_source,
          last_seen_at = rec.imported_at,
          product_id = COALESCE(rec.product_id, product_id),
          updated_at = now()
      WHERE id = v_prev_id;
    ELSE
      INSERT INTO public.market_price_pack_history(
        source_id, product_id, ean, cnk,
        last_pack_size, last_raw_title, last_seen_at
      ) VALUES (
        rec.source_id, rec.product_id, rec.ean, rec.cnk,
        rec.current_pack, rec.product_name_source, rec.imported_at
      )
      ON CONFLICT DO NOTHING;
    END IF;
    v_history := v_history + 1;
  END LOOP;

  RETURN QUERY SELECT v_anomalies, v_history;
END;
$$;

COMMENT ON FUNCTION public.detect_market_price_pack_anomalies(uuid) IS
'Détecte les changements significatifs de pack vendeur (CERP/Febelco) entre deux refreshs. Cf. mem://features/market-price-pack-anomaly-detection.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'detect-pack-anomalies-daily') THEN
      PERFORM cron.unschedule('detect-pack-anomalies-daily');
    END IF;
    PERFORM cron.schedule(
      'detect-pack-anomalies-daily',
      '30 4 * * *',
      $cron$ SELECT public.detect_market_price_pack_anomalies(NULL); $cron$
    );
  END IF;
END $$;