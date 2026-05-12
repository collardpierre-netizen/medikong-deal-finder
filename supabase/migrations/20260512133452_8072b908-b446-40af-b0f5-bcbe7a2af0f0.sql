
-- Table des demandes vendeurs (renouvellement essai, support)
CREATE TABLE IF NOT EXISTS public.vendor_market_intel_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('trial_renewal','support')),
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','handled','dismissed')),
  created_by uuid,
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vmi_requests_status ON public.vendor_market_intel_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vmi_requests_vendor ON public.vendor_market_intel_requests(vendor_id);

ALTER TABLE public.vendor_market_intel_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor reads own vmi requests" ON public.vendor_market_intel_requests;
CREATE POLICY "vendor reads own vmi requests" ON public.vendor_market_intel_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_market_intel_requests.vendor_id AND v.auth_user_id = auth.uid())
    OR is_admin(auth.uid()) OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "admin manages vmi requests" ON public.vendor_market_intel_requests;
CREATE POLICY "admin manages vmi requests" ON public.vendor_market_intel_requests
  FOR ALL USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- RPC : auto-activation par le vendeur (one-shot)
CREATE OR REPLACE FUNCTION public.self_start_vendor_market_intel_trial()
RETURNS public.vendor_market_intel_entitlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _vendor_id uuid;
  _existing public.vendor_market_intel_entitlements;
  _row public.vendor_market_intel_entitlements;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO _vendor_id FROM public.vendors WHERE auth_user_id = auth.uid() LIMIT 1;
  IF _vendor_id IS NULL THEN
    RAISE EXCEPTION 'No vendor account linked to this user' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _existing FROM public.vendor_market_intel_entitlements WHERE vendor_id = _vendor_id;
  IF FOUND AND _existing.trial_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'trial_already_used' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.vendor_market_intel_entitlements
    (vendor_id, status, trial_started_at, trial_ends_at, granted_by, notes)
  VALUES
    (_vendor_id, 'trial', now(), now() + interval '180 days', auth.uid(), 'self_activated')
  ON CONFLICT (vendor_id) DO UPDATE SET
    status = 'trial',
    trial_started_at = now(),
    trial_ends_at = now() + interval '180 days',
    granted_by = auth.uid(),
    notes = COALESCE(public.vendor_market_intel_entitlements.notes, 'self_activated')
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (user_id, action, module, detail)
  VALUES (auth.uid(), 'vmi.trial_self_started', 'vendor_market_intel',
          jsonb_build_object('vendor_id', _vendor_id, 'ends_at', _row.trial_ends_at)::text);

  RETURN _row;
END $$;

GRANT EXECUTE ON FUNCTION public.self_start_vendor_market_intel_trial() TO authenticated;

-- RPC : demande de renouvellement / support
CREATE OR REPLACE FUNCTION public.request_vendor_market_intel_trial_renewal(_message text DEFAULT NULL)
RETURNS public.vendor_market_intel_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _vendor_id uuid;
  _row public.vendor_market_intel_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO _vendor_id FROM public.vendors WHERE auth_user_id = auth.uid() LIMIT 1;
  IF _vendor_id IS NULL THEN
    RAISE EXCEPTION 'No vendor account linked to this user' USING ERRCODE = '42501';
  END IF;

  -- Anti-spam : refuser si une demande pending existe déjà
  IF EXISTS (
    SELECT 1 FROM public.vendor_market_intel_requests
    WHERE vendor_id = _vendor_id AND kind = 'trial_renewal' AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'request_already_pending' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.vendor_market_intel_requests (vendor_id, kind, message, created_by)
  VALUES (_vendor_id, 'trial_renewal', NULLIF(trim(_message), ''), auth.uid())
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (user_id, action, module, detail)
  VALUES (auth.uid(), 'vmi.trial_renewal_requested', 'vendor_market_intel',
          jsonb_build_object('vendor_id', _vendor_id, 'request_id', _row.id)::text);

  RETURN _row;
END $$;

GRANT EXECUTE ON FUNCTION public.request_vendor_market_intel_trial_renewal(text) TO authenticated;
