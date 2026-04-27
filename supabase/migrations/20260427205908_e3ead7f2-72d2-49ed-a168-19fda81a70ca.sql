-- Enum pour le mode de resync
DO $$ BEGIN
  CREATE TYPE public.qogita_resync_mode AS ENUM (
    'daily_stale_refresh',
    'mute_detection',
    'incremental',
    'full',
    'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum pour le statut
DO $$ BEGIN
  CREATE TYPE public.qogita_resync_status AS ENUM (
    'running',
    'success',
    'partial',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table principale
CREATE TABLE IF NOT EXISTS public.qogita_resync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mode public.qogita_resync_mode NOT NULL,
  status public.qogita_resync_status NOT NULL DEFAULT 'running',
  triggered_by TEXT,
  country_code TEXT DEFAULT 'BE',

  -- Compteurs produits / offres
  products_targeted INTEGER NOT NULL DEFAULT 0,
  products_processed INTEGER NOT NULL DEFAULT 0,
  mute_products_detected INTEGER NOT NULL DEFAULT 0,
  offers_processed INTEGER NOT NULL DEFAULT 0,
  offers_updated INTEGER NOT NULL DEFAULT 0,
  offers_created INTEGER NOT NULL DEFAULT 0,
  offers_deactivated INTEGER NOT NULL DEFAULT 0,
  tiers_synced INTEGER NOT NULL DEFAULT 0,

  -- Erreurs par endpoint Qogita
  -- Format: { "/v4/products/": { "count": 3, "last_status": 502, "last_error": "...", "samples": [...] } }
  errors_by_endpoint JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_errors INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,

  -- Métadonnées libres (batch_id, sync_log_id parent, etc.)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Temps
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_qogita_resync_logs_mode_started
  ON public.qogita_resync_logs (mode, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_qogita_resync_logs_status_started
  ON public.qogita_resync_logs (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_qogita_resync_logs_started
  ON public.qogita_resync_logs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_qogita_resync_logs_errors_gin
  ON public.qogita_resync_logs USING GIN (errors_by_endpoint);

-- RLS
ALTER TABLE public.qogita_resync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read qogita_resync_logs"
ON public.qogita_resync_logs
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role can insert qogita_resync_logs"
ON public.qogita_resync_logs
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update qogita_resync_logs"
ON public.qogita_resync_logs
FOR UPDATE
USING (auth.role() = 'service_role');

-- Helper RPC pour clôturer un run et calculer la durée
CREATE OR REPLACE FUNCTION public.finalize_qogita_resync_log(
  _id uuid,
  _status public.qogita_resync_status,
  _stats jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started timestamptz;
BEGIN
  SELECT started_at INTO v_started FROM public.qogita_resync_logs WHERE id = _id;
  IF v_started IS NULL THEN RETURN; END IF;

  UPDATE public.qogita_resync_logs
  SET status = _status,
      completed_at = now(),
      duration_ms = EXTRACT(EPOCH FROM (now() - v_started))::int * 1000,
      products_targeted   = COALESCE((_stats->>'products_targeted')::int,   products_targeted),
      products_processed  = COALESCE((_stats->>'products_processed')::int,  products_processed),
      mute_products_detected = COALESCE((_stats->>'mute_products_detected')::int, mute_products_detected),
      offers_processed    = COALESCE((_stats->>'offers_processed')::int,    offers_processed),
      offers_updated      = COALESCE((_stats->>'offers_updated')::int,      offers_updated),
      offers_created      = COALESCE((_stats->>'offers_created')::int,      offers_created),
      offers_deactivated  = COALESCE((_stats->>'offers_deactivated')::int,  offers_deactivated),
      tiers_synced        = COALESCE((_stats->>'tiers_synced')::int,        tiers_synced),
      errors_by_endpoint  = COALESCE(_stats->'errors_by_endpoint',          errors_by_endpoint),
      total_errors        = COALESCE((_stats->>'total_errors')::int,        total_errors),
      error_message       = COALESCE(_stats->>'error_message',              error_message),
      metadata            = COALESCE(_stats->'metadata',                    metadata)
  WHERE id = _id;
END;
$$;