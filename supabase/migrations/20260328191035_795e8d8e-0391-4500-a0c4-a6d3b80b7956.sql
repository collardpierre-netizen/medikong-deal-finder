
-- Commission model enum
CREATE TYPE public.commission_model AS ENUM ('fixed_rate', 'tiered_gmv', 'category_based', 'margin_split');

-- Commission rules table
CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  model commission_model NOT NULL DEFAULT 'fixed_rate',
  name text NOT NULL DEFAULT 'Standard',
  is_default boolean NOT NULL DEFAULT false,
  fixed_rate numeric DEFAULT 12,
  tiers jsonb DEFAULT '[]'::jsonb,
  category_rates jsonb DEFAULT '{}'::jsonb,
  margin_split_mk numeric DEFAULT 50,
  margin_split_vendor numeric DEFAULT 50,
  min_commission numeric DEFAULT 0,
  max_commission numeric DEFAULT 100,
  effective_from date DEFAULT CURRENT_DATE,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission rules" ON public.commission_rules
FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendors read own commission rules" ON public.commission_rules
FOR SELECT TO authenticated USING (
  vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
);

CREATE POLICY "Public read default rules" ON public.commission_rules
FOR SELECT TO public USING (is_default = true AND vendor_id IS NULL);
