
-- Brand priority tiers for scraper (0 = normal, 1 = dermocosmetics priority seed)
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS is_priority integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_brands_is_priority ON public.brands(is_priority) WHERE is_priority > 0;

-- Denorm on products for cheap sort in the storefront scraper (no nested-nested order in PostgREST)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_priority integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_products_brand_priority ON public.products(brand_priority) WHERE brand_priority > 0;

-- Keep products.brand_priority in sync with brands.is_priority
CREATE OR REPLACE FUNCTION public.sync_products_brand_priority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_priority IS DISTINCT FROM OLD.is_priority THEN
    UPDATE public.products SET brand_priority = NEW.is_priority WHERE brand_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brands_sync_priority ON public.brands;
CREATE TRIGGER trg_brands_sync_priority
AFTER UPDATE OF is_priority ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.sync_products_brand_priority();

CREATE OR REPLACE FUNCTION public.sync_product_brand_priority_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.brand_id IS NOT NULL THEN
    SELECT COALESCE(is_priority, 0) INTO NEW.brand_priority FROM public.brands WHERE id = NEW.brand_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_sync_brand_priority ON public.products;
CREATE TRIGGER trg_products_sync_brand_priority
BEFORE INSERT OR UPDATE OF brand_id ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_product_brand_priority_on_insert();

-- Seed: 25 dermocosmetics brands (tier 1)
UPDATE public.brands SET is_priority = 1
WHERE id IN (
  'bd516948-b1ea-4e85-a89a-cbb23652e41b', -- A-Derma
  'b03b4b38-cbf4-49a1-a852-0633bb5c2257', -- Avène
  '0c682d89-1e5f-40c4-ac10-0b2e985a4be1', -- Bioderma
  '27061835-20d3-487d-b612-f6abb06a404a', -- Cattier
  '5259573a-fc0c-4854-9d86-b64e31e46f80', -- Caudalie
  'e49857fa-940b-4c8f-83c6-6479b17b6451', -- Clarins
  'ede91759-2a4d-40b4-a27e-82ca149079f4', -- Ducray
  '640b3884-b606-478f-866a-f2d965b7dba5', -- Elancyl
  'da819232-7f9c-423a-9a0b-dab2cf550086', -- Embryolisse
  'efc01e5d-2e5b-45da-ab62-f6b522c6677c', -- Eucerin
  'b1e79a33-b158-403a-aa19-203adeda0ef8', -- Filorga
  '5c4091bc-aa25-48e1-af75-aea0e7abd60d', -- ISDIN
  '4d463910-b340-446c-a281-064a10d7cd43', -- Klorane
  'd0d7c202-27b1-492a-9fc7-687710fbb51c', -- La Roche-Posay
  '81bbe8d7-b102-4041-a93e-c03f8a2aef57', -- Lierac
  'daa41643-f0ea-403c-9462-8e329aaa2bd0', -- Mustela
  '0d20c515-9504-4668-bdd8-745127bfb010', -- Nuxe
  '3594cb11-c85e-43e1-b91a-ab00421b4cc6', -- Pierre Fabre
  '452652bf-e8d8-4766-a3e4-84ab94260e82', -- Roger&Gallet
  'f8aac15a-3302-4f02-b578-fa23de718676', -- Sanoflore
  'c1126bc4-bc9a-42e3-8636-05995106fe9a', -- SVR
  '9254f0be-5f7a-4f6b-bfe2-1edb6fdeb8e4', -- Uriage
  '477b2f9f-34f8-4c59-99ad-71cf867fbd91', -- Vichy
  'f12dc78a-a670-470c-8904-abd3f44b5768'  -- Weleda
);

-- Backfill products.brand_priority
UPDATE public.products p
SET brand_priority = b.is_priority
FROM public.brands b
WHERE p.brand_id = b.id AND p.brand_priority <> b.is_priority;
