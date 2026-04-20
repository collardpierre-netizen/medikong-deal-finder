-- Bucket privé pour cache CSV de sync
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('sync-cache', 'sync-cache', false, 524288000)  -- 500 MB
ON CONFLICT (id) DO NOTHING;

-- RLS: aucun accès anonyme/authentifié — uniquement service_role
CREATE POLICY "Admins peuvent voir le cache de sync"
ON storage.objects FOR SELECT
USING (bucket_id = 'sync-cache' AND public.is_admin(auth.uid()));

-- Colonnes de progression chunked dans sync_logs (nullable pour rétrocompatibilité)
ALTER TABLE public.sync_logs
  ADD COLUMN IF NOT EXISTS chunk_state jsonb;

COMMENT ON COLUMN public.sync_logs.chunk_state IS 'État du traitement par chunks : { csv_path, next_offset, total_lines, brands_seen[], categories_seen[], processed }';