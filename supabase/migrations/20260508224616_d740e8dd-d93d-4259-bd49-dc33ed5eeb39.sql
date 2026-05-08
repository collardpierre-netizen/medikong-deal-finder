CREATE TABLE IF NOT EXISTS public.home_showcase_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  pinned_product_id uuid NULL REFERENCES public.products(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

INSERT INTO public.home_showcase_settings (id, pinned_product_id)
VALUES (true, 'bf295fc4-e87f-488b-8936-f394c3f8feac')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.home_showcase_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_showcase_settings_public_read" ON public.home_showcase_settings;
CREATE POLICY "home_showcase_settings_public_read"
ON public.home_showcase_settings
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "home_showcase_settings_admin_write" ON public.home_showcase_settings;
CREATE POLICY "home_showcase_settings_admin_write"
ON public.home_showcase_settings
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_home_showcase_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_home_showcase_settings ON public.home_showcase_settings;
CREATE TRIGGER trg_touch_home_showcase_settings
BEFORE UPDATE ON public.home_showcase_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_home_showcase_settings();