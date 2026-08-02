-- 1) Nettoyage préalable : ne garder que le 'spend' le plus ancien par commande
WITH dups AS (
  SELECT id,
         row_number() OVER (PARTITION BY order_id ORDER BY created_at, id) AS rn
  FROM public.cagnotte_ledger
  WHERE movement_type = 'spend' AND order_id IS NOT NULL
)
DELETE FROM public.cagnotte_ledger l
USING dups
WHERE l.id = dups.id AND dups.rn > 1;

-- 2) Contrainte d'unicité : un seul 'spend' par commande, garantie côté base
CREATE UNIQUE INDEX IF NOT EXISTS idx_cagnotte_spend_unique_order
  ON public.cagnotte_ledger (order_id)
  WHERE movement_type = 'spend' AND order_id IS NOT NULL;