-- Auto-touch des offres quand le conditionnement change → invalide caches & resync
-- 1) Touch offers.updated_at quand pack_size_override change
CREATE OR REPLACE FUNCTION public.touch_offer_on_pack_size_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pack_size_override IS DISTINCT FROM OLD.pack_size_override THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_offer_on_pack_size_change ON public.offers;
CREATE TRIGGER trg_touch_offer_on_pack_size_change
BEFORE UPDATE OF pack_size_override ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.touch_offer_on_pack_size_change();

-- 2) Quand products.pack_size change → toucher toutes les offres rattachées
--    qui n'ont PAS d'override (donc effectivement impactées par le fallback)
CREATE OR REPLACE FUNCTION public.cascade_pack_size_to_offers()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pack_size IS DISTINCT FROM OLD.pack_size THEN
    UPDATE public.offers
       SET updated_at = now()
     WHERE product_id = NEW.id
       AND pack_size_override IS NULL;

    UPDATE public.external_offers
       SET updated_at = now()
     WHERE product_id = NEW.id
       AND pack_size_override IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_pack_size_to_offers ON public.products;
CREATE TRIGGER trg_cascade_pack_size_to_offers
AFTER UPDATE OF pack_size ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.cascade_pack_size_to_offers();

COMMENT ON FUNCTION public.touch_offer_on_pack_size_change() IS
  'Force updated_at sur offers quand pack_size_override change → invalide caches downstream et signale aux jobs de resync que le prix unitaire normalisé doit être recalculé.';

COMMENT ON FUNCTION public.cascade_pack_size_to_offers() IS
  'Quand products.pack_size change, touche updated_at de toutes les offres (vendeurs + externes) qui dépendent du fallback produit, pour propager le nouveau prix unitaire.';