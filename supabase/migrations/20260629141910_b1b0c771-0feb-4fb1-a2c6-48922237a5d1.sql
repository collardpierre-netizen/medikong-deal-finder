
-- 1) offers : revoke sensitive columns from anon/authenticated, keep them for service_role (vendor/admin access reste via RLS sur la table complète quand grant existe)
DO $$
DECLARE
  cols TEXT[] := ARRAY[
    'purchase_price','purchase_price_excl_vat',
    'commission_rate','commission_model','margin_amount',
    'applied_margin_percentage','margin_split_pct','fixed_commission_amount',
    'qogita_base_price','qogita_offer_qid','qogita_seller_fid'
  ];
  c TEXT;
BEGIN
  FOREACH c IN ARRAY cols LOOP
    EXECUTE format('REVOKE SELECT (%I) ON public.offers FROM anon, authenticated', c);
  END LOOP;
END $$;

-- Ensure service_role keeps full access
GRANT ALL ON public.offers TO service_role;

-- 2) offer_price_tiers : revoke sensitive cost/margin columns from anon/authenticated
REVOKE SELECT (qogita_unit_price, margin_amount) ON public.offer_price_tiers FROM anon, authenticated;
GRANT ALL ON public.offer_price_tiers TO service_role;

-- 3) discount_tiers : remove blanket PUBLIC read policy, restrict to authenticated
DROP POLICY IF EXISTS discount_tiers_read ON public.discount_tiers;
CREATE POLICY discount_tiers_read_authenticated
  ON public.discount_tiers
  FOR SELECT
  TO authenticated
  USING (true);

GRANT ALL ON public.discount_tiers TO service_role;
