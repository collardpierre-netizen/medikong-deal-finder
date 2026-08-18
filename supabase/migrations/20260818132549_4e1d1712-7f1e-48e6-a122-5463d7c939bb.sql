ALTER TABLE public.flash_deals
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_flash_deals_vendor_id ON public.flash_deals(vendor_id);
CREATE INDEX IF NOT EXISTS idx_flash_deals_offer_id ON public.flash_deals(offer_id);

CREATE OR REPLACE FUNCTION public._flash_deals_validate_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer_product uuid;
  v_offer_vendor uuid;
BEGIN
  IF NEW.offer_id IS NOT NULL THEN
    SELECT product_id, vendor_id INTO v_offer_product, v_offer_vendor
    FROM public.offers WHERE id = NEW.offer_id;

    IF v_offer_product IS NULL THEN
      RAISE EXCEPTION 'Offre introuvable pour cette vente flash';
    END IF;
    IF v_offer_product <> NEW.product_id THEN
      RAISE EXCEPTION 'L''offre ciblée n''appartient pas au produit de la vente flash';
    END IF;
    IF NEW.vendor_id IS NULL THEN
      NEW.vendor_id := v_offer_vendor;
    ELSIF NEW.vendor_id <> v_offer_vendor THEN
      RAISE EXCEPTION 'L''offre ciblée n''appartient pas au fournisseur indiqué';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flash_deals_validate_target ON public.flash_deals;
CREATE TRIGGER trg_flash_deals_validate_target
  BEFORE INSERT OR UPDATE OF product_id, vendor_id, offer_id ON public.flash_deals
  FOR EACH ROW EXECUTE FUNCTION public._flash_deals_validate_target();