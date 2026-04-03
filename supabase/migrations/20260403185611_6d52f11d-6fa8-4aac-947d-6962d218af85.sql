
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id),
  product_id uuid REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price_excl_vat numeric NOT NULL DEFAULT 0,
  unit_price_incl_vat numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0.21,
  line_total_excl_vat numeric NOT NULL DEFAULT 0,
  line_total_incl_vat numeric NOT NULL DEFAULT 0,
  qogita_offer_qid text,
  qogita_seller_fid text,
  qogita_base_price numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers read own order items"
ON public.order_items FOR SELECT
TO authenticated
USING (order_id IN (
  SELECT o.id FROM orders o
  WHERE o.customer_id IN (
    SELECT c.id FROM customers c WHERE c.auth_user_id = auth.uid()
  )
));

CREATE POLICY "Customers insert own order items"
ON public.order_items FOR INSERT
TO authenticated
WITH CHECK (order_id IN (
  SELECT o.id FROM orders o
  WHERE o.customer_id IN (
    SELECT c.id FROM customers c WHERE c.auth_user_id = auth.uid()
  )
));

CREATE POLICY "Admins manage order items"
ON public.order_items FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_offer_id ON public.order_items(offer_id);
