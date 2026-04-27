-- ============================================================================
-- 1. Table de configuration des seuils
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bulk_action_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  max_deactivations_per_window integer NOT NULL CHECK (max_deactivations_per_window > 0),
  window_minutes integer NOT NULL DEFAULT 5 CHECK (window_minutes > 0),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bulk_action_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read bulk action limits"
  ON public.bulk_action_limits FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can manage bulk action limits"
  ON public.bulk_action_limits FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_bulk_action_limits_updated_at
  BEFORE UPDATE ON public.bulk_action_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seuils par défaut (Équilibré)
INSERT INTO public.bulk_action_limits (table_name, max_deactivations_per_window, window_minutes, notes)
VALUES
  ('categories', 200, 5, 'Seuil équilibré : protège contre la désactivation accidentelle d''arbres entiers.'),
  ('products',   5000, 5, 'Seuil équilibré : autorise une cascade catégorie → produits raisonnable.'),
  ('offers',     5000, 5, 'Seuil équilibré : protège contre une coupure massive d''offres vendeurs.')
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================================
-- 2. Journal des tentatives bloquées / forcées
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bulk_action_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  user_id uuid,
  user_email text,
  attempted_count integer NOT NULL,
  threshold integer NOT NULL,
  window_minutes integer NOT NULL,
  was_forced boolean NOT NULL DEFAULT false,
  was_blocked boolean NOT NULL DEFAULT true,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulk_violations_user_time
  ON public.bulk_action_violations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_violations_table_time
  ON public.bulk_action_violations (table_name, created_at DESC);

ALTER TABLE public.bulk_action_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read bulk violations"
  ON public.bulk_action_violations FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Pas de policy INSERT/UPDATE : seules les fonctions SECURITY DEFINER écrivent.

-- ============================================================================
-- 3. Helper pour lire le flag d'override de manière sûre
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bulk_override_requested()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  BEGIN
    v := current_setting('app.bulk_override', true);
  EXCEPTION WHEN OTHERS THEN
    v := NULL;
  END;
  RETURN COALESCE(LOWER(v), '') IN ('true', '1', 'yes', 'on');
END;
$$;

