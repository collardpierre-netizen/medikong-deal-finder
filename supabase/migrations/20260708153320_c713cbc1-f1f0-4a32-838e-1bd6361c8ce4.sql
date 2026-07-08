
-- Guard privileged columns on buyer_p2p_listings, quotes, rfq_responses
-- Blocks non-admin/non-service_role UPDATEs from changing commission, lifecycle,
-- or admin-scoring/visibility columns via RLS UPDATE policies.

CREATE OR REPLACE FUNCTION public._is_privileged_actor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce(auth.role(), '') = 'service_role'
    OR public.is_admin();
$$;
GRANT EXECUTE ON FUNCTION public._is_privileged_actor() TO authenticated, anon, service_role;

-- ── buyer_p2p_listings ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._guard_buyer_p2p_listings_privileged_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._is_privileged_actor() THEN
    RETURN NEW;
  END IF;

  IF NEW.commission_payer     IS DISTINCT FROM OLD.commission_payer
  OR NEW.commission_rate_bps  IS DISTINCT FROM OLD.commission_rate_bps
  OR NEW.commission_enabled   IS DISTINCT FROM OLD.commission_enabled THEN
    RAISE EXCEPTION 'Not allowed to modify commission terms on buyer_p2p_listings'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_buyer_p2p_listings_privileged ON public.buyer_p2p_listings;
CREATE TRIGGER trg_guard_buyer_p2p_listings_privileged
BEFORE UPDATE ON public.buyer_p2p_listings
FOR EACH ROW EXECUTE FUNCTION public._guard_buyer_p2p_listings_privileged_update();

-- ── quotes ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._guard_quotes_privileged_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._is_privileged_actor() THEN
    RETURN NEW;
  END IF;

  IF NEW.status                    IS DISTINCT FROM OLD.status
  OR NEW.paid_at                   IS DISTINCT FROM OLD.paid_at
  OR NEW.accepted_at               IS DISTINCT FROM OLD.accepted_at
  OR NEW.converted_at              IS DISTINCT FROM OLD.converted_at
  OR NEW.declined_at               IS DISTINCT FROM OLD.declined_at
  OR NEW.stripe_payment_intent_id  IS DISTINCT FROM OLD.stripe_payment_intent_id
  OR NEW.stripe_session_id         IS DISTINCT FROM OLD.stripe_session_id THEN
    RAISE EXCEPTION 'Not allowed to modify quote lifecycle/payment fields directly; use RPC/edge function'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_quotes_privileged ON public.quotes;
CREATE TRIGGER trg_guard_quotes_privileged
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public._guard_quotes_privileged_update();

-- ── rfq_responses ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._guard_rfq_responses_privileged_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._is_privileged_actor() THEN
    RETURN NEW;
  END IF;

  IF NEW.is_visible_to_buyer     IS DISTINCT FROM OLD.is_visible_to_buyer
  OR NEW.is_top_pick             IS DISTINCT FROM OLD.is_top_pick
  OR NEW.admin_override_visible  IS DISTINCT FROM OLD.admin_override_visible
  OR NEW.rank_position           IS DISTINCT FROM OLD.rank_position
  OR NEW.score                   IS DISTINCT FROM OLD.score THEN
    RAISE EXCEPTION 'Not allowed to modify admin scoring/visibility fields on rfq_responses'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_rfq_responses_privileged ON public.rfq_responses;
CREATE TRIGGER trg_guard_rfq_responses_privileged
BEFORE UPDATE ON public.rfq_responses
FOR EACH ROW EXECUTE FUNCTION public._guard_rfq_responses_privileged_update();
