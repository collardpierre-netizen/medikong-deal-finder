-- Garde-fou base : empêche les conditionnements incohérents sur les offres
-- (négatif, zéro, > 10 000) sans bloquer les NULL (override optionnel).
-- Symétrique pour products.pack_size côté fiche produit.

ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_pack_size_override_sane;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_pack_size_override_sane
  CHECK (pack_size_override IS NULL OR (pack_size_override >= 1 AND pack_size_override <= 10000));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_pack_size_sane;
ALTER TABLE public.products
  ADD CONSTRAINT products_pack_size_sane
  CHECK (pack_size IS NULL OR (pack_size >= 1 AND pack_size <= 10000));