-- 1) Désactiver toutes les offres catch-all existantes du vendeur virtuel qogita-best-price
UPDATE public.offers o
SET
  is_active = false,
  admin_hidden = true,
  admin_hidden_at = COALESCE(admin_hidden_at, now()),
  admin_hidden_reason = COALESCE(admin_hidden_reason,
    'Offre Qogita catch-all (best-price sans FID vendeur identifié) — masquée automatiquement pour ne plus afficher de vendeur anonyme.')
FROM public.vendors v
WHERE o.vendor_id = v.id
  AND v.slug = 'qogita-best-price'
  AND (o.admin_hidden IS DISTINCT FROM true OR o.is_active = true);

-- 2) Trigger : empêcher toute nouvelle offre active du vendeur virtuel qogita-best-price
CREATE OR REPLACE FUNCTION public.block_qogita_best_price_catchall()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
BEGIN
  SELECT slug INTO v_slug FROM public.vendors WHERE id = NEW.vendor_id;
  IF v_slug = 'qogita-best-price' THEN
    NEW.is_active := false;
    NEW.admin_hidden := true;
    IF NEW.admin_hidden_at IS NULL THEN NEW.admin_hidden_at := now(); END IF;
    IF NEW.admin_hidden_reason IS NULL THEN
      NEW.admin_hidden_reason := 'Offre catch-all Qogita bloquée automatiquement (politique anti-vendeur anonyme).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_qogita_best_price_catchall ON public.offers;
CREATE TRIGGER trg_block_qogita_best_price_catchall
BEFORE INSERT OR UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.block_qogita_best_price_catchall();