-- ============================================================================
-- 4. Compteur de désactivations récentes pour une table donnée + un user
--    Implémenté via une table de tampon léger : on s'appuie sur l'audit log
--    déjà en place (category_bulk_actions) pour les categories+products,
--    et on crée un compteur générique pour les "deactivations live" en
--    utilisant des comptes incrémentaux sur la fenêtre via une table dédiée.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bulk_deactivation_events (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  user_id uuid,
  row_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulk_deact_window
  ON public.bulk_deactivation_events (table_name, user_id, created_at DESC);

ALTER TABLE public.bulk_deactivation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read bulk deactivation events"
  ON public.bulk_deactivation_events FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- 5. Fonction trigger générique : à attacher AFTER UPDATE
--    On ne bloque PAS dans le BEFORE pour limiter le coût (1 SELECT count
--    par UPDATE serait O(n²)). À la place :
--      - on insère un événement par ligne désactivée (cheap)
--      - puis on vérifie le total dans la fenêtre AFTER STATEMENT
--      - si dépassement → on RAISE EXCEPTION → toute la transaction rollback
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_record_deactivation_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne logge que les transitions actif → inactif
  IF COALESCE(OLD.is_active, true) = true AND COALESCE(NEW.is_active, true) = false THEN
    -- Exemption service_role (sync jobs)
    IF auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.bulk_deactivation_events (table_name, user_id, row_id)
    VALUES (TG_TABLE_NAME, auth.uid(), NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_check_deactivation_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit         RECORD;
  v_count         integer;
  v_user          uuid := auth.uid();
  v_user_email    text;
  v_is_super      boolean := false;
  v_forced        boolean := false;
BEGIN
  -- Exemption service_role (jobs sync)
  IF auth.role() = 'service_role' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_limit
  FROM public.bulk_action_limits
  WHERE table_name = TG_TABLE_NAME AND is_active = true
  LIMIT 1;

  IF v_limit IS NULL THEN
    RETURN NULL;
  END IF;

  -- Compte les désactivations du user dans la fenêtre
  SELECT COUNT(*) INTO v_count
  FROM public.bulk_deactivation_events
  WHERE table_name = TG_TABLE_NAME
    AND user_id IS NOT DISTINCT FROM v_user
    AND created_at > now() - make_interval(mins => v_limit.window_minutes);

  IF v_count <= v_limit.max_deactivations_per_window THEN
    RETURN NULL;
  END IF;

  -- Seuil dépassé : check override
  IF v_user IS NOT NULL THEN
    v_is_super := public.is_super_admin(v_user);
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user;
  END IF;

  IF v_is_super AND public.bulk_override_requested() THEN
    v_forced := true;
    INSERT INTO public.bulk_action_violations
      (table_name, user_id, user_email, attempted_count, threshold,
       window_minutes, was_forced, was_blocked,
       context)
    VALUES
      (TG_TABLE_NAME, v_user, v_user_email, v_count,
       v_limit.max_deactivations_per_window, v_limit.window_minutes,
       true, false,
       jsonb_build_object('override', 'super_admin'));
    RETURN NULL;
  END IF;

  -- Bloque + journalise
  INSERT INTO public.bulk_action_violations
    (table_name, user_id, user_email, attempted_count, threshold,
     window_minutes, was_forced, was_blocked, context)
  VALUES
    (TG_TABLE_NAME, v_user, v_user_email, v_count,
     v_limit.max_deactivations_per_window, v_limit.window_minutes,
     false, true, jsonb_build_object('reason', 'threshold_exceeded'));

  -- Purge les events parasites de cette transaction pour ne pas polluer la fenêtre
  DELETE FROM public.bulk_deactivation_events
  WHERE table_name = TG_TABLE_NAME
    AND user_id IS NOT DISTINCT FROM v_user
    AND created_at > now() - interval '5 seconds';

  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = format(
      'Garde-fou : %s désactivation(s) sur "%s" dans les %s dernières minutes (limite : %s). '
      'Réessayez en plus petits lots, ou demandez à un super_admin d''utiliser l''override.',
      v_count, TG_TABLE_NAME, v_limit.window_minutes, v_limit.max_deactivations_per_window
    ),
    HINT = 'Pour forcer ponctuellement (super_admin uniquement) : SET LOCAL app.bulk_override = ''true''; avant l''UPDATE.';
END;
$$;

-- ============================================================================
-- 6. Attache les triggers sur les 3 tables ciblées
-- ============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories', 'products', 'offers'] LOOP
    -- AFTER UPDATE FOR EACH ROW : log chaque ligne désactivée
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_bulk_record_%1$s_deact ON public.%1$I;', t
    );
    EXECUTE format($f$
      CREATE TRIGGER trg_bulk_record_%1$s_deact
      AFTER UPDATE OF is_active ON public.%1$I
      FOR EACH ROW
      WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.is_active = false)
      EXECUTE FUNCTION public.tg_record_deactivation_row();
    $f$, t);

    -- AFTER UPDATE STATEMENT : vérifie le seuil 1× par requête (cheap)
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_bulk_check_%1$s_threshold ON public.%1$I;', t
    );
    EXECUTE format($f$
      CREATE TRIGGER trg_bulk_check_%1$s_threshold
      AFTER UPDATE ON public.%1$I
      FOR EACH STATEMENT
      EXECUTE FUNCTION public.tg_check_deactivation_threshold();
    $f$, t);
  END LOOP;
END $$;

-- ============================================================================
-- 7. Purge auto (best-effort) : on garde 7 jours d'événements
-- ============================================================================
CREATE OR REPLACE FUNCTION public.purge_bulk_deactivation_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.bulk_deactivation_events
  WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;