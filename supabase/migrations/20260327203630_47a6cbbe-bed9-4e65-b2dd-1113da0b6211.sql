
-- Drop existing tables that will be replaced
DROP TABLE IF EXISTS public.cart_items CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;

-- Create product_status enum
DO $$ BEGIN
  CREATE TYPE public.product_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create suggestion_status enum
DO $$ BEGIN
  CREATE TYPE public.suggestion_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create report_type enum
DO $$ BEGIN
  CREATE TYPE public.report_type AS ENUM ('wrong_name', 'wrong_image', 'wrong_category', 'wrong_brand', 'duplicate', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create report_status enum
DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('open', 'in_review', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create reporter_role enum
DO $$ BEGIN
  CREATE TYPE public.reporter_role AS ENUM ('seller', 'buyer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Products table (PIM master)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gtin VARCHAR(14) UNIQUE NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  mpn VARCHAR(100),
  category_l1 VARCHAR(100) NOT NULL,
  category_l2 VARCHAR(100) NOT NULL,
  category_l3 VARCHAR(100) NOT NULL,
  category_l4 VARCHAR(100),
  description_short TEXT,
  ingredients TEXT,
  weight_g DECIMAL NOT NULL,
  height_cm DECIMAL,
  width_cm DECIMAL,
  depth_cm DECIMAL,
  primary_image_url TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
  secondary_images JSONB DEFAULT '[]'::jsonb,
  rrp_eur DECIMAL,
  status public.product_status DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sellers table
CREATE TABLE public.sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  company_registration VARCHAR(100),
  vat_number VARCHAR(50),
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  country CHAR(2) NOT NULL DEFAULT 'BE',
  is_verified BOOLEAN DEFAULT false,
  is_top_rated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Offers table
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  unit_price_eur DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  mov_eur DECIMAL(10,2) NOT NULL,
  bundle_size INTEGER NOT NULL DEFAULT 1,
  delivery_days INTEGER NOT NULL DEFAULT 5,
  ship_from_country CHAR(2) NOT NULL DEFAULT 'BE',
  price_tiers JSONB,
  is_active BOOLEAN DEFAULT true,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, seller_id)
);

-- Product suggestions table
CREATE TABLE public.product_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
  gtin VARCHAR(14) NOT NULL,
  suggested_name VARCHAR(255),
  suggested_brand VARCHAR(100),
  suggested_category VARCHAR(255),
  suggested_image_url TEXT,
  notes TEXT,
  status public.suggestion_status DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Product reports table
CREATE TABLE public.product_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  reporter_id UUID,
  reporter_role public.reporter_role DEFAULT 'buyer',
  report_type public.report_type NOT NULL,
  description TEXT NOT NULL,
  status public.report_status DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reports ENABLE ROW LEVEL SECURITY;

-- Products RLS: public read for active products
CREATE POLICY "Products are publicly readable" ON public.products FOR SELECT USING (true);

-- Offers RLS: public read for active offers
CREATE POLICY "Offers are publicly readable" ON public.offers FOR SELECT USING (true);
CREATE POLICY "Sellers can insert own offers" ON public.offers FOR INSERT WITH CHECK (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "Sellers can update own offers" ON public.offers FOR UPDATE USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "Sellers can delete own offers" ON public.offers FOR DELETE USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

-- Sellers RLS: public read
CREATE POLICY "Sellers are publicly readable" ON public.sellers FOR SELECT USING (true);
CREATE POLICY "Users can insert own seller profile" ON public.sellers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own seller profile" ON public.sellers FOR UPDATE USING (user_id = auth.uid());

-- Product suggestions RLS
CREATE POLICY "Suggestions are readable by creator" ON public.product_suggestions FOR SELECT USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "Verified sellers can insert suggestions" ON public.product_suggestions FOR INSERT WITH CHECK (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid() AND is_verified = true));

-- Product reports RLS
CREATE POLICY "Reports are readable by creator" ON public.product_reports FOR SELECT USING (reporter_id = auth.uid());
CREATE POLICY "Authenticated users can create reports" ON public.product_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Updated_at trigger for products
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Updated_at trigger for offers (last_updated)
CREATE OR REPLACE FUNCTION public.update_offer_last_updated() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.last_updated = now(); RETURN NEW; END; $$;
CREATE TRIGGER update_offers_last_updated BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.update_offer_last_updated();
