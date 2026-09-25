ALTER TABLE public.product_market_codes
  ADD CONSTRAINT pmc_level_chk CHECK (packaging_level IS NULL OR packaging_level IN ('unit','pack','carton','unknown')),
  ADD CONSTRAINT pmc_source_chk CHECK (source IS NULL OR source IN ('fiche','scan','import_febelco','admin'));
ALTER TABLE public.product_market_codes ALTER COLUMN packaging_level SET DEFAULT 'unknown';