
-- =========================================================================
-- 1) VENDORS : retirer l'accès anonyme direct, garder vendors_public (definer)
-- =========================================================================

-- Bascule la vue publique en SECURITY DEFINER pour qu'elle reste lisible
-- même quand anon n'a plus accès direct à la table vendors.
ALTER VIEW public.vendors_public SET (security_invoker = false);

-- Drop l'ancienne policy qui exposait toutes les colonnes à anon
DROP POLICY IF EXISTS "Public can read active vendors (safe columns)" ON public.vendors;

-- =========================================================================
-- 2) OFFERS : retirer l'accès anon aux colonnes sensibles (cost/margin)
-- =========================================================================

-- Révoquer tout SELECT sur la table pour anon, puis ne ré-accorder que
-- les colonnes commerciales non sensibles. Les rôles authenticated, admin
-- et service_role conservent leur accès complet via leurs policies RLS.
REVOKE SELECT ON public.offers FROM anon;

GRANT SELECT (
  id, product_id, vendor_id,
  qogita_offer_qid, qogita_base_delay_days, is_qogita_backed,
  price_excl_vat, price_incl_vat, vat_rate,
  moq, mov, mov_amount, mov_currency,
  stock_quantity, stock_status,
  delivery_days, min_delivery_days, max_delivery_days,
  estimated_delivery_days, has_extended_delivery,
  shipping_from_country, country_code,
  price_tiers,
  is_active, synced_at, created_at, updated_at,
  is_traceable, down_payment_pct,
  qogita_seller_fid, is_top_seller,
  campaign_id,
  suggested_retail_price_cents, suggested_retail_price_source,
  pack_size_override, carton_size_override, packaging_languages
) ON public.offers TO anon;

-- =========================================================================
-- 3) SAVINGS SIMULATIONS : drop des reads publics + RPC sécurisée
-- =========================================================================

DROP POLICY IF EXISTS "savings_simulations public read by id" ON public.savings_simulations;
DROP POLICY IF EXISTS "savings_simulation_lines public read" ON public.savings_simulation_lines;

-- Fonction de lecture publique limitée aux colonnes non-PII, par id
CREATE OR REPLACE FUNCTION public.get_savings_simulation_public(_sim_id uuid)
RETURNS TABLE (
  id uuid,
  status text,
  total_lines integer,
  matched_lines integer,
  match_rate numeric,
  source_total_excl_vat numeric,
  medikong_total_excl_vat numeric,
  savings_amount numeric,
  savings_pct numeric,
  source_supplier text,
  source_file_type text,
  error_message text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.status, s.total_lines, s.matched_lines, s.match_rate,
         s.source_total_excl_vat, s.medikong_total_excl_vat,
         s.savings_amount, s.savings_pct,
         s.source_supplier, s.source_file_type,
         s.error_message, s.created_at, s.updated_at
  FROM public.savings_simulations s
  WHERE s.id = _sim_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_savings_simulation_public(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_savings_simulation_lines_public(_sim_id uuid)
RETURNS TABLE (
  id uuid,
  line_number integer,
  detected_name text,
  detected_brand text,
  detected_cnk text,
  detected_quantity numeric,
  detected_unit_price_excl_vat numeric,
  matched_product_id uuid,
  match_method text,
  match_confidence numeric,
  medikong_min_price_excl_vat numeric,
  medikong_supplier_count integer,
  line_savings numeric,
  line_savings_pct numeric,
  matched_product_name text,
  matched_product_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.line_number,
         l.detected_name, l.detected_brand, l.detected_cnk,
         l.detected_quantity, l.detected_unit_price_excl_vat,
         l.matched_product_id, l.match_method, l.match_confidence,
         l.medikong_min_price_excl_vat, l.medikong_supplier_count,
         l.line_savings, l.line_savings_pct,
         p.name, p.slug
  FROM public.savings_simulation_lines l
  LEFT JOIN public.products p ON p.id = l.matched_product_id
  WHERE l.simulation_id = _sim_id
  ORDER BY l.line_savings DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_savings_simulation_lines_public(uuid) TO anon, authenticated;

-- =========================================================================
-- 4) MARKET PRICES : retirer la lecture publique anonyme
-- =========================================================================

DROP POLICY IF EXISTS "public_read_market_prices" ON public.market_prices;

CREATE POLICY "authenticated_read_market_prices"
ON public.market_prices
FOR SELECT
TO authenticated
USING (true);

-- =========================================================================
-- 5) AUDIT REQUESTS : aligner sur is_admin()
-- =========================================================================

DROP POLICY IF EXISTS "Admin only access" ON public.audit_requests;

CREATE POLICY "audit_requests_admin_all"
ON public.audit_requests
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================================
-- 6) STORAGE : restock-photos — restreindre update/delete au owner
-- =========================================================================

DROP POLICY IF EXISTS "Users can delete their restock photos" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can delete their restock photos" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can update their restock photos" ON storage.objects;

CREATE POLICY "restock_photos_owner_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'restock-photos' AND owner = auth.uid())
WITH CHECK (bucket_id = 'restock-photos' AND owner = auth.uid());

CREATE POLICY "restock_photos_owner_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'restock-photos' AND owner = auth.uid());

-- =========================================================================
-- 7) STORAGE : rfq-attachments — scoper l'INSERT au dossier user
-- =========================================================================

DROP POLICY IF EXISTS "rfq_attach_uploader_insert" ON storage.objects;

CREATE POLICY "rfq_attach_uploader_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rfq-attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);
