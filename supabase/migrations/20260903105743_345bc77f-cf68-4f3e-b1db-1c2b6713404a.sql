CREATE TABLE public.order_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('admin','customer')),
  sender_user_id uuid,
  sender_name text,
  body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 5000),
  read_by_customer_at timestamptz,
  read_by_admin_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_messages_order_created ON public.order_messages(order_id, created_at);

GRANT SELECT, INSERT ON public.order_messages TO authenticated;
GRANT ALL ON public.order_messages TO service_role;

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.order_belongs_to_current_user(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE o.id = _order_id
      AND c.auth_user_id = auth.uid()
  )
$$;

CREATE POLICY "Admins manage order messages"
ON public.order_messages FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Customers read own order messages"
ON public.order_messages FOR SELECT TO authenticated
USING (public.order_belongs_to_current_user(order_id));

CREATE POLICY "Customers reply on own order messages"
ON public.order_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_role = 'customer'
  AND sender_user_id = auth.uid()
  AND public.order_belongs_to_current_user(order_id)
);

CREATE TRIGGER trg_order_messages_updated_at
BEFORE UPDATE ON public.order_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();