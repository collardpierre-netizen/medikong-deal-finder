
CREATE INDEX IF NOT EXISTS idx_products_active_offer_count ON public.products (offer_count DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_active_price ON public.products (best_price_excl_vat ASC NULLS LAST) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products (brand_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories (slug);
CREATE INDEX IF NOT EXISTS idx_brands_slug ON public.brands (slug);
