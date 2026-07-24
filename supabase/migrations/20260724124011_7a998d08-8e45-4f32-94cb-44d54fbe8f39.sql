GRANT SELECT ON public.vendor_visibility_rules TO anon;
CREATE POLICY "Anon read vendor_visibility_rules"
  ON public.vendor_visibility_rules FOR SELECT
  TO anon
  USING (true);