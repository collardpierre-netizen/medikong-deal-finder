
-- 1) Public read on price history (aggregated market data, no user link)
DROP POLICY IF EXISTS "qph_public_read" ON public.qogita_price_history;
CREATE POLICY "qph_public_read" ON public.qogita_price_history
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.qogita_price_history TO anon, authenticated;
GRANT SELECT ON public.qogita_price_history_by_brand_v TO anon, authenticated;
GRANT SELECT ON public.qogita_price_history_by_category_v TO anon, authenticated;

-- 2) Daily series per brand
CREATE OR REPLACE FUNCTION public.qogita_brand_trend_series(_brand_id uuid, _days int DEFAULT 90)
RETURNS TABLE (
  price_date date,
  product_count bigint,
  avg_price_eur numeric,
  median_price_eur numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT price_date, product_count, avg_price_eur, median_price_eur
  FROM public.qogita_price_history_by_brand_v
  WHERE brand_id = _brand_id
    AND price_date >= (current_date - GREATEST(_days, 1))
  ORDER BY price_date;
$$;
GRANT EXECUTE ON FUNCTION public.qogita_brand_trend_series(uuid, int) TO anon, authenticated;

-- 3) Daily series per category
CREATE OR REPLACE FUNCTION public.qogita_category_trend_series(_category_id uuid, _days int DEFAULT 90)
RETURNS TABLE (
  price_date date,
  product_count bigint,
  avg_price_eur numeric,
  median_price_eur numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT price_date, product_count, avg_price_eur, median_price_eur
  FROM public.qogita_price_history_by_category_v
  WHERE category_id = _category_id
    AND price_date >= (current_date - GREATEST(_days, 1))
  ORDER BY price_date;
$$;
GRANT EXECUTE ON FUNCTION public.qogita_category_trend_series(uuid, int) TO anon, authenticated;

-- 4) Summary variations (J/J, 7j, 30j) on median for a brand
CREATE OR REPLACE FUNCTION public.qogita_brand_trend_summary(_brand_id uuid)
RETURNS TABLE (
  last_date date,
  last_median numeric,
  last_avg numeric,
  product_count bigint,
  change_1d_pct numeric,
  change_7d_pct numeric,
  change_30d_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH s AS (
    SELECT price_date, product_count, avg_price_eur, median_price_eur
    FROM public.qogita_price_history_by_brand_v
    WHERE brand_id = _brand_id
  ),
  ranked AS (
    SELECT *, row_number() OVER (ORDER BY price_date DESC) AS rn FROM s
  ),
  ref AS (
    SELECT
      (SELECT price_date FROM ranked WHERE rn=1) AS d_now,
      (SELECT median_price_eur FROM ranked WHERE rn=1) AS m_now,
      (SELECT avg_price_eur FROM ranked WHERE rn=1) AS a_now,
      (SELECT product_count FROM ranked WHERE rn=1) AS c_now,
      (SELECT median_price_eur FROM s ORDER BY abs(price_date - ((SELECT price_date FROM ranked WHERE rn=1) - INTERVAL '1 day')::date) LIMIT 1) AS m_1d,
      (SELECT median_price_eur FROM s ORDER BY abs(price_date - ((SELECT price_date FROM ranked WHERE rn=1) - INTERVAL '7 days')::date) LIMIT 1) AS m_7d,
      (SELECT median_price_eur FROM s ORDER BY abs(price_date - ((SELECT price_date FROM ranked WHERE rn=1) - INTERVAL '30 days')::date) LIMIT 1) AS m_30d
  )
  SELECT
    r.d_now, r.m_now, r.a_now, r.c_now,
    CASE WHEN r.m_1d  > 0 THEN round(((r.m_now - r.m_1d )/r.m_1d *100)::numeric, 2) END,
    CASE WHEN r.m_7d  > 0 THEN round(((r.m_now - r.m_7d )/r.m_7d *100)::numeric, 2) END,
    CASE WHEN r.m_30d > 0 THEN round(((r.m_now - r.m_30d)/r.m_30d*100)::numeric, 2) END
  FROM ref r;
$$;
GRANT EXECUTE ON FUNCTION public.qogita_brand_trend_summary(uuid) TO anon, authenticated;

-- 5) Same for category
CREATE OR REPLACE FUNCTION public.qogita_category_trend_summary(_category_id uuid)
RETURNS TABLE (
  last_date date,
  last_median numeric,
  last_avg numeric,
  product_count bigint,
  change_1d_pct numeric,
  change_7d_pct numeric,
  change_30d_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH s AS (
    SELECT price_date, product_count, avg_price_eur, median_price_eur
    FROM public.qogita_price_history_by_category_v
    WHERE category_id = _category_id
  ),
  ranked AS (
    SELECT *, row_number() OVER (ORDER BY price_date DESC) AS rn FROM s
  ),
  ref AS (
    SELECT
      (SELECT price_date FROM ranked WHERE rn=1) AS d_now,
      (SELECT median_price_eur FROM ranked WHERE rn=1) AS m_now,
      (SELECT avg_price_eur FROM ranked WHERE rn=1) AS a_now,
      (SELECT product_count FROM ranked WHERE rn=1) AS c_now,
      (SELECT median_price_eur FROM s ORDER BY abs(price_date - ((SELECT price_date FROM ranked WHERE rn=1) - INTERVAL '1 day')::date) LIMIT 1) AS m_1d,
      (SELECT median_price_eur FROM s ORDER BY abs(price_date - ((SELECT price_date FROM ranked WHERE rn=1) - INTERVAL '7 days')::date) LIMIT 1) AS m_7d,
      (SELECT median_price_eur FROM s ORDER BY abs(price_date - ((SELECT price_date FROM ranked WHERE rn=1) - INTERVAL '30 days')::date) LIMIT 1) AS m_30d
  )
  SELECT
    r.d_now, r.m_now, r.a_now, r.c_now,
    CASE WHEN r.m_1d  > 0 THEN round(((r.m_now - r.m_1d )/r.m_1d *100)::numeric, 2) END,
    CASE WHEN r.m_7d  > 0 THEN round(((r.m_now - r.m_7d )/r.m_7d *100)::numeric, 2) END,
    CASE WHEN r.m_30d > 0 THEN round(((r.m_now - r.m_30d)/r.m_30d*100)::numeric, 2) END
  FROM ref r;
$$;
GRANT EXECUTE ON FUNCTION public.qogita_category_trend_summary(uuid) TO anon, authenticated;
