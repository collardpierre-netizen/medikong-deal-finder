
-- Fix infinite recursion between orders and order_lines RLS policies
-- by replacing cross-referencing subqueries with SECURITY DEFINER helpers.

CREATE OR REPLACE FUNCTION public.is_order_vendor(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_lines ol
    JOIN public.vendors v ON v.id = ol.vendor_id
    WHERE ol.order_id = _order_id
      AND (
        v.auth_user_id = auth.uid()
        OR v.id IN (SELECT public.current_user_vendor_account_ids())
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_customer_order(_order_id uuid)
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
  );
$$;

-- Replace recursive orders SELECT policy
DROP POLICY IF EXISTS "Vendors read orders with their lines" ON public.orders;
CREATE POLICY "Vendors read orders with their lines"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_order_vendor(id));

-- Replace recursive order_lines SELECT policy for customers
DROP POLICY IF EXISTS "Customers read own order lines safe" ON public.order_lines;
CREATE POLICY "Customers read own order lines safe"
ON public.order_lines
FOR SELECT
TO authenticated
USING (public.is_customer_order(order_id));
