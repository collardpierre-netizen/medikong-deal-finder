-- Grant SELECT au niveau colonne (colonnes publiques uniquement) à anon et authenticated.
-- Les colonnes sensibles (purchase_price*, margin_*, commission_*, vendor_note, admin_hidden_*)
-- sont volontairement omises et restent réservées à la vue offers_private.
DO $$
DECLARE
  public_cols text := 'id, product_id, vendor_id, qogita_offer_qid, qogita_base_price, qogita_base_delay_days, is_qogita_backed, price_excl_vat, price_incl_vat, vat_rate, moq, mov, stock_quantity, stock_status, delivery_days, shipping_from_country, price_tiers, is_active, synced_at, created_at, updated_at, country_code, mov_amount, mov_currency, is_traceable, has_extended_delivery, min_delivery_days, max_delivery_days, estimated_delivery_days, down_payment_pct, qogita_seller_fid, is_top_seller, campaign_id, suggested_retail_price_cents, suggested_retail_price_source, pack_size_override, carton_size_override, packaging_languages, source_supplier, last_sync_run_id, country_codes, price_stale, price_stale_since, price_source, price_source_updated_at, last_verified_at';
BEGIN
  EXECUTE format('GRANT SELECT (%s) ON public.offers TO anon', public_cols);
  EXECUTE format('GRANT SELECT (%s) ON public.offers TO authenticated', public_cols);
END $$;

-- Les vendeurs et admins ont besoin d'écrire (INSERT/UPDATE/DELETE) — les policies existantes filtrent la portée.
GRANT INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;

-- Policy SELECT publique sur les offres actives (anon + authenticated).
-- Multiples policies SELECT sont OR'd : cohabite avec les policies existantes (Admins, Vendeurs, Verified buyers).
DROP POLICY IF EXISTS "Offers public read active" ON public.offers;
CREATE POLICY "Offers public read active"
  ON public.offers
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);