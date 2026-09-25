CREATE TABLE public.scan_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);
CREATE INDEX scan_favorites_customer_idx ON public.scan_favorites (customer_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.scan_favorites TO authenticated;
GRANT ALL ON public.scan_favorites TO service_role;
ALTER TABLE public.scan_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan favorites members read" ON public.scan_favorites FOR SELECT TO authenticated
USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid() UNION SELECT public.current_user_buyer_account_ids()));
CREATE POLICY "scan favorites members insert" ON public.scan_favorites FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid() UNION SELECT public.current_user_buyer_account_ids()));
CREATE POLICY "scan favorites members delete" ON public.scan_favorites FOR DELETE TO authenticated
USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid() UNION SELECT public.current_user_buyer_account_ids()));
CREATE POLICY "scan favorites admin read" ON public.scan_favorites FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));