
-- ══════════════════════════════════════════════════════════════
-- MEDIKONG V5 — SCHEMA COMPLET — REPARTIR DE ZÉRO
-- ══════════════════════════════════════════════════════════════

-- 1. DROP EXISTING TABLES (reverse dependency order)
DROP TABLE IF EXISTS order_line_sub_orders CASCADE;
DROP TABLE IF EXISTS sub_orders CASCADE;
DROP TABLE IF EXISTS order_lines CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS api_request_logs CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS sourcing_requests CASCADE;
DROP TABLE IF EXISTS sync_logs CASCADE;
DROP TABLE IF EXISTS margin_rules CASCADE;
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS offers_direct CASCADE;
DROP TABLE IF EXISTS offers_indirect CASCADE;
DROP TABLE IF EXISTS offers_market CASCADE;
DROP TABLE IF EXISTS compliance_records CASCADE;
DROP TABLE IF EXISTS disputes CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS buyers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS manufacturers CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS sellers CASCADE;
DROP TABLE IF EXISTS vendor_onboarding CASCADE;
DROP TABLE IF EXISTS commission_rules CASCADE;
DROP TABLE IF EXISTS leads_partners CASCADE;
DROP TABLE IF EXISTS import_jobs CASCADE;
DROP TABLE IF EXISTS impersonation_actions CASCADE;
DROP TABLE IF EXISTS impersonation_sessions CASCADE;
DROP TABLE IF EXISTS invest_subscriptions CASCADE;
DROP TABLE IF EXISTS cms_hero_images CASCADE;
DROP TABLE IF EXISTS onboarding_testimonials CASCADE;
DROP TABLE IF EXISTS qogita_config CASCADE;
DROP TABLE IF EXISTS site_config CASCADE;

-- 2. DROP OLD ENUMS
DROP TYPE IF EXISTS vendor_status CASCADE;
DROP TYPE IF EXISTS vendor_tier CASCADE;
DROP TYPE IF EXISTS product_status CASCADE;
DROP TYPE IF EXISTS commission_model CASCADE;
DROP TYPE IF EXISTS dispute_status CASCADE;
DROP TYPE IF EXISTS buyer_type CASCADE;
DROP TYPE IF EXISTS lead_model CASCADE;
DROP TYPE IF EXISTS mdr_class CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;
DROP TYPE IF EXISTS report_type CASCADE;
DROP TYPE IF EXISTS reporter_role CASCADE;
DROP TYPE IF EXISTS suggestion_status CASCADE;

-- 3. DROP OLD FUNCTIONS (that reference dropped tables)
DROP FUNCTION IF EXISTS search_products CASCADE;
DROP FUNCTION IF EXISTS generate_order_number CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS update_offer_last_updated CASCADE;
DROP FUNCTION IF EXISTS increment_impersonation_actions CASCADE;
DROP FUNCTION IF EXISTS set_updated_at CASCADE;

-- 4. CREATE NEW ENUMS
CREATE TYPE vendor_type AS ENUM ('medikong', 'qogita_virtual', 'real');
CREATE TYPE stock_status_enum AS ENUM ('in_stock', 'low_stock', 'out_of_stock', 'on_demand');
CREATE TYPE product_source AS ENUM ('qogita', 'medikong', 'vendor');
CREATE TYPE customer_type AS ENUM ('pharmacy', 'hospital', 'clinic', 'lab', 'other');
CREATE TYPE order_status AS ENUM ('draft', 'pending', 'confirmed', 'processing', 'partially_shipped', 'shipped', 'delivered', 'cancelled', 'error');
CREATE TYPE order_source AS ENUM ('web', 'api');
CREATE TYPE payment_method_enum AS ENUM ('invoice', 'bank_transfer', 'card');
CREATE TYPE payment_status_enum AS ENUM ('pending', 'paid', 'overdue', 'refunded');
CREATE TYPE fulfillment_type AS ENUM ('qogita', 'medikong_direct', 'vendor_direct');
CREATE TYPE fulfillment_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE sync_type_enum AS ENUM ('full', 'incremental', 'prices', 'categories', 'brands', 'products', 'offers_detail', 'manual');
CREATE TYPE sync_status_enum AS ENUM ('idle', 'running', 'error', 'completed');
CREATE TYPE sync_log_status AS ENUM ('running', 'completed', 'error', 'partial');
CREATE TYPE urgency_enum AS ENUM ('low', 'medium', 'high');
CREATE TYPE sourcing_status AS ENUM ('new', 'reviewing', 'quoted', 'accepted', 'rejected', 'fulfilled');
CREATE TYPE shipping_mode_enum AS ENUM ('direct_to_customer', 'via_warehouse');
CREATE TYPE reshipment_status_enum AS ENUM ('not_applicable', 'awaiting_reception', 'received_at_warehouse', 'repackaging', 'reshipped');

