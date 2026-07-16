
-- Revoke sensitive column reads on public.offers from anon and authenticated.
-- Public / buyer catalog queries continue to work via SELECT * expansion which
-- PostgREST filters per column privilege; only the safe columns remain visible.
REVOKE SELECT (
  purchase_price,
  purchase_price_excl_vat,
  commission_rate,
  commission_model,
  margin_amount,
  applied_margin_percentage,
  fixed_commission_amount,
  margin_split_pct,
  commission_override_reason,
  vendor_note
) ON public.offers FROM anon, authenticated;

-- SECURITY DEFINER view giving the offer's own vendor (and admins) full column
-- access to their offers, so vendor/admin screens can keep reading cost & margin.
CREATE OR REPLACE VIEW public.offers_private
WITH (security_invoker = false) AS
SELECT o.*
FROM public.offers o
WHERE public.is_admin(auth.uid())
   OR EXISTS (
     SELECT 1 FROM public.vendors v
     WHERE v.id = o.vendor_id
       AND v.auth_user_id = auth.uid()
   );

REVOKE ALL ON public.offers_private FROM PUBLIC, anon;
GRANT SELECT ON public.offers_private TO authenticated;
GRANT ALL ON public.offers_private TO service_role;
