ALTER TABLE public.savings_simulations
  ADD COLUMN IF NOT EXISTS ocr_extraction_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS catalog_match_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS matched_lines_count int,
  ADD COLUMN IF NOT EXISTS total_lines_count int,
  ADD COLUMN IF NOT EXISTS total_source_matched_only numeric(12,2),
  ADD COLUMN IF NOT EXISTS total_medikong_matched_only numeric(12,2),
  ADD COLUMN IF NOT EXISTS processing_timeout_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text;

ALTER TABLE public.savings_simulation_lines
  ADD COLUMN IF NOT EXISTS line_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'savings_simulation_lines_line_status_check'
  ) THEN
    ALTER TABLE public.savings_simulation_lines
      ADD CONSTRAINT savings_simulation_lines_line_status_check
      CHECK (line_status IS NULL OR line_status IN ('cheaper','more_expensive','equal','not_matched'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_savings_simulations_stuck
  ON public.savings_simulations (status, processing_timeout_at)
  WHERE status = 'processing';

DROP FUNCTION IF EXISTS public.get_savings_simulation_lines_public(uuid);

CREATE FUNCTION public.get_savings_simulation_lines_public(_sim_id uuid)
RETURNS TABLE (
  id uuid,
  line_number smallint,
  detected_name text,
  detected_brand text,
  detected_cnk text,
  detected_quantity integer,
  detected_unit_price_excl_vat numeric,
  matched_product_id uuid,
  match_method text,
  match_confidence numeric,
  medikong_min_price_excl_vat numeric,
  medikong_supplier_count integer,
  line_savings numeric,
  line_savings_pct numeric,
  line_status text,
  matched_product_name text,
  matched_product_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.line_number,
         l.detected_name, l.detected_brand, l.detected_cnk,
         l.detected_quantity, l.detected_unit_price_excl_vat,
         l.matched_product_id, l.match_method, l.match_confidence,
         l.medikong_min_price_excl_vat, l.medikong_supplier_count,
         l.line_savings, l.line_savings_pct,
         COALESCE(l.line_status, CASE WHEN l.medikong_min_price_excl_vat IS NULL THEN 'not_matched' END),
         p.name, p.slug
  FROM public.savings_simulation_lines l
  LEFT JOIN public.products p ON p.id = l.matched_product_id
  WHERE l.simulation_id = _sim_id
  ORDER BY l.line_savings DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_savings_simulation_lines_public(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.expire_stuck_savings_simulations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.savings_simulations
     SET status = 'failed',
         failure_reason = 'timeout',
         error_message = COALESCE(error_message, 'Traitement interrompu (délai dépassé).'),
         updated_at = now()
   WHERE status = 'processing'
     AND processing_timeout_at IS NOT NULL
     AND processing_timeout_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

SELECT cron.unschedule('expire-stuck-savings-analyses')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stuck-savings-analyses');

SELECT cron.schedule(
  'expire-stuck-savings-analyses',
  '*/5 * * * *',
  $$ SELECT public.expire_stuck_savings_simulations(); $$
);