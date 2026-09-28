ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_customer_id_fkey;

ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;