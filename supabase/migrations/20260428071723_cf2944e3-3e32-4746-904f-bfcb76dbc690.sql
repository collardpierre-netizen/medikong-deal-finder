-- ============================================================
-- Infrastructure d'export manuel de la base — 2026-04-28
-- ============================================================

-- 1) Bucket privé pour stocker les dumps SQL
INSERT INTO storage.buckets (id, name, public)
VALUES ('db-backups', 'db-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Policies : lecture/écriture réservées aux admins
DROP POLICY IF EXISTS "Admins can read db backups" ON storage.objects;
CREATE POLICY "Admins can read db backups"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'db-backups' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can write db backups" ON storage.objects;
CREATE POLICY "Admins can write db backups"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'db-backups' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete db backups" ON storage.objects;
CREATE POLICY "Admins can delete db backups"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'db-backups' AND public.is_admin(auth.uid()));

-- 2) Table de log des exports
CREATE TABLE IF NOT EXISTS public.db_backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  tables_included text[] NOT NULL DEFAULT '{}',
  total_rows bigint NOT NULL DEFAULT 0,
  size_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.db_backup_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read backup logs" ON public.db_backup_logs;
CREATE POLICY "Admins can read backup logs"
  ON public.db_backup_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert backup logs" ON public.db_backup_logs;
CREATE POLICY "Admins can insert backup logs"
  ON public.db_backup_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_db_backup_logs_created_at
  ON public.db_backup_logs(created_at DESC);

-- 3) Fonction qui sérialise une table en INSERT SQL (admin only)
--    Retourne un texte du type :
--    INSERT INTO public.<table> (col1, col2, ...) VALUES (...);
--    INSERT INTO public.<table> (col1, col2, ...) VALUES (...);
--    ...
CREATE OR REPLACE FUNCTION public.export_table_as_sql(_table_name text)
RETURNS TABLE(sql_line text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_columns text;
  v_query text;
BEGIN
  -- Sécurité : admin uniquement
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  -- Whitelist : uniquement les tables du schéma public
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name = _table_name
  ) THEN
    RAISE EXCEPTION 'Table % introuvable dans le schéma public', _table_name
      USING ERRCODE = '22023';
  END IF;

  -- Liste des colonnes (ordonnées)
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = _table_name;

  -- Construit dynamiquement un SELECT qui produit les INSERT
  v_query := format(
    'SELECT ''INSERT INTO public.%I (%s) VALUES ('' ||
       (SELECT string_agg(
          CASE WHEN v IS NULL THEN ''NULL''
               ELSE quote_literal(v::text) END,
          '', '' ORDER BY ord)
        FROM jsonb_each_text(to_jsonb(t)) WITH ORDINALITY AS j(k, v, ord))
     || '');''
     FROM public.%I AS t',
    _table_name, v_columns, _table_name
  );

  RETURN QUERY EXECUTE v_query;
END;
$$;

REVOKE ALL ON FUNCTION public.export_table_as_sql(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_table_as_sql(text) TO authenticated;
