-- Remove buyer direct INSERT on legacy order_items table to prevent price tampering.
-- All order creation must go through the create-order edge function which computes
-- prices server-side from offers. Admins and vendors retain access via existing policies.
DROP POLICY IF EXISTS "Customers insert own order items" ON public.order_items;
REVOKE INSERT ON public.order_items FROM authenticated;