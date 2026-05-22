
DO $$ BEGIN
  CREATE TYPE public.guarantee_acceptance_source AS ENUM ('onboarding', 'backfill', 'admin_override');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.marketplace_guarantee_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  bullet_points TEXT[] NOT NULL DEFAULT '{}',
  published_at TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_guarantee_is_current
  ON public.marketplace_guarantee_versions (is_current) WHERE is_current = true;

ALTER TABLE public.marketplace_guarantee_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published guarantee versions" ON public.marketplace_guarantee_versions;
CREATE POLICY "Public can read published guarantee versions"
  ON public.marketplace_guarantee_versions FOR SELECT
  USING (published_at IS NOT NULL);

DROP POLICY IF EXISTS "Admins manage guarantee versions" ON public.marketplace_guarantee_versions;
CREATE POLICY "Admins manage guarantee versions"
  ON public.marketplace_guarantee_versions FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_guarantee_versions_updated_at ON public.marketplace_guarantee_versions;
CREATE TRIGGER trg_guarantee_versions_updated_at
  BEFORE UPDATE ON public.marketplace_guarantee_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.vendor_guarantee_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  guarantee_version_id UUID NOT NULL REFERENCES public.marketplace_guarantee_versions(id) ON DELETE RESTRICT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_by_user_id UUID,
  ip TEXT,
  user_agent TEXT,
  source public.guarantee_acceptance_source NOT NULL DEFAULT 'onboarding',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, guarantee_version_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_guarantee_acceptances_vendor
  ON public.vendor_guarantee_acceptances (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_guarantee_acceptances_version
  ON public.vendor_guarantee_acceptances (guarantee_version_id);

ALTER TABLE public.vendor_guarantee_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor reads own acceptances" ON public.vendor_guarantee_acceptances;
CREATE POLICY "Vendor reads own acceptances"
  ON public.vendor_guarantee_acceptances FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_guarantee_acceptances.vendor_id
        AND v.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage acceptances" ON public.vendor_guarantee_acceptances;
CREATE POLICY "Admins manage acceptances"
  ON public.vendor_guarantee_acceptances FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.current_guarantee_version_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.marketplace_guarantee_versions WHERE is_current = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.vendor_has_accepted_current_guarantee(_vendor_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_guarantee_acceptances a
    JOIN public.marketplace_guarantee_versions v ON v.id = a.guarantee_version_id
    WHERE a.vendor_id = _vendor_id AND v.is_current = true
  );
$$;

CREATE OR REPLACE FUNCTION public.vendor_accept_guarantee(_version_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vendor_id UUID;
  v_acceptance_id UUID;
  v_ip TEXT;
  v_ua TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_vendor_id FROM public.vendors WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'No vendor account linked to this user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.marketplace_guarantee_versions
    WHERE id = _version_id AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Guarantee version not found or not published';
  END IF;

  BEGIN
    v_ip := COALESCE(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'cf-connecting-ip'
    );
    v_ua := current_setting('request.headers', true)::json->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL; v_ua := NULL;
  END;

  INSERT INTO public.vendor_guarantee_acceptances (
    vendor_id, guarantee_version_id, accepted_by_user_id, ip, user_agent, source
  ) VALUES (
    v_vendor_id, _version_id, auth.uid(), v_ip, v_ua, 'onboarding'
  )
  ON CONFLICT (vendor_id, guarantee_version_id) DO UPDATE
    SET accepted_at = EXCLUDED.accepted_at,
        accepted_by_user_id = EXCLUDED.accepted_by_user_id,
        ip = EXCLUDED.ip,
        user_agent = EXCLUDED.user_agent
  RETURNING id INTO v_acceptance_id;

  RETURN v_acceptance_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_accept_guarantee(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_guarantee_version_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_has_accepted_current_guarantee(UUID) TO authenticated;

INSERT INTO public.marketplace_guarantee_versions (
  version, title, body_md, bullet_points, published_at, is_current
) VALUES (
  1,
  'Garantie satisfaction et remboursement',
  'Tous les produits vendus sur MediKong sont couverts par notre garantie satisfaction.',
  ARRAY[
    'Produits 100% authentiques et conformes',
    'Remboursement intégral si le produit ne correspond pas à la description',
    'Retour gratuit sous 14 jours pour tout défaut de conformité',
    'Service client disponible pour toute réclamation'
  ],
  now(),
  true
)
ON CONFLICT (version) DO NOTHING;

INSERT INTO public.vendor_guarantee_acceptances (
  vendor_id, guarantee_version_id, accepted_at, source
)
SELECT
  v.id,
  (SELECT id FROM public.marketplace_guarantee_versions WHERE version = 1),
  COALESCE(v.created_at, now()),
  'backfill'::public.guarantee_acceptance_source
FROM public.vendors v
ON CONFLICT (vendor_id, guarantee_version_id) DO NOTHING;
