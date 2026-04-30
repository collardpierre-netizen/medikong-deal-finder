-- =========================================================
-- RFQ Results Access Control: server-side entitlement gate
-- =========================================================
-- Goal: prevent any client (even raw PostgREST/Storage call)
-- from reading or downloading RFQ responses & attachments
-- when the buyer is over quota / hasn't paid for that RFQ.

-- 1. Per-RFQ access ledger ---------------------------------
CREATE TABLE IF NOT EXISTS public.rfq_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Why this grant exists: 'quota' (consumed at create time),
  -- 'credit' (permanent credit consumed), 'plan' (subscription),
  -- 'unlimited' (admin/super), 'admin_grant' (manual unlock),
  -- 'paid' (one-shot payment).
  reason text NOT NULL CHECK (reason IN ('quota','credit','plan','unlimited','admin_grant','paid')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  notes text,
  UNIQUE (rfq_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_access_grants_user ON public.rfq_access_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_rfq_access_grants_rfq ON public.rfq_access_grants(rfq_id);

ALTER TABLE public.rfq_access_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rfq_access_grants_owner_read" ON public.rfq_access_grants;
CREATE POLICY "rfq_access_grants_owner_read"
  ON public.rfq_access_grants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "rfq_access_grants_admin_all" ON public.rfq_access_grants;
CREATE POLICY "rfq_access_grants_admin_all"
  ON public.rfq_access_grants FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- 2. Entitlement check function ----------------------------
CREATE OR REPLACE FUNCTION public.rfq_buyer_can_view_results(_rfq_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
  bal record;
BEGIN
  IF _user_id IS NULL OR _rfq_id IS NULL THEN
    RETURN false;
  END IF;

  -- Admins always allowed
  IF public.is_admin(_user_id) OR public.is_super_admin(_user_id) THEN
    RETURN true;
  END IF;

  -- Must own the RFQ
  SELECT EXISTS(
    SELECT 1 FROM public.rfqs
    WHERE id = _rfq_id AND buyer_user_id = _user_id
  ) INTO is_owner;
  IF NOT is_owner THEN
    RETURN false;
  END IF;

  -- Active grant (not revoked, not expired)
  IF EXISTS(
    SELECT 1 FROM public.rfq_access_grants g
    WHERE g.rfq_id = _rfq_id
      AND g.user_id = _user_id
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  ) THEN
    RETURN true;
  END IF;

  -- Fallback: unlimited buyer (subscription, admin override) keeps access
  SELECT * INTO bal FROM public.rfq_buyer_balances WHERE user_id = _user_id;
  IF FOUND AND (bal.is_unlimited OR bal.rfq_unlimited_override
                OR (bal.plan_expires_at IS NOT NULL AND bal.plan_expires_at > now())) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.rfq_buyer_can_view_results(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rfq_buyer_can_view_results(uuid, uuid) TO authenticated;

-- 3. Auto-grant access when an RFQ is created via quota/credit
CREATE OR REPLACE FUNCTION public.rfq_grant_access_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text := 'quota';
  bal record;
BEGIN
  SELECT * INTO bal FROM public.rfq_buyer_balances WHERE user_id = NEW.buyer_user_id;
  IF FOUND THEN
    IF bal.is_unlimited OR bal.rfq_unlimited_override THEN
      v_reason := 'unlimited';
    ELSIF bal.plan_expires_at IS NOT NULL AND bal.plan_expires_at > now() THEN
      v_reason := 'plan';
    ELSIF bal.permanent_credits > 0 THEN
      v_reason := 'credit';
    END IF;
  END IF;

  INSERT INTO public.rfq_access_grants (rfq_id, user_id, reason)
  VALUES (NEW.id, NEW.buyer_user_id, v_reason)
  ON CONFLICT (rfq_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rfq_grant_access_on_create ON public.rfqs;
CREATE TRIGGER trg_rfq_grant_access_on_create
  AFTER INSERT ON public.rfqs
  FOR EACH ROW EXECUTE FUNCTION public.rfq_grant_access_on_create();

-- 4. Backfill grants for existing RFQs ---------------------
INSERT INTO public.rfq_access_grants (rfq_id, user_id, reason, granted_at)
SELECT r.id, r.buyer_user_id, 'quota', r.created_at
FROM public.rfqs r
ON CONFLICT (rfq_id, user_id) DO NOTHING;

-- 5. Harden SELECT policies on rfq_responses ---------------
DROP POLICY IF EXISTS "Buyers see only top responses to their RFQs" ON public.rfq_responses;
CREATE POLICY "Buyers see top responses if entitled"
  ON public.rfq_responses FOR SELECT
  TO authenticated
  USING (
    is_visible_to_buyer = true
    AND public.rfq_buyer_can_view_results(rfq_id, auth.uid())
  );

-- 6. Harden SELECT policies on rfq_attachments -------------
DROP POLICY IF EXISTS "Buyer reads attachments of own RFQ" ON public.rfq_attachments;
CREATE POLICY "Buyer reads attachments if entitled"
  ON public.rfq_attachments FOR SELECT
  TO authenticated
  USING (
    public.rfq_buyer_can_view_results(rfq_id, auth.uid())
  );

-- 7. Admin RPC: grant / revoke access manually -------------
CREATE OR REPLACE FUNCTION public.rfq_admin_grant_access(
  _rfq_id uuid,
  _user_id uuid,
  _reason text DEFAULT 'admin_grant',
  _expires_at timestamptz DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _reason NOT IN ('quota','credit','plan','unlimited','admin_grant','paid') THEN
    RAISE EXCEPTION 'invalid reason' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.rfq_access_grants (rfq_id, user_id, reason, expires_at, notes)
  VALUES (_rfq_id, _user_id, _reason, _expires_at, _notes)
  ON CONFLICT (rfq_id, user_id)
    DO UPDATE SET reason = EXCLUDED.reason,
                  expires_at = EXCLUDED.expires_at,
                  notes = EXCLUDED.notes,
                  revoked_at = NULL,
                  granted_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rfq_admin_grant_access(uuid,uuid,text,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rfq_admin_grant_access(uuid,uuid,text,timestamptz,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rfq_admin_revoke_access(_rfq_id uuid, _user_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.rfq_access_grants
     SET revoked_at = now(),
         notes = COALESCE(_notes, notes)
   WHERE rfq_id = _rfq_id AND user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rfq_admin_revoke_access(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rfq_admin_revoke_access(uuid,uuid,text) TO authenticated;