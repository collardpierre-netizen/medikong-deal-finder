
-- Fix SECURITY DEFINER view
DROP VIEW IF EXISTS public.restock_public_offers_view;
CREATE VIEW public.restock_public_offers_view
WITH (security_invoker = true) AS
SELECT
  o.id, o.ean, o.cnk, o.designation, o.quantity, o.price_ht, o.price_ttc,
  o.vat_rate, o.dlu, o.product_state, o.grade, o.delivery_condition,
  o.photo_url, o.product_image_url, o.packaging_photos,
  o.allow_partial, o.moq, o.lot_size, o.unit_weight_g,
  o.seller_city, o.status, o.views_count, o.drop_id,
  o.created_at, o.updated_at, o.expires_at
FROM public.restock_offers o
WHERE o.status = 'published';

-- Fix overly permissive RLS on restock_questions
DROP POLICY IF EXISTS "Anyone can insert questions" ON public.restock_questions;
CREATE POLICY "Auth users can insert questions" ON public.restock_questions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND buyer_id IN (
    SELECT id FROM restock_buyers WHERE auth_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Buyers and sellers can read their questions" ON public.restock_questions;
CREATE POLICY "Buyers read own questions" ON public.restock_questions FOR SELECT
  USING (buyer_id IN (SELECT id FROM restock_buyers WHERE auth_user_id = auth.uid()));
CREATE POLICY "Sellers read own questions" ON public.restock_questions FOR SELECT
  USING (seller_id = auth.uid());
CREATE POLICY "Admins manage questions" ON public.restock_questions FOR ALL
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Sellers can answer questions" ON public.restock_questions;
CREATE POLICY "Sellers answer own questions" ON public.restock_questions FOR UPDATE
  USING (seller_id = auth.uid());
