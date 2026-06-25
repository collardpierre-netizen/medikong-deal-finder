
-- Fix 1: savings_simulations — add owner read policy by email match
CREATE POLICY "Owners read own savings_simulations"
  ON public.savings_simulations
  FOR SELECT
  TO authenticated
  USING (
    email IS NOT NULL
    AND lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

-- Fix 2: vendor_visibility_rules — restrict public read to authenticated only
DROP POLICY IF EXISTS "Vendor visibility rules publicly readable" ON public.vendor_visibility_rules;

CREATE POLICY "Authenticated read vendor_visibility_rules"
  ON public.vendor_visibility_rules
  FOR SELECT
  TO authenticated
  USING (true);
