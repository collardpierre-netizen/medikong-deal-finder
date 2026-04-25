-- Clés API pour partenaires externes (concurrents qui poussent leurs offres)
CREATE TABLE public.external_vendor_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_vendor_id UUID NOT NULL REFERENCES public.external_vendors(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  label TEXT,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_external_vendor_api_keys_hash ON public.external_vendor_api_keys(key_hash) WHERE is_active = true;

ALTER TABLE public.external_vendor_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage external API keys"
ON public.external_vendor_api_keys
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Logs d'import pour audit
CREATE TABLE public.external_offers_import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_vendor_id UUID NOT NULL REFERENCES public.external_vendors(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.external_vendor_api_keys(id) ON DELETE SET NULL,
  rows_received INTEGER NOT NULL DEFAULT 0,
  rows_matched INTEGER NOT NULL DEFAULT 0,
  rows_unmatched INTEGER NOT NULL DEFAULT 0,
  rows_upserted INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  unmatched_gtins JSONB DEFAULT '[]'::jsonb,
  errors JSONB DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'api',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_external_import_logs_vendor ON public.external_offers_import_logs(external_vendor_id, created_at DESC);

ALTER TABLE public.external_offers_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read import logs"
ON public.external_offers_import_logs
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role writes import logs"
ON public.external_offers_import_logs
FOR INSERT
WITH CHECK (true);

-- Unicité (vendor + product) pour permettre upsert sur push API
CREATE UNIQUE INDEX IF NOT EXISTS uniq_external_offer_vendor_product
  ON public.external_offers(external_vendor_id, product_id);