-- ══════════════════════════════════════════════════════════════
-- 5. CREATE TABLES
-- ══════════════════════════════════════════════════════════════

-- ── CONFIGURATION ──
CREATE TABLE qogita_config (
  id integer PRIMARY KEY DEFAULT 1,
  bearer_token text,
  base_url text NOT NULL DEFAULT 'https://api.qogita.com',
  default_country text NOT NULL DEFAULT 'BE',
  sync_enabled boolean NOT NULL DEFAULT true,
  last_full_sync_at timestamptz,
  last_offers_sync_at timestamptz,
  sync_status sync_status_enum NOT NULL DEFAULT 'idle',
  sync_error_message text,
  shipping_mode shipping_mode_enum NOT NULL DEFAULT 'direct_to_customer',
  warehouse_address_line1 text,
  warehouse_address_line2 text,
  warehouse_city text,
  warehouse_postal_code text,
  warehouse_country_code text NOT NULL DEFAULT 'BE',
  warehouse_contact_name text,
  warehouse_contact_phone text,
  CONSTRAINT qogita_config_single_row CHECK (id = 1)
);

CREATE TABLE site_config (
  id integer PRIMARY KEY DEFAULT 1,
  site_name text NOT NULL DEFAULT 'MediKong',
  tagline text NOT NULL DEFAULT 'Le marketplace médical B2B de référence en Belgique',
  default_vat_rate numeric(5,2) NOT NULL DEFAULT 21.00,
  reduced_vat_rate numeric(5,2) NOT NULL DEFAULT 6.00,
  currency text NOT NULL DEFAULT 'EUR',
  country text NOT NULL DEFAULT 'BE',
  display_prices_incl_vat boolean NOT NULL DEFAULT true,
  investment_banner_enabled boolean NOT NULL DEFAULT true,
  investment_banner_text text DEFAULT 'Investissez dans MediKong — Tax Shelter 45% — Levée de fonds Phase 2 ouverte →',
  CONSTRAINT site_config_single_row CHECK (id = 1)
);

-- ── VENDORS ──
CREATE TABLE vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type vendor_type NOT NULL DEFAULT 'real',
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  company_name text,
  vat_number text,
  email text,
  phone text,
  address_line1 text,
  city text,
  postal_code text,
  country_code text NOT NULL DEFAULT 'BE',
  logo_url text,
  description text,
  auth_user_id uuid,
  qogita_seller_alias text UNIQUE,
  commission_rate numeric(5,2) NOT NULL DEFAULT 0.00,
  can_manage_offers boolean NOT NULL DEFAULT false,
  auto_forward_to_qogita boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  rating numeric(3,2),
  total_sales integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── CATEGORIES ──
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qogita_qid text UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  image_url text,
  parent_id uuid REFERENCES categories(id),
  hs_code text,
  vat_rate numeric(5,2),
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  synced_at timestamptz
);

-- ── BRANDS ──
CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qogita_qid text UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  description text,
  product_count integer NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  synced_at timestamptz
);

-- ── PRODUCTS ──
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qogita_qid text UNIQUE,
  qogita_fid text,
  gtin text,
  cnk_code text,
  sku text,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  short_description text,
  label text,
  category_id uuid REFERENCES categories(id),
  brand_id uuid REFERENCES brands(id),
  image_urls text[] DEFAULT '{}',
  dimensions jsonb,
  unit_quantity integer NOT NULL DEFAULT 1,
  origin_country text,
  best_price_excl_vat numeric(10,2),
  best_price_incl_vat numeric(10,2),
  offer_count integer NOT NULL DEFAULT 0,
  total_stock integer NOT NULL DEFAULT 0,
  min_delivery_days integer,
  is_in_stock boolean NOT NULL DEFAULT false,
  source product_source NOT NULL DEFAULT 'medikong',
  is_published boolean NOT NULL DEFAULT true,
  is_promotion boolean NOT NULL DEFAULT false,
  promotion_start_date timestamptz,
  promotion_end_date timestamptz,
  promotion_label text,
  is_active boolean NOT NULL DEFAULT true,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_gtin ON products(gtin);
