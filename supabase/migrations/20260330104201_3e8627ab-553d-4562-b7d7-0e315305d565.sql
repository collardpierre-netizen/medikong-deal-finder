
-- 1. Countries table
CREATE TABLE public.countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  name_local text,
  flag_emoji text,
  currency text DEFAULT 'EUR',
  default_vat_rate numeric(5,2),
  default_language text,
  is_active boolean DEFAULT false,
  qogita_sync_enabled boolean DEFAULT false,
  last_sync_at timestamp with time zone,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Countries publicly readable" ON public.countries FOR SELECT TO public USING (true);
CREATE POLICY "Admins manage countries" ON public.countries FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Seed countries
INSERT INTO public.countries (code, name, name_local, flag_emoji, currency, default_vat_rate, default_language, is_active, qogita_sync_enabled, display_order) VALUES
  ('BE', 'Belgique', 'België', '🇧🇪', 'EUR', 21.00, 'fr', true, true, 1),
  ('FR', 'France', 'France', '🇫🇷', 'EUR', 20.00, 'fr', true, true, 2),
  ('LU', 'Luxembourg', 'Lëtzebuerg', '🇱🇺', 'EUR', 17.00, 'fr', true, true, 3),
  ('NL', 'Nederland', 'Nederland', '🇳🇱', 'EUR', 21.00, 'nl', false, false, 4),
  ('DE', 'Deutschland', 'Deutschland', '🇩🇪', 'EUR', 19.00, 'de', false, false, 5),
  ('AT', 'Österreich', 'Österreich', '🇦🇹', 'EUR', 20.00, 'de', false, false, 6),
  ('IT', 'Italia', 'Italia', '🇮🇹', 'EUR', 22.00, 'it', false, false, 7),
  ('ES', 'España', 'España', '🇪🇸', 'EUR', 21.00, 'es', false, false, 8);

-- 2. Add country_code to offers
ALTER TABLE public.offers ADD COLUMN country_code text DEFAULT 'BE' REFERENCES public.countries(code);

-- 3. Product country stats table
CREATE TABLE public.product_country_stats (
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  country_code text REFERENCES public.countries(code) ON DELETE CASCADE,
  best_price_excl_vat numeric(10,2),
  best_price_incl_vat numeric(10,2),
  offer_count integer DEFAULT 0,
  total_stock integer DEFAULT 0,
  min_delivery_days integer,
  is_in_stock boolean DEFAULT false,
  PRIMARY KEY (product_id, country_code)
);

ALTER TABLE public.product_country_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product country stats publicly readable" ON public.product_country_stats FOR SELECT TO public USING (true);
CREATE POLICY "Admins manage product_country_stats" ON public.product_country_stats FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- 4. Trigger to update product_country_stats when offers change
CREATE OR REPLACE FUNCTION public.update_product_country_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _product_id uuid;
  _country_code text;
BEGIN
  _product_id := COALESCE(NEW.product_id, OLD.product_id);
  _country_code := COALESCE(NEW.country_code, OLD.country_code);

  INSERT INTO product_country_stats (product_id, country_code, best_price_excl_vat, best_price_incl_vat, offer_count, total_stock, min_delivery_days, is_in_stock)
  VALUES (
    _product_id, _country_code,
    (SELECT MIN(price_excl_vat) FROM offers WHERE product_id = _product_id AND country_code = _country_code AND is_active = true),
    (SELECT MIN(price_incl_vat) FROM offers WHERE product_id = _product_id AND country_code = _country_code AND is_active = true),
    (SELECT COUNT(*) FROM offers WHERE product_id = _product_id AND country_code = _country_code AND is_active = true),
    (SELECT COALESCE(SUM(stock_quantity), 0) FROM offers WHERE product_id = _product_id AND country_code = _country_code AND is_active = true),
    (SELECT MIN(delivery_days) FROM offers WHERE product_id = _product_id AND country_code = _country_code AND is_active = true),
    EXISTS(SELECT 1 FROM offers WHERE product_id = _product_id AND country_code = _country_code AND is_active = true AND stock_quantity > 0)
  )
  ON CONFLICT (product_id, country_code) DO UPDATE SET
    best_price_excl_vat = EXCLUDED.best_price_excl_vat,
    best_price_incl_vat = EXCLUDED.best_price_incl_vat,
    offer_count = EXCLUDED.offer_count,
    total_stock = EXCLUDED.total_stock,
    min_delivery_days = EXCLUDED.min_delivery_days,
    is_in_stock = EXCLUDED.is_in_stock;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_update_product_country_stats
AFTER INSERT OR UPDATE OR DELETE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.update_product_country_stats();

-- 5. Populate product_country_stats from existing offers
INSERT INTO product_country_stats (product_id, country_code, best_price_excl_vat, best_price_incl_vat, offer_count, total_stock, min_delivery_days, is_in_stock)
SELECT
  o.product_id,
  COALESCE(o.country_code, 'BE'),
  MIN(o.price_excl_vat),
  MIN(o.price_incl_vat),
  COUNT(*),
  COALESCE(SUM(o.stock_quantity), 0),
  MIN(o.delivery_days),
  bool_or(o.stock_quantity > 0)
FROM offers o
WHERE o.is_active = true
GROUP BY o.product_id, COALESCE(o.country_code, 'BE')
ON CONFLICT (product_id, country_code) DO NOTHING;
