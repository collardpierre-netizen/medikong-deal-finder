-- Re-grant column-level SELECT on non-sensitive display columns
-- (revoking the table-level privilege also dropped column grants)
DO $$
DECLARE
  col text;
  sensitive text[] := ARRAY[
    'qogita_base_price','applied_margin_rule_id','applied_margin_percentage','margin_amount',
    'purchase_price','purchase_price_excl_vat','commission_model','commission_rate',
    'margin_split_pct','fixed_commission_amount','commission_override_status',
    'commission_valid_from','commission_valid_until','commission_override_reason',
    'commission_override_updated_by','commission_override_updated_at','vendor_note',
    'commission_override_created_via_admin_shortcut','margin_share_medista_pct',
    'margin_share_medikong_pct','admin_hidden_reason','admin_hidden_by'
  ];
BEGIN
  FOR col IN
    SELECT a.attname
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'offers'
      AND a.attnum > 0 AND NOT a.attisdropped
      AND NOT (a.attname = ANY(sensitive))
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.offers TO anon, authenticated', col);
  END LOOP;

  -- admin_hidden_reason stays readable by authenticated only (moderation context)
  EXECUTE 'GRANT SELECT (admin_hidden_reason) ON public.offers TO authenticated';
END $$;

GRANT SELECT ON public.offers TO service_role;

-- Privileged view: must NOT be security_invoker, otherwise the querying role
-- would need base-table privileges on the sensitive columns. Access control is
-- enforced by the view predicate (admin or owning vendor).
DROP VIEW IF EXISTS public.offers_private;
CREATE VIEW public.offers_private WITH (security_invoker = false) AS
  SELECT o.*
  FROM public.offers o
  WHERE public.is_admin(auth.uid())
     OR EXISTS (
       SELECT 1 FROM public.vendors v
       WHERE v.id = o.vendor_id AND v.auth_user_id = auth.uid()
     );

REVOKE ALL ON public.offers_private FROM anon;
GRANT SELECT ON public.offers_private TO authenticated;
GRANT SELECT ON public.offers_private TO service_role;