CREATE INDEX idx_products_cnk ON products(cnk_code);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);

-- ── MARGIN RULES ──
CREATE TABLE margin_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  category_id uuid REFERENCES categories(id),
  brand_id uuid REFERENCES brands(id),
  vendor_id uuid REFERENCES vendors(id),
  min_base_price numeric(10,2),
  max_base_price numeric(10,2),
  margin_percentage numeric(5,2) NOT NULL DEFAULT 15.00,
  extra_delay_days integer NOT NULL DEFAULT 2,
  round_price_to numeric(3,2) NOT NULL DEFAULT 0.01,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── OFFERS ──
CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  vendor_id uuid NOT NULL REFERENCES vendors(id),
  qogita_offer_qid text UNIQUE,
  qogita_base_price numeric(10,2),
  qogita_base_delay_days integer,
  is_qogita_backed boolean NOT NULL DEFAULT false,
  price_excl_vat numeric(10,2) NOT NULL,
  price_incl_vat numeric(10,2) NOT NULL,
  vat_rate numeric(5,2) NOT NULL DEFAULT 21.00,
  moq integer NOT NULL DEFAULT 1,
  mov numeric(10,2),
  stock_quantity integer NOT NULL DEFAULT 0,
  stock_status stock_status_enum NOT NULL DEFAULT 'in_stock',
  delivery_days integer NOT NULL DEFAULT 3,
  shipping_from_country text NOT NULL DEFAULT 'BE',
  price_tiers jsonb,
  applied_margin_rule_id uuid REFERENCES margin_rules(id),
  applied_margin_percentage numeric(5,2),
  margin_amount numeric(10,2),
  is_active boolean NOT NULL DEFAULT true,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_offers_product ON offers(product_id);
CREATE INDEX idx_offers_vendor ON offers(vendor_id);
CREATE UNIQUE INDEX idx_offers_unique ON offers(product_id, vendor_id, qogita_offer_qid);

-- ── CUSTOMERS ──
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  customer_type customer_type NOT NULL DEFAULT 'pharmacy',
  company_name text NOT NULL,
  email text NOT NULL UNIQUE,
  vat_number text,
  phone text,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  postal_code text NOT NULL,
  country_code text NOT NULL DEFAULT 'BE',
  is_verified boolean NOT NULL DEFAULT false,
  is_professional boolean NOT NULL DEFAULT true,
  credit_limit numeric(10,2),
  payment_terms_days integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── API KEYS ──
CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id),
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  rate_limit_per_minute integer NOT NULL DEFAULT 60,
  rate_limit_per_day integer NOT NULL DEFAULT 10000,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id),
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  response_time_ms integer,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_logs_key ON api_request_logs(api_key_id);
CREATE INDEX idx_api_logs_created ON api_request_logs(created_at);

-- ── CART ──
CREATE TABLE cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  offer_id uuid NOT NULL REFERENCES offers(id),
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, offer_id)
);

-- ── ORDERS ──
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  source order_source NOT NULL DEFAULT 'web',
  api_key_id uuid REFERENCES api_keys(id),
  status order_status NOT NULL DEFAULT 'pending',
  subtotal_excl_vat numeric(10,2) NOT NULL DEFAULT 0,
  vat_amount numeric(10,2) NOT NULL DEFAULT 0,
  total_incl_vat numeric(10,2) NOT NULL DEFAULT 0,
  total_cost numeric(10,2),
  total_margin numeric(10,2),
  shipping_address jsonb NOT NULL DEFAULT '{}',
  billing_address jsonb NOT NULL DEFAULT '{}',
  estimated_delivery_date date,
  payment_method payment_method_enum NOT NULL DEFAULT 'invoice',
  payment_status payment_status_enum NOT NULL DEFAULT 'pending',
  payment_due_date date,
  notes text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES offers(id),
  product_id uuid NOT NULL REFERENCES products(id),
  vendor_id uuid NOT NULL REFERENCES vendors(id),
  quantity integer NOT NULL,
  unit_price_excl_vat numeric(10,2) NOT NULL,
  unit_price_incl_vat numeric(10,2) NOT NULL,
  vat_rate numeric(5,2) NOT NULL,
  line_total_excl_vat numeric(10,2) NOT NULL,
  line_total_incl_vat numeric(10,2) NOT NULL,
  cost_price numeric(10,2),
  line_cost numeric(10,2),
  line_margin numeric(10,2),
  fulfillment_type fulfillment_type NOT NULL DEFAULT 'vendor_direct',
  fulfillment_status fulfillment_status NOT NULL DEFAULT 'pending',
  tracking_number text,
  tracking_url text,
  qogita_offer_qid text
);

CREATE TABLE sub_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id),
  fulfillment_type fulfillment_type NOT NULL,
  status fulfillment_status NOT NULL DEFAULT 'pending',
  qogita_cart_qid text,
  qogita_checkout_qid text,
  qogita_order_qid text,
  qogita_order_status text,
  qogita_shipping_mode shipping_mode_enum,
  qogita_shipping_address jsonb,
  reshipment_status reshipment_status_enum DEFAULT 'not_applicable',
  reshipment_tracking_number text,
  reshipment_tracking_url text,
  subtotal_incl_vat numeric(10,2) NOT NULL DEFAULT 0,
  cost_total numeric(10,2),
  margin_total numeric(10,2),
  tracking_number text,
  tracking_url text,
  estimated_delivery_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_line_sub_orders (
  order_line_id uuid PRIMARY KEY REFERENCES order_lines(id) ON DELETE CASCADE,
  sub_order_id uuid NOT NULL REFERENCES sub_orders(id) ON DELETE CASCADE
);

-- ── SOURCING ──
CREATE TABLE sourcing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id),
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  product_description text NOT NULL,
  gtin text,
  cnk_code text,
  quantity_needed integer,
  budget_max numeric(10,2),
  urgency urgency_enum NOT NULL DEFAULT 'medium',
  status sourcing_status NOT NULL DEFAULT 'new',
  admin_notes text,
  quoted_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── SYNC LOGS ──
CREATE TABLE sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type sync_type_enum NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status sync_log_status NOT NULL DEFAULT 'running',
  stats jsonb DEFAULT '{}',
  error_message text
);

-- ══════════════════════════════════════════════════════════════
-- 6. RLS POLICIES
-- ══════════════════════════════════════════════════════════════

ALTER TABLE qogita_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE margin_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_line_sub_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only tables
CREATE POLICY "Admins manage qogita_config" ON qogita_config FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage site_config" ON site_config FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage margin_rules" ON margin_rules FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage api_keys" ON api_keys FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage api_request_logs" ON api_request_logs FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage sync_logs" ON sync_logs FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage sourcing_requests" ON sourcing_requests FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage sub_orders" ON sub_orders FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage order_line_sub_orders" ON order_line_sub_orders FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Public readable tables
CREATE POLICY "Categories publicly readable" ON categories FOR SELECT TO public USING (true);
CREATE POLICY "Admins manage categories" ON categories FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Brands publicly readable" ON brands FOR SELECT TO public USING (true);
CREATE POLICY "Admins manage brands" ON brands FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Products publicly readable" ON products FOR SELECT TO public USING (true);
CREATE POLICY "Admins manage products" ON products FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendors publicly readable" ON vendors FOR SELECT TO public USING (true);
CREATE POLICY "Vendors manage own" ON vendors FOR UPDATE TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "Admins manage vendors" ON vendors FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Offers: public read (excluding internal fields via views), admin full
CREATE POLICY "Offers publicly readable" ON offers FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Vendors manage own offers" ON offers FOR ALL TO authenticated USING (vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins manage offers" ON offers FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Customers
CREATE POLICY "Customers read own" ON customers FOR SELECT TO authenticated USING (auth_user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Customers insert own" ON customers FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Customers update own" ON customers FOR UPDATE TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "Admins manage customers" ON customers FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Cart
CREATE POLICY "Customers manage own cart" ON cart_items FOR ALL TO authenticated USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins manage cart" ON cart_items FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Orders
CREATE POLICY "Customers read own orders" ON orders FOR SELECT TO authenticated USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()));
CREATE POLICY "Customers insert orders" ON orders FOR INSERT TO authenticated WITH CHECK (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins manage orders" ON orders FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Order lines
CREATE POLICY "Customers read own order lines" ON order_lines FOR SELECT TO authenticated USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())));
CREATE POLICY "Admins manage order lines" ON order_lines FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- ══════════════════════════════════════════════════════════════
-- 7. HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════════

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_margin_rules_updated_at BEFORE UPDATE ON margin_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto order number
CREATE OR REPLACE FUNCTION auto_order_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'MK-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;
CREATE TRIGGER trg_auto_order_number BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION auto_order_number();

