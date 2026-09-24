DROP POLICY IF EXISTS affiliate_cost_params_read ON public.affiliate_margin_cost_params;
CREATE POLICY affiliate_cost_params_admin_read ON public.affiliate_margin_cost_params
  FOR SELECT TO authenticated USING (public.is_admin());