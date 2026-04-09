
CREATE TABLE public.shipping_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_fr TEXT,
  name_nl TEXT,
  name_de TEXT,
  description TEXT,
  delivery_min_days INTEGER NOT NULL DEFAULT 5,
  delivery_max_days INTEGER NOT NULL DEFAULT 7,
  price_adjustment NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  is_free BOOLEAN NOT NULL DEFAULT false,
  country_code TEXT NOT NULL DEFAULT 'BE',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sendcloud_method_id INTEGER,
  sendcloud_carrier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active shipping options"
ON public.shipping_options FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage shipping options"
ON public.shipping_options FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_shipping_options_updated_at
BEFORE UPDATE ON public.shipping_options
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
