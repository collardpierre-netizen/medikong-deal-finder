ALTER TABLE public.flash_deals
  ADD COLUMN IF NOT EXISTS public_price_incl_vat numeric,
  ADD COLUMN IF NOT EXISTS quantity_total integer,
  ADD COLUMN IF NOT EXISTS quantity_sold integer NOT NULL DEFAULT 0;

ALTER TABLE public.flash_deals
  ADD CONSTRAINT flash_deals_quantity_sold_non_negative CHECK (quantity_sold >= 0),
  ADD CONSTRAINT flash_deals_quantity_total_positive CHECK (quantity_total IS NULL OR quantity_total > 0);