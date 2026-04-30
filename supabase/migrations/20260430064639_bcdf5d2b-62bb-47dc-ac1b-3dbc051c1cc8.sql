-- Supprime la contrainte unique obsolète qui bloque les offres multi-pays
-- La contrainte offers_product_vendor_country_unique (product_id, vendor_id, country_code) couvre déjà l'unicité correcte
ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_product_vendor_unique;