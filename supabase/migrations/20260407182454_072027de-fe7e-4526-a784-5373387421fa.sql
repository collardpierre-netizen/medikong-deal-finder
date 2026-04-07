
-- 1. Add reference_price and discount_percentage to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reference_price numeric,
  ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0;

-- 2. Create promotion_campaigns table
CREATE TABLE public.promotion_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  banner_image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promotion_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage promotion_campaigns"
  ON public.promotion_campaigns FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Promotion campaigns publicly readable"
  ON public.promotion_campaigns FOR SELECT
  TO public
  USING (true);

CREATE TRIGGER update_promotion_campaigns_updated_at
  BEFORE UPDATE ON public.promotion_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Create flash_deals table
CREATE TABLE public.flash_deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_price_incl_vat numeric NOT NULL,
  original_price_incl_vat numeric NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  label text DEFAULT 'Flash',
  campaign_id uuid REFERENCES public.promotion_campaigns(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flash_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage flash_deals"
  ON public.flash_deals FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Flash deals publicly readable"
  ON public.flash_deals FOR SELECT
  TO public
  USING (true);

CREATE TRIGGER update_flash_deals_updated_at
  BEFORE UPDATE ON public.flash_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Trigger to auto-calculate discount_percentage on products
CREATE OR REPLACE FUNCTION public.calculate_discount_percentage()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.reference_price IS NOT NULL AND NEW.reference_price > 0 AND NEW.best_price_incl_vat IS NOT NULL AND NEW.best_price_incl_vat > 0 THEN
    NEW.discount_percentage := ROUND((1 - NEW.best_price_incl_vat / NEW.reference_price) * 100, 1);
  ELSE
    NEW.discount_percentage := 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_discount_percentage
  BEFORE INSERT OR UPDATE OF best_price_incl_vat, reference_price ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.calculate_discount_percentage();

-- 5. Index for promotions page queries
CREATE INDEX idx_products_discount ON public.products (discount_percentage DESC)
  WHERE discount_percentage >= 10 AND reference_price IS NOT NULL AND is_active = true;
