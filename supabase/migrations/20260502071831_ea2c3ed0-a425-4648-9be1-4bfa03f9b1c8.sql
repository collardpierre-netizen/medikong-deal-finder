-- Supprime l'index unique redondant (vendor_id, product_id) qui entre en conflit
-- avec l'upsert de l'import vendeur (clé (product_id, vendor_id, country_code)).
-- L'index canonique offers_product_vendor_country_unique couvre déjà la règle :
-- "un vendeur ne peut avoir qu'une offre par produit ET par pays".
DROP INDEX IF EXISTS public.uniq_offers_vendor_product;