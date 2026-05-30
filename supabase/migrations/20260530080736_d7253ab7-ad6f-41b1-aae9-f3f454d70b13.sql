ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS source_supplier text;
COMMENT ON COLUMN public.offers.source_supplier IS 'Nom du fournisseur source du vendeur (ex: Quirumed) — usage interne vendeur pour repasser commande.';
CREATE INDEX IF NOT EXISTS idx_offers_source_supplier ON public.offers (source_supplier) WHERE source_supplier IS NOT NULL;