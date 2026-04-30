-- ============================================================
-- Migration des données existantes vers les nouveaux statuts
-- ============================================================

-- Les RFQ "open" déjà relancés ou avec wave>1 → in_followup
-- Les RFQ "open" simplement envoyés → dispatched
UPDATE public.rfqs
SET status = 'in_followup'
WHERE status = 'open' AND last_reminded_at IS NOT NULL;

UPDATE public.rfqs
SET status = 'dispatched'
WHERE status = 'open' AND dispatched_at IS NOT NULL;

-- Les RFQ "open" sans dispatched_at → draft
UPDATE public.rfqs
SET status = 'draft'
WHERE status = 'open' AND dispatched_at IS NULL;

-- ============================================================
-- Colonnes additionnelles pour tracer la vague de relance
-- ============================================================

ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS current_wave smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wave_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS awarded_at timestamptz;

-- Index pour le cron qui scanne les RFQ actifs
CREATE INDEX IF NOT EXISTS idx_rfqs_active_status
  ON public.rfqs (status, responses_deadline)
  WHERE status IN ('draft', 'dispatched', 'in_followup');

-- ============================================================
-- Fonction utilitaire : libellé lisible du statut vendeur
-- ============================================================

CREATE OR REPLACE FUNCTION public.rfq_vendor_state_label(_status public.rfq_dispatch_status)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _status
    WHEN 'dispatched'      THEN 'Reçu'
    WHEN 'viewed'          THEN 'Vu'
    WHEN 'pending_review'  THEN 'En attente de réponse'
    WHEN 'reminded'        THEN 'Relancé'
    WHEN 'responded'       THEN 'A répondu'
    WHEN 'declined'        THEN 'Décliné'
    WHEN 'expired'         THEN 'Expiré'
    WHEN 'awarded'         THEN 'Gagné'
    WHEN 'lost'            THEN 'Perdu'
    ELSE _status::text
  END;
$$;

-- ============================================================
-- Trigger : passage auto à "pending_review" si vu > 24h sans réponse
-- (déclenché à chaque UPDATE du dispatch_log et par le cron)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rfq_dispatch_auto_pending_review()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated integer;
BEGIN
  UPDATE public.rfq_dispatch_log
  SET status = 'pending_review'
  WHERE status = 'viewed'
    AND email_opened_at IS NOT NULL
    AND email_opened_at < now() - interval '24 hours'
    AND responded_at IS NULL
    AND declined_at IS NULL;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;

-- ============================================================
-- Trigger : RFQ status auto-sync depuis les colonnes de timing
-- ============================================================

CREATE OR REPLACE FUNCTION public.rfqs_sync_status_from_timing()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ne touche pas aux états terminaux explicites
  IF NEW.status IN ('closed', 'cancelled', 'awarded') THEN
    RETURN NEW;
  END IF;

  -- Cascade de transitions
  IF NEW.closed_at IS NOT NULL THEN
    NEW.status := 'closed';
  ELSIF NEW.awarded_at IS NOT NULL THEN
    NEW.status := 'awarded';
  ELSIF NEW.last_reminded_at IS NOT NULL OR COALESCE(NEW.current_wave, 0) >= 2 THEN
    NEW.status := 'in_followup';
  ELSIF NEW.dispatched_at IS NOT NULL THEN
    NEW.status := 'dispatched';
  ELSE
    NEW.status := 'draft';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rfqs_sync_status ON public.rfqs;
CREATE TRIGGER trg_rfqs_sync_status
  BEFORE INSERT OR UPDATE OF dispatched_at, last_reminded_at, closed_at, awarded_at, current_wave
  ON public.rfqs
  FOR EACH ROW
  EXECUTE FUNCTION public.rfqs_sync_status_from_timing();

-- ============================================================
-- Trigger : quand une réponse devient awarded, marque le RFQ
-- et passe les autres vendeurs en "lost"
-- ============================================================

