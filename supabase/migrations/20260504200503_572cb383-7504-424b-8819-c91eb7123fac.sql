-- 1) Trigger : synchronise offers.vat_rate avec resolve_product_vat_rate
--    et recalcule price_incl_vat de manière cohérente pour TOUTES les offres
--    (auparavant calculate_offer_prices ne s'appliquait qu'aux offres Qogita
--     et reposait sur la colonne NEW.vat_rate par défaut à 21%).

CREATE OR REPLACE FUNCTION public.sync_offer_vat_and_ttc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resolved_rate numeric;
BEGIN
  IF NEW.product_id IS NULL OR NEW.price_excl_vat IS NULL THEN
    RETURN NEW;
  END IF;

  -- Résout le taux selon la cascade : override produit > CNK exact > CNK préfixe > catégorie > 21%
  SELECT vat_rate INTO _resolved_rate
  FROM public.resolve_product_vat_rate(NEW.product_id, COALESCE(NEW.country_code, 'BE'));

  IF _resolved_rate IS NULL THEN
    _resolved_rate := COALESCE(NEW.vat_rate, 21);
  END IF;

  NEW.vat_rate := _resolved_rate;
  NEW.price_incl_vat := ROUND((NEW.price_excl_vat * (1 + _resolved_rate / 100))::numeric, 2);

  RETURN NEW;
END;
$$;

-- S'exécute APRÈS calculate_offer_prices (qui peut écraser price_excl_vat pour Qogita)
-- grâce à l'ordre alphabétique des noms : 'trg_z_sync_offer_vat_and_ttc' > 'trg_offers_calculate_prices'.
DROP TRIGGER IF EXISTS trg_z_sync_offer_vat_and_ttc ON public.offers;
CREATE TRIGGER trg_z_sync_offer_vat_and_ttc
BEFORE INSERT OR UPDATE OF price_excl_vat, product_id, country_code, vat_rate
ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.sync_offer_vat_and_ttc();

COMMENT ON FUNCTION public.sync_offer_vat_and_ttc() IS
  'Synchronise offers.vat_rate via resolve_product_vat_rate (cascade override→CNK→catégorie→21%) puis recalcule price_incl_vat. S''exécute APRÈS calculate_offer_prices grâce à l''ordre alpha des triggers.';