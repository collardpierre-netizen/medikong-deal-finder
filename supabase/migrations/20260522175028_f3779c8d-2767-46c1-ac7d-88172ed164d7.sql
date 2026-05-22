
CREATE TABLE IF NOT EXISTS public.media_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  partner_name text,
  title text,
  subtitle text,
  cta_label text,
  cta_url text,
  logo_url text,
  scope text NOT NULL DEFAULT 'all' CHECK (scope IN ('all','brand','manufacturer')),
  target_brand_ids uuid[] NOT NULL DEFAULT '{}',
  target_manufacturer_ids uuid[] NOT NULL DEFAULT '{}',
  priority integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_banners_enabled_scope
  ON public.media_banners (enabled, scope, priority DESC);
CREATE INDEX IF NOT EXISTS idx_media_banners_target_brand
  ON public.media_banners USING GIN (target_brand_ids);
CREATE INDEX IF NOT EXISTS idx_media_banners_target_manufacturer
  ON public.media_banners USING GIN (target_manufacturer_ids);

DROP TRIGGER IF EXISTS trg_media_banners_updated_at ON public.media_banners;
CREATE TRIGGER trg_media_banners_updated_at
  BEFORE UPDATE ON public.media_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.media_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_banners_public_read_active" ON public.media_banners;
CREATE POLICY "media_banners_public_read_active"
  ON public.media_banners FOR SELECT TO anon, authenticated
  USING (
    enabled = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >= now())
  );

DROP POLICY IF EXISTS "media_banners_admin_read_all" ON public.media_banners;
CREATE POLICY "media_banners_admin_read_all"
  ON public.media_banners FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "media_banners_admin_write" ON public.media_banners;
CREATE POLICY "media_banners_admin_write"
  ON public.media_banners FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.pick_media_banner(
  p_brand_id uuid DEFAULT NULL,
  p_manufacturer_id uuid DEFAULT NULL
)
RETURNS public.media_banners
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.media_banners
  WHERE enabled = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >= now())
    AND (
      scope = 'all'
      OR (scope = 'brand'        AND p_brand_id        IS NOT NULL AND p_brand_id        = ANY(target_brand_ids))
      OR (scope = 'manufacturer' AND p_manufacturer_id IS NOT NULL AND p_manufacturer_id = ANY(target_manufacturer_ids))
    )
  ORDER BY
    CASE scope WHEN 'all' THEN 1 ELSE 0 END,
    priority DESC,
    created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.pick_media_banner(uuid, uuid) TO anon, authenticated;

DO $$
DECLARE v_sc RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.media_banners WHERE scope = 'all') THEN
    SELECT
      media_banner_enabled,
      media_banner_title,
      media_banner_subtitle,
      media_banner_cta_label,
      media_banner_cta_url
    INTO v_sc
    FROM public.site_config
    WHERE id = 1;

    IF FOUND AND v_sc.media_banner_cta_url IS NOT NULL THEN
      INSERT INTO public.media_banners (
        name, enabled, partner_name,
        title, subtitle, cta_label, cta_url,
        scope, priority
      ) VALUES (
        'Balooh — bandeau global (migré depuis site_config)',
        COALESCE(v_sc.media_banner_enabled, true),
        'Balooh',
        v_sc.media_banner_title,
        v_sc.media_banner_subtitle,
        v_sc.media_banner_cta_label,
        v_sc.media_banner_cta_url,
        'all',
        0
      );
    END IF;
  END IF;
END $$;
