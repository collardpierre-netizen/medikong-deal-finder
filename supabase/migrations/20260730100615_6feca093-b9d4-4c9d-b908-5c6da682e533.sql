-- 1) Medista = distributeur autorisé (mandat réel à renseigner par l'admin, pas de fausse date)
UPDATE public.vendors
   SET is_authorized_distributor = true
 WHERE id = 'dc577ab0-3422-4daa-9052-d5999333880e';

-- 2) Champs de ventilation de marge (non branchés, stockage seulement)
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS margin_share_medista_pct numeric,
  ADD COLUMN IF NOT EXISTS margin_share_medikong_pct numeric;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS margin_share_medista_pct numeric,
  ADD COLUMN IF NOT EXISTS margin_share_medikong_pct numeric;

COMMENT ON COLUMN public.offers.margin_share_medista_pct IS 'Part de la marge revenant à Medista (%). Répartition non encore appliquée.';
COMMENT ON COLUMN public.offers.margin_share_medikong_pct IS 'Part de la marge revenant à MediKong (%). Répartition non encore appliquée.';