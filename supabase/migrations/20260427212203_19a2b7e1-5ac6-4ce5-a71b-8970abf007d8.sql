CREATE TABLE IF NOT EXISTS public.offer_data_quality_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  issue_code text NOT NULL,
  details jsonb,
  occurrence_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT offer_data_quality_unique UNIQUE (product_id, offer_id, issue_code)
);

CREATE INDEX IF NOT EXISTS idx_odql_unresolved
  ON public.offer_data_quality_logs (issue_code, last_seen_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.offer_data_quality_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read data quality logs" ON public.offer_data_quality_logs;
CREATE POLICY "Admins can read data quality logs"
ON public.offer_data_quality_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update data quality logs" ON public.offer_data_quality_logs;
CREATE POLICY "Admins can update data quality logs"
ON public.offer_data_quality_logs
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_offer_data_issue(
  _product_id uuid,
  _offer_id uuid,
  _issue_code text,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _issue_code IS NULL OR length(_issue_code) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.offer_data_quality_logs (product_id, offer_id, issue_code, details)
  VALUES (_product_id, _offer_id, _issue_code, COALESCE(_details, '{}'::jsonb))
  ON CONFLICT (product_id, offer_id, issue_code) DO UPDATE
  SET occurrence_count = public.offer_data_quality_logs.occurrence_count + 1,
      last_seen_at = now(),
      details = COALESCE(EXCLUDED.details, public.offer_data_quality_logs.details),
      resolved_at = NULL;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.log_offer_data_issue(uuid, uuid, text, jsonb) TO anon, authenticated;