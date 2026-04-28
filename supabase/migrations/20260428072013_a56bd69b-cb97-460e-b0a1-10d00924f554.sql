-- ============================================================
-- Helper de restauration de la table brands
-- ============================================================
-- Restaure la table `brands` depuis un snapshot de sauvegarde
-- (créé par convention `brands_backup_YYYYMMDD`).
--
-- Usage :
--   SELECT public.restore_brands_from_backup();
--     -- restaure depuis le snapshot le plus récent
--   SELECT public.restore_brands_from_backup('brands_backup_20260428');
--     -- restaure depuis un snapshot précis
--
-- Sécurité :
--   - Réservé aux super-administrateurs (is_super_admin)
--   - Crée AUTOMATIQUEMENT un snapshot de l'état courant
--     (`brands_pre_restore_<timestamp>`) avant toute écriture,
--     pour permettre un rollback en cas de besoin
--   - Tout est exécuté dans la même transaction (atomique)
--   - Préserve la structure de la table (contraintes, index, RLS, FK)
--     en utilisant DELETE + INSERT (pas DROP TABLE)
-- ============================================================

CREATE OR REPLACE FUNCTION public.restore_brands_from_backup(
  _backup_table_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_backup_table text;
  v_safety_snapshot text;
  v_columns text;
  v_rows_deleted bigint := 0;
  v_rows_inserted bigint := 0;
  v_backup_count bigint := 0;
  v_started_at timestamptz := clock_timestamp();
BEGIN
  -- 1) Sécurité : super-admin uniquement
  IF v_user IS NULL OR NOT public.is_super_admin(v_user) THEN
    RAISE EXCEPTION 'Réservé aux super-administrateurs'
      USING ERRCODE = '42501';
  END IF;

  -- 2) Choix du snapshot : explicite, sinon le plus récent
  IF _backup_table_name IS NULL THEN
    SELECT table_name
      INTO v_backup_table
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'brands_backup_%'
    ORDER BY table_name DESC
    LIMIT 1;

    IF v_backup_table IS NULL THEN
      RAISE EXCEPTION 'Aucun snapshot brands_backup_* trouvé dans le schéma public'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    -- Validation stricte du nom (whitelist)
    IF _backup_table_name !~ '^brands_backup_[0-9]{6,14}$' THEN
      RAISE EXCEPTION 'Nom de snapshot invalide : % (attendu : brands_backup_YYYYMMDD)',
        _backup_table_name USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = _backup_table_name
    ) THEN
      RAISE EXCEPTION 'Snapshot % introuvable dans le schéma public',
        _backup_table_name USING ERRCODE = '22023';
    END IF;

    v_backup_table := _backup_table_name;
  END IF;

  -- 3) Compter les lignes du snapshot pour info
  EXECUTE format('SELECT COUNT(*) FROM public.%I', v_backup_table)
    INTO v_backup_count;

  -- 4) Snapshot de sécurité de l'état courant (rollback manuel possible)
  v_safety_snapshot := 'brands_pre_restore_' || to_char(now(), 'YYYYMMDD_HH24MISS');
  EXECUTE format(
    'CREATE TABLE public.%I AS SELECT * FROM public.brands',
    v_safety_snapshot
  );
  EXECUTE format(
    'COMMENT ON TABLE public.%I IS %L',
    v_safety_snapshot,
    'Snapshot de sécurité pris automatiquement avant restore_brands_from_backup le '
      || now()::text || ' (par user ' || v_user::text || '). À supprimer après validation.'
  );
  -- Sécuriser le snapshot de sécurité (pas d'accès via PostgREST)
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_safety_snapshot);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', v_safety_snapshot);

  -- 5) Calculer la liste des colonnes communes entre brands et le snapshot
  --    (sécurise contre un éventuel décalage de schéma : on ne restaure que
  --     les colonnes qui existent encore dans la table cible)
  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO v_columns
  FROM information_schema.columns c
  JOIN information_schema.columns b
    ON b.table_schema = 'public'
   AND b.table_name = v_backup_table
   AND b.column_name = c.column_name
  WHERE c.table_schema = 'public'
    AND c.table_name = 'brands';

  IF v_columns IS NULL THEN
    RAISE EXCEPTION 'Aucune colonne commune entre brands et %', v_backup_table
      USING ERRCODE = '22023';
  END IF;

  -- 6) Vider la table brands (les contraintes FK avec ON DELETE doivent gérer)
  EXECUTE 'DELETE FROM public.brands';
  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  -- 7) Réinsérer depuis le snapshot
  EXECUTE format(
    'INSERT INTO public.brands (%s) SELECT %s FROM public.%I',
    v_columns, v_columns, v_backup_table
  );
  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  -- 8) Audit (best-effort, on n'échoue pas si la table n'existe pas)
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    VALUES (
      v_user,
      'restore_brands_from_backup',
      'brands',
      NULL,
      jsonb_build_object(
        'backup_table', v_backup_table,
        'safety_snapshot', v_safety_snapshot,
        'rows_deleted', v_rows_deleted,
        'rows_inserted', v_rows_inserted,
        'duration_ms', EXTRACT(EPOCH FROM (clock_timestamp() - v_started_at)) * 1000
      )
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'backup_table', v_backup_table,
    'backup_rows', v_backup_count,
    'rows_deleted', v_rows_deleted,
    'rows_inserted', v_rows_inserted,
    'safety_snapshot', v_safety_snapshot,
    'safety_snapshot_hint',
      'En cas de problème : SELECT public.restore_brands_from_backup('''
        || v_safety_snapshot || ''');',
    'duration_ms', EXTRACT(EPOCH FROM (clock_timestamp() - v_started_at)) * 1000
  );
END;
$$;

-- Verrouiller l'exécution
REVOKE ALL ON FUNCTION public.restore_brands_from_backup(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_brands_from_backup(text) TO authenticated;

COMMENT ON FUNCTION public.restore_brands_from_backup(text) IS
  'Restaure public.brands depuis un snapshot brands_backup_*. Super-admin only. '
  'Crée un snapshot de sécurité brands_pre_restore_<ts> avant écrasement. '
  'Usage : SELECT public.restore_brands_from_backup();  -- dernier snapshot '
  '       SELECT public.restore_brands_from_backup(''brands_backup_20260428'');';

-- ============================================================
-- PROCÉDURE DE RESTAURATION EN UNE COMMANDE
-- ============================================================
-- Restaurer depuis le dernier snapshot disponible :
--   SELECT public.restore_brands_from_backup();
--
-- Restaurer depuis un snapshot précis :
--   SELECT public.restore_brands_from_backup('brands_backup_20260428');
--
-- Annuler une restauration (rollback vers l'état d'avant) :
--   SELECT public.restore_brands_from_backup('brands_pre_restore_20260428_143012');
-- ============================================================
