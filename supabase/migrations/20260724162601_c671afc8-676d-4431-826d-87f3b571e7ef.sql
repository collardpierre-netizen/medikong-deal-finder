
-- 1) Historique de prix Qogita (public scraping)
CREATE TABLE IF NOT EXISTS public.qogita_price_history (
  gtin text NOT NULL,
  price_date date NOT NULL,
  price_eur numeric(12,4) NOT NULL,
  source text NOT NULL DEFAULT 'qogita_public',
  scraped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gtin, price_date)
);
GRANT SELECT ON public.qogita_price_history TO authenticated;
GRANT ALL ON public.qogita_price_history TO service_role;
ALTER TABLE public.qogita_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qph_admin_read" ON public.qogita_price_history
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE INDEX IF NOT EXISTS qph_date_idx ON public.qogita_price_history (price_date DESC);
CREATE INDEX IF NOT EXISTS qph_gtin_date_idx ON public.qogita_price_history (gtin, price_date DESC);

-- 2) Panier d'indice Tendances (scope paramétrable)
CREATE TABLE IF NOT EXISTS public.tendances_index_basket (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  priority smallint NOT NULL DEFAULT 100,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  last_scraped_at timestamptz,
  last_scrape_status text,
  last_scrape_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tendances_index_basket TO authenticated;
GRANT ALL ON public.tendances_index_basket TO service_role;
ALTER TABLE public.tendances_index_basket ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tib_admin_all" ON public.tendances_index_basket
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE INDEX IF NOT EXISTS tib_active_prio_idx ON public.tendances_index_basket (is_active, priority, last_scraped_at NULLS FIRST);

-- 3) Logs d'exécution du scraper
CREATE TABLE IF NOT EXISTS public.qogita_price_scrape_logs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  products_targeted int DEFAULT 0,
  products_ok int DEFAULT 0,
  products_404 int DEFAULT 0,
  products_error int DEFAULT 0,
  points_upserted int DEFAULT 0,
  offers_resourced int DEFAULT 0,
  notes text,
  errors jsonb DEFAULT '[]'::jsonb
);
GRANT SELECT ON public.qogita_price_scrape_logs TO authenticated;
GRANT ALL ON public.qogita_price_scrape_logs TO service_role;
ALTER TABLE public.qogita_price_scrape_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qpsl_admin_read" ON public.qogita_price_scrape_logs
  FOR SELECT TO authenticated USING (public.is_admin());

-- 4) Traçabilité du re-sourcing sur les offres (garde-fou checkout géré côté code)
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS price_source text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS price_source_updated_at timestamptz;

-- 5) Vues agrégats Tendances (marque / catégorie)
CREATE OR REPLACE VIEW public.qogita_price_history_by_brand_v
WITH (security_invoker = true) AS
SELECT
  p.brand_id,
  b.name AS brand_name,
  h.price_date,
  count(*) AS product_count,
  round(avg(h.price_eur)::numeric, 4) AS avg_price_eur,
  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY h.price_eur)::numeric, 4) AS median_price_eur,
  round(min(h.price_eur)::numeric, 4) AS min_price_eur,
  round(max(h.price_eur)::numeric, 4) AS max_price_eur
FROM public.qogita_price_history h
JOIN public.products p ON p.gtin = h.gtin
LEFT JOIN public.brands b ON b.id = p.brand_id
WHERE p.brand_id IS NOT NULL
GROUP BY p.brand_id, b.name, h.price_date;

CREATE OR REPLACE VIEW public.qogita_price_history_by_category_v
WITH (security_invoker = true) AS
SELECT
  p.primary_category_id AS category_id,
  c.name AS category_name,
  h.price_date,
  count(*) AS product_count,
  round(avg(h.price_eur)::numeric, 4) AS avg_price_eur,
  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY h.price_eur)::numeric, 4) AS median_price_eur
FROM public.qogita_price_history h
JOIN public.products p ON p.gtin = h.gtin
LEFT JOIN public.categories c ON c.id = p.primary_category_id
WHERE p.primary_category_id IS NOT NULL
GROUP BY p.primary_category_id, c.name, h.price_date;

-- 6) RPC : variations J/J, 7j, 30j par produit
CREATE OR REPLACE FUNCTION public.qogita_price_trends(_gtin text)
RETURNS TABLE (
  gtin text,
  last_date date,
  last_price numeric,
  change_1d_pct numeric,
  change_7d_pct numeric,
  change_30d_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH latest AS (
    SELECT h.gtin, h.price_date, h.price_eur,
           row_number() OVER (PARTITION BY h.gtin ORDER BY h.price_date DESC) AS rn
    FROM public.qogita_price_history h
    WHERE h.gtin = _gtin
  ),
  ref AS (
    SELECT
      (SELECT price_eur FROM latest WHERE rn = 1) AS p_now,
      (SELECT price_date FROM latest WHERE rn = 1) AS d_now,
      (SELECT price_eur FROM latest ORDER BY abs(price_date - ((SELECT price_date FROM latest WHERE rn = 1) - INTERVAL '1 day')::date) LIMIT 1) AS p_1d,
      (SELECT price_eur FROM latest ORDER BY abs(price_date - ((SELECT price_date FROM latest WHERE rn = 1) - INTERVAL '7 days')::date) LIMIT 1) AS p_7d,
      (SELECT price_eur FROM latest ORDER BY abs(price_date - ((SELECT price_date FROM latest WHERE rn = 1) - INTERVAL '30 days')::date) LIMIT 1) AS p_30d
  )
  SELECT
    _gtin,
    r.d_now,
    r.p_now,
    CASE WHEN r.p_1d > 0 THEN round(((r.p_now - r.p_1d)/r.p_1d*100)::numeric, 2) END,
    CASE WHEN r.p_7d > 0 THEN round(((r.p_now - r.p_7d)/r.p_7d*100)::numeric, 2) END,
    CASE WHEN r.p_30d > 0 THEN round(((r.p_now - r.p_30d)/r.p_30d*100)::numeric, 2) END
  FROM ref r;
$$;
GRANT EXECUTE ON FUNCTION public.qogita_price_trends(text) TO authenticated;

-- 7) Trigger updated_at
DROP TRIGGER IF EXISTS trg_tib_updated ON public.tendances_index_basket;
CREATE TRIGGER trg_tib_updated BEFORE UPDATE ON public.tendances_index_basket
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
