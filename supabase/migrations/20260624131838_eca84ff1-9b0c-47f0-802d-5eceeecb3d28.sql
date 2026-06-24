
-- 1. restock_offers — document seller_id semantics
COMMENT ON COLUMN public.restock_offers.seller_id IS
  'auth.uid() of the seller account. RLS policy "Sellers manage own offers" enforces auth.uid() = seller_id. NOT a restock_buyers.id.';

-- Defense-in-depth: ensure seller_id is never NULL (RLS auth.uid()=seller_id would still match if both NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='restock_offers'
      AND column_name='seller_id' AND is_nullable='YES'
  ) THEN
    EXECUTE 'ALTER TABLE public.restock_offers ALTER COLUMN seller_id SET NOT NULL';
  END IF;
END $$;

-- 2. savings_simulations & savings_simulation_lines — defense-in-depth revokes
REVOKE ALL ON public.savings_simulations FROM anon, authenticated;
REVOKE ALL ON public.savings_simulation_lines FROM anon, authenticated;

-- Re-grant only what admin policy needs (SELECT for authenticated, gated by is_admin policy)
GRANT SELECT ON public.savings_simulations TO authenticated;
GRANT SELECT ON public.savings_simulation_lines TO authenticated;

-- Service role (edge functions) keeps full access
GRANT ALL ON public.savings_simulations TO service_role;
GRANT ALL ON public.savings_simulation_lines TO service_role;

-- Add an admin SELECT policy on lines to mirror simulations (currently 0 policies → no client access at all)
DROP POLICY IF EXISTS "Admins read savings_simulation_lines" ON public.savings_simulation_lines;
CREATE POLICY "Admins read savings_simulation_lines"
  ON public.savings_simulation_lines FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND simulation_id IN (SELECT id FROM public.savings_simulations)
  );

COMMENT ON TABLE public.savings_simulations IS
  'Pharmacy savings simulations submitted via public landing page. Writes only via service_role edge functions (process-savings-upload). Reads restricted to admins; report retrieval uses email proof-of-possession in generate-savings-report.';
