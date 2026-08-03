CREATE TABLE IF NOT EXISTS public.qogita_price_write_anomalies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid,
  offer_qid text,
  seller_fid text,
  anomaly_type text NOT NULL,
  attempted_base_price numeric,
  indicative_price numeric,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.qogita_price_write_anomalies TO service_role;
GRANT SELECT ON public.qogita_price_write_anomalies TO authenticated;

ALTER TABLE public.qogita_price_write_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_price_write_anomalies" ON public.qogita_price_write_anomalies;
CREATE POLICY "admins_read_price_write_anomalies"
ON public.qogita_price_write_anomalies FOR SELECT TO authenticated
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_qogita_price_anomalies_created ON public.qogita_price_write_anomalies (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qogita_price_anomalies_type ON public.qogita_price_write_anomalies (anomaly_type);
CREATE INDEX IF NOT EXISTS idx_offers_api_base_one ON public.offers (product_id) WHERE price_source = 'qogita_api' AND qogita_base_price = 1;