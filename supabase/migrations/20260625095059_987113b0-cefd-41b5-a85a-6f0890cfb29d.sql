
-- 1) SECURITY DEFINER helper so the offers public policy can evaluate hide-exclusivities
--    without requiring anon/authenticated to read sensitive vendor_exclusivities columns.
CREATE OR REPLACE FUNCTION public.offer_is_hidden_by_exclusivity(_vendor_id uuid, _product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_exclusivities e
    JOIN public.products p ON p.id = _product_id
    WHERE e.is_active = true
      AND e.mode = 'hide'::vendor_exclusivity_mode
      AND now() >= e.valid_from
      AND now() < e.valid_until
      AND e.vendor_id = _vendor_id
      AND e.buyer_profile_ids IS NOT NULL
      AND array_length(e.buyer_profile_ids, 1) > 0
      AND (
        public.current_buyer_profile_id() IS NULL
        OR NOT (public.current_buyer_profile_id() = ANY (e.buyer_profile_ids))
      )
      AND (
        (e.scope = 'product'::vendor_exclusivity_scope AND e.product_id = p.id) OR
        (e.scope = 'brand'::vendor_exclusivity_scope AND e.brand_id = p.brand_id) OR
        (e.scope = 'manufacturer'::vendor_exclusivity_scope AND e.manufacturer_id = p.manufacturer_id) OR
        (e.scope = 'category'::vendor_exclusivity_scope AND e.category_id = p.primary_category_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.offer_is_hidden_by_exclusivity(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.offer_is_hidden_by_exclusivity(uuid, uuid) TO anon, authenticated, service_role;

-- 2) Replace offers public-read policy to use the helper
DROP POLICY IF EXISTS "Offers read active public" ON public.offers;
CREATE POLICY "Offers read active public" ON public.offers
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND NOT public.offer_is_hidden_by_exclusivity(vendor_id, product_id)
  );

-- 3) Restrict anon column access on offers (hide costs/margins/commissions/qogita identifiers)
REVOKE SELECT ON public.offers FROM anon;
GRANT SELECT (
  id, product_id, vendor_id, price_excl_vat, price_incl_vat, vat_rate,
  moq, mov, stock_quantity, stock_status, delivery_days, shipping_from_country,
  price_tiers, is_active, synced_at, created_at, updated_at, country_code,
  mov_amount, mov_currency, is_traceable, has_extended_delivery,
  min_delivery_days, max_delivery_days, estimated_delivery_days, down_payment_pct,
  is_top_seller, campaign_id, suggested_retail_price_cents,
  suggested_retail_price_source, pack_size_override, admin_hidden,
  carton_size_override, packaging_languages, qogita_base_delay_days,
  is_qogita_backed
) ON public.offers TO anon;

-- 4) vendor_exclusivities : drop public-read policy entirely.
--    Reading is now limited to vendor owners and admins (existing policies).
--    The offers policy reaches the rows via the SECURITY DEFINER helper above.
DROP POLICY IF EXISTS "Public reads active exclusivities" ON public.vendor_exclusivities;
REVOKE SELECT ON public.vendor_exclusivities FROM anon;

-- 5) offer_price_tiers : remove the blanket authenticated read and replace by
--    vendor-owner read + public read of non-sensitive columns only.
DROP POLICY IF EXISTS "Offer price tiers readable by authenticated" ON public.offer_price_tiers;

CREATE POLICY "Vendors read own offer price tiers" ON public.offer_price_tiers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.offers o
      JOIN public.vendors v ON v.id = o.vendor_id
      WHERE o.id = offer_price_tiers.offer_id
        AND v.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Public reads active offer price tiers" ON public.offer_price_tiers
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Column-level restrictions on offer_price_tiers : strip qogita_unit_price and margin_amount
REVOKE SELECT ON public.offer_price_tiers FROM anon, authenticated;
GRANT SELECT (
  id, offer_id, tier_index, mov_threshold, mov_currency,
  price_excl_vat, price_incl_vat, is_active, mov_progress, created_at
) ON public.offer_price_tiers TO anon, authenticated;

-- Service role keeps full access for edge functions
GRANT ALL ON public.offers TO service_role;
GRANT ALL ON public.offer_price_tiers TO service_role;
GRANT ALL ON public.vendor_exclusivities TO service_role;
