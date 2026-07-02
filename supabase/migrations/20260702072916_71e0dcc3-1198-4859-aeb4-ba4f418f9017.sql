
CREATE OR REPLACE FUNCTION public.recompute_qogita_sync_tiers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a int; v_b int; v_c int;
BEGIN
  CREATE TEMP TABLE _tier_map ON COMMIT DROP AS
  WITH pop AS (
    SELECT id,
           NTILE(10) OVER (ORDER BY COALESCE(popularity, 0) DESC) AS bucket
    FROM public.products
    WHERE is_active = true AND qogita_qid IS NOT NULL
  ),
  recent_ordered AS (
    SELECT DISTINCT ol.product_id AS id
    FROM public.order_lines ol
    JOIN public.orders o ON o.id = ol.order_id
    WHERE o.created_at > now() - interval '30 days'
      AND ol.product_id IS NOT NULL
  )
  SELECT
    p.id,
    CASE
      WHEN ro.id IS NOT NULL THEN 'A'::char(1)
      WHEN pop.bucket = 1 THEN 'A'::char(1)
      WHEN pop.bucket <= 5 THEN 'B'::char(1)
      ELSE 'C'::char(1)
    END AS tier
  FROM public.products p
  JOIN pop ON pop.id = p.id
  LEFT JOIN recent_ordered ro ON ro.id = p.id
  WHERE p.is_active = true AND p.qogita_qid IS NOT NULL;

  CREATE INDEX ON _tier_map(id);

  UPDATE public.products p
  SET qogita_sync_tier = t.tier
  FROM _tier_map t
  WHERE p.id = t.id AND p.qogita_sync_tier IS DISTINCT FROM t.tier;

  SELECT
    count(*) FILTER (WHERE tier='A'),
    count(*) FILTER (WHERE tier='B'),
    count(*) FILTER (WHERE tier='C')
  INTO v_a, v_b, v_c
  FROM _tier_map;

  RETURN jsonb_build_object(
    'tier_a', v_a, 'tier_b', v_b, 'tier_c', v_c,
    'recomputed_at', now()
  );
END $$;