CREATE OR REPLACE FUNCTION public.rfq_responses_propagate_award()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.awarded = true AND (OLD.awarded IS DISTINCT FROM true) THEN
    -- Marque le RFQ
    UPDATE public.rfqs
    SET awarded_at = now()
    WHERE id = NEW.rfq_id AND awarded_at IS NULL;

    -- Vendeur gagnant
    UPDATE public.rfq_dispatch_log
    SET status = 'awarded'
    WHERE rfq_id = NEW.rfq_id AND vendor_id = NEW.vendor_id;

    -- Autres vendeurs notifiés (non terminaux) → lost
    UPDATE public.rfq_dispatch_log
    SET status = 'lost'
    WHERE rfq_id = NEW.rfq_id
      AND vendor_id <> NEW.vendor_id
      AND status NOT IN ('declined', 'expired', 'awarded', 'lost');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rfq_responses_propagate_award ON public.rfq_responses;
CREATE TRIGGER trg_rfq_responses_propagate_award
  AFTER INSERT OR UPDATE OF awarded ON public.rfq_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.rfq_responses_propagate_award();

-- ============================================================
-- Helpers RPC
-- ============================================================

-- Envoie maintenant un RFQ brouillon (passe en dispatched)
CREATE OR REPLACE FUNCTION public.rfq_send_now(_rfq_id uuid)
RETURNS public.rfqs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.rfqs;
BEGIN
  UPDATE public.rfqs
  SET dispatched_at = COALESCE(dispatched_at, now()),
      current_wave = GREATEST(current_wave, 1),
      wave_started_at = COALESCE(wave_started_at, now())
  WHERE id = _rfq_id
    AND status IN ('draft', 'dispatched')
    AND (buyer_user_id = auth.uid()
         OR is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'rfq_not_found_or_forbidden';
  END IF;

  RETURN _row;
END;
$$;

-- Marque qu'une nouvelle vague de relance a été lancée
CREATE OR REPLACE FUNCTION public.rfq_mark_followup(_rfq_id uuid, _wave smallint DEFAULT NULL)
RETURNS public.rfqs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.rfqs;
BEGIN
  UPDATE public.rfqs
  SET last_reminded_at = now(),
      current_wave = COALESCE(_wave, current_wave + 1),
      wave_started_at = now()
  WHERE id = _rfq_id
    AND status IN ('dispatched', 'in_followup')
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'rfq_not_found_or_not_active';
  END IF;

  RETURN _row;
END;
$$;

-- ============================================================
-- Vue consolidée des statuts vendeur (pour UI acheteur & admin)
-- ============================================================

CREATE OR REPLACE VIEW public.rfq_vendor_status_v
WITH (security_invoker = true)
AS
SELECT
  d.id                              AS dispatch_id,
  d.rfq_id,
  d.vendor_id,
  v.name                            AS vendor_name,
  v.display_code                    AS vendor_display_code,
  d.status                          AS vendor_status,
  public.rfq_vendor_state_label(d.status) AS vendor_status_label,
  d.reason                          AS target_reason,
  d.dispatched_at,
  d.email_opened_at,
  d.viewed_at,
  d.reminded_at,
  d.responded_at,
  d.declined_at,
  d.expired_at,
  d.decline_reason,
  -- Réponse associée si elle existe
  r.id                              AS response_id,
  r.unit_price_excl_vat_cents,
  r.delivery_days,
  r.score,
  r.rank_position,
  r.awarded,
  r.is_visible_to_buyer,
  -- Timestamp de la dernière transition (pour tri "plus récent d'abord")
  GREATEST(
    COALESCE(d.dispatched_at, 'epoch'::timestamptz),
    COALESCE(d.email_opened_at, 'epoch'::timestamptz),
    COALESCE(d.reminded_at, 'epoch'::timestamptz),
    COALESCE(d.responded_at, 'epoch'::timestamptz),
    COALESCE(d.declined_at, 'epoch'::timestamptz),
    COALESCE(d.expired_at, 'epoch'::timestamptz)
  )                                 AS last_transition_at
FROM public.rfq_dispatch_log d
JOIN public.vendors v ON v.id = d.vendor_id
LEFT JOIN public.rfq_responses r
  ON r.rfq_id = d.rfq_id AND r.vendor_id = d.vendor_id;

GRANT SELECT ON public.rfq_vendor_status_v TO authenticated;

-- ============================================================
-- Cron : passage auto à pending_review (toutes les heures)
-- (idempotent : ne crée pas si déjà présent)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rfq-auto-pending-review-hourly') THEN
    PERFORM cron.schedule(
      'rfq-auto-pending-review-hourly',
      '15 * * * *',
      $cron$ SELECT public.rfq_dispatch_auto_pending_review(); $cron$
    );
  END IF;
END
$$;