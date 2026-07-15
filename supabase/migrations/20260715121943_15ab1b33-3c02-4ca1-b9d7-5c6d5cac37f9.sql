ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS peppol_id TEXT;

COMMENT ON COLUMN public.vendors.peppol_id IS
  'Identifiant Peppol du vendeur, ex: 0208:BE0404014205. Obligatoire pour les vendeurs BE afin de recevoir les factures électroniques (facturation électronique obligatoire en Belgique depuis 01/01/2026).';

CREATE INDEX IF NOT EXISTS vendors_peppol_id_missing_be_idx
  ON public.vendors (id)
  WHERE country_code = 'BE' AND peppol_id IS NULL;