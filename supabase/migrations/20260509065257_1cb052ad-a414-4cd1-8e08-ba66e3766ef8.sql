ALTER TABLE public.home_showcase_settings
ADD COLUMN IF NOT EXISTS pinned_product_gtin text,
ADD COLUMN IF NOT EXISTS demo_cta_product_gtin text;

COMMENT ON COLUMN public.home_showcase_settings.pinned_product_gtin IS
'GTIN saisi côté admin pour épingler un produit dans l''encart Comparaison live. Source de vérité éditoriale ; pinned_product_id est résolu à partir de ce GTIN.';
COMMENT ON COLUMN public.home_showcase_settings.demo_cta_product_gtin IS
'GTIN saisi côté admin pour le CTA « Voir un exemple de comparaison ». Source de vérité éditoriale ; demo_cta_product_id en est dérivé.';