
-- Fix 1: vendor_brand_authorizations — hide document_reference from public SELECT
-- Replace broad public policy so document_reference is not readable by anon/authenticated
REVOKE SELECT ON public.vendor_brand_authorizations FROM anon, authenticated;

DO $$
DECLARE
  col text;
  cols text[];
BEGIN
  SELECT array_agg(quote_ident(column_name))
    INTO cols
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='vendor_brand_authorizations'
    AND column_name NOT IN ('document_reference','notes');

  EXECUTE format('GRANT SELECT (%s) ON public.vendor_brand_authorizations TO anon, authenticated', array_to_string(cols, ', '));
END $$;

-- Admins/owners keep full access through the existing vendor_brand_authorizations_private view
-- and admin policies; re-grant full column SELECT to service_role for edge functions.
GRANT SELECT ON public.vendor_brand_authorizations TO service_role;

-- Fix 2: vendor_sell_out_lines — add WITH CHECK to UPDATE policy to prevent
-- reassigning a line to another vendor's report.
DROP POLICY IF EXISTS "vendors update own sell-out lines" ON public.vendor_sell_out_lines;

CREATE POLICY "vendors update own sell-out lines"
ON public.vendor_sell_out_lines
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_sell_out_reports r
    WHERE r.id = vendor_sell_out_lines.report_id
      AND (r.vendor_id = current_vendor_id() OR is_admin(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendor_sell_out_reports r
    WHERE r.id = vendor_sell_out_lines.report_id
      AND (r.vendor_id = current_vendor_id() OR is_admin(auth.uid()))
  )
);
