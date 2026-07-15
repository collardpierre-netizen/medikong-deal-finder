
-- 1. pharmacy_id sur vendor_sell_out_reports
ALTER TABLE public.vendor_sell_out_reports
  ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.be_pharmacies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vsor_pharmacy ON public.vendor_sell_out_reports(pharmacy_id) WHERE pharmacy_id IS NOT NULL;

-- 2. Backfill fuzzy : match APB (8 digits) dans le libellé, sinon match nom exact case-insensitive
CREATE OR REPLACE FUNCTION public.backfill_sell_out_pharmacy_ids()
RETURNS TABLE(updated_count int, remaining_unmatched int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int := 0;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  -- Match par APB extrait du libellé
  WITH matched AS (
    SELECT r.id AS report_id, p.id AS pharmacy_id
    FROM public.vendor_sell_out_reports r
    JOIN public.be_pharmacies p
      ON p.is_active = true
     AND r.customer_label ~ ('\m' || p.apb_number || '\M')
    WHERE r.pharmacy_id IS NULL
  )
  UPDATE public.vendor_sell_out_reports r
     SET pharmacy_id = m.pharmacy_id
    FROM matched m
   WHERE r.id = m.report_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Match par nom exact (case-insensitive, sur libellé nettoyé)
  WITH matched AS (
    SELECT DISTINCT ON (r.id) r.id AS report_id, p.id AS pharmacy_id
    FROM public.vendor_sell_out_reports r
    JOIN public.be_pharmacies p
      ON p.is_active = true
     AND lower(r.customer_label) LIKE '%' || lower(p.name) || '%'
    WHERE r.pharmacy_id IS NULL
      AND length(p.name) >= 5
    ORDER BY r.id, length(p.name) DESC
  )
  UPDATE public.vendor_sell_out_reports r
     SET pharmacy_id = m.pharmacy_id
    FROM matched m
   WHERE r.id = m.report_id;
  v_updated := v_updated + COALESCE(ROW_COUNT, 0);

  RETURN QUERY
    SELECT v_updated,
           (SELECT count(*)::int FROM public.vendor_sell_out_reports WHERE pharmacy_id IS NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_sell_out_pharmacy_ids() TO authenticated;

-- 3. Vue admin export CSV pharmacies pré-qualifiées
CREATE OR REPLACE VIEW public.be_pharmacies_export_v
WITH (security_invoker = true)
AS
  SELECT id, apb_number, name, address_line1, postal_code, city, province,
         phone, email, latitude, longitude
    FROM public.be_pharmacies
   WHERE is_active = true;

GRANT SELECT ON public.be_pharmacies_export_v TO authenticated;