-- Update product aggregates from offers
CREATE OR REPLACE FUNCTION update_product_aggregates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _product_id uuid;
BEGIN
  _product_id := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE products SET
    best_price_excl_vat = (SELECT MIN(price_excl_vat) FROM offers WHERE product_id = _product_id AND is_active = true),
    best_price_incl_vat = (SELECT MIN(price_incl_vat) FROM offers WHERE product_id = _product_id AND is_active = true),
    offer_count = (SELECT COUNT(*) FROM offers WHERE product_id = _product_id AND is_active = true),
    total_stock = (SELECT COALESCE(SUM(stock_quantity), 0) FROM offers WHERE product_id = _product_id AND is_active = true),
    min_delivery_days = (SELECT MIN(delivery_days) FROM offers WHERE product_id = _product_id AND is_active = true),
    is_in_stock = EXISTS(SELECT 1 FROM offers WHERE product_id = _product_id AND is_active = true AND stock_quantity > 0),
    updated_at = now()
  WHERE id = _product_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_update_product_aggregates AFTER INSERT OR UPDATE OR DELETE ON offers FOR EACH ROW EXECUTE FUNCTION update_product_aggregates();

-- Calculate offer prices for Qogita-backed offers
CREATE OR REPLACE FUNCTION calculate_offer_prices()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rule RECORD;
  _margin numeric;
  _extra_delay integer;
  _round_to numeric;
BEGIN
  IF NOT NEW.is_qogita_backed OR NEW.qogita_base_price IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find best matching margin rule by priority desc
  SELECT * INTO _rule FROM margin_rules
  WHERE is_active = true
    AND (category_id IS NULL OR category_id = (SELECT category_id FROM products WHERE id = NEW.product_id))
    AND (brand_id IS NULL OR brand_id = (SELECT brand_id FROM products WHERE id = NEW.product_id))
    AND (vendor_id IS NULL OR vendor_id = NEW.vendor_id)
    AND (min_base_price IS NULL OR NEW.qogita_base_price >= min_base_price)
    AND (max_base_price IS NULL OR NEW.qogita_base_price <= max_base_price)
  ORDER BY priority DESC
  LIMIT 1;

  IF _rule IS NULL THEN
    _margin := 15.00;
    _extra_delay := 2;
    _round_to := 0.01;
  ELSE
    _margin := _rule.margin_percentage;
    _extra_delay := _rule.extra_delay_days;
    _round_to := _rule.round_price_to;
    NEW.applied_margin_rule_id := _rule.id;
    NEW.applied_margin_percentage := _margin;
  END IF;

  NEW.price_excl_vat := ROUND(NEW.qogita_base_price * (1 + _margin / 100) / _round_to) * _round_to;
  NEW.price_incl_vat := ROUND(NEW.price_excl_vat * (1 + NEW.vat_rate / 100), 2);
  NEW.margin_amount := NEW.price_excl_vat - NEW.qogita_base_price;

  IF NEW.qogita_base_delay_days IS NOT NULL THEN
    NEW.delivery_days := NEW.qogita_base_delay_days + _extra_delay;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_offer_prices BEFORE INSERT OR UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION calculate_offer_prices();

-- Seed initial config rows
INSERT INTO qogita_config (id) VALUES (1);
INSERT INTO site_config (id) VALUES (1);
