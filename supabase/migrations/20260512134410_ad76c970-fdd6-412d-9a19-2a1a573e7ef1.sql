
CREATE TABLE IF NOT EXISTS public.vendor_market_intel_request_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.vendor_market_intel_requests(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('created','handled','dismissed','status_changed')),
  previous_status text,
  new_status text,
  actor_user_id uuid,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vmi_req_audit_request ON public.vendor_market_intel_request_audit_log(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vmi_req_audit_vendor  ON public.vendor_market_intel_request_audit_log(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vmi_req_audit_created ON public.vendor_market_intel_request_audit_log(created_at DESC);

ALTER TABLE public.vendor_market_intel_request_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin reads vmi req audit" ON public.vendor_market_intel_request_audit_log;
CREATE POLICY "admin reads vmi req audit" ON public.vendor_market_intel_request_audit_log
  FOR SELECT USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- Pas de policy INSERT/UPDATE/DELETE : seuls les triggers SECURITY DEFINER écrivent.

CREATE OR REPLACE FUNCTION public.log_vendor_market_intel_request_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.vendor_market_intel_request_audit_log
      (request_id, vendor_id, event, previous_status, new_status, actor_user_id, message)
    VALUES
      (NEW.id, NEW.vendor_id, 'created', NULL, NEW.status, COALESCE(NEW.created_by, auth.uid()), NEW.message);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      _event := CASE NEW.status
        WHEN 'handled' THEN 'handled'
        WHEN 'dismissed' THEN 'dismissed'
        ELSE 'status_changed'
      END;
      INSERT INTO public.vendor_market_intel_request_audit_log
        (request_id, vendor_id, event, previous_status, new_status, actor_user_id, message)
      VALUES
        (NEW.id, NEW.vendor_id, _event, OLD.status, NEW.status, COALESCE(NEW.handled_by, auth.uid()), NULL);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vmi_request_audit ON public.vendor_market_intel_requests;
CREATE TRIGGER trg_vmi_request_audit
  AFTER INSERT OR UPDATE ON public.vendor_market_intel_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_vendor_market_intel_request_event();

-- Backfill : enregistre les demandes existantes (créations + clôtures déjà faites)
INSERT INTO public.vendor_market_intel_request_audit_log
  (request_id, vendor_id, event, previous_status, new_status, actor_user_id, message, created_at)
SELECT r.id, r.vendor_id, 'created', NULL, 'pending', r.created_by, r.message, r.created_at
FROM public.vendor_market_intel_requests r
WHERE NOT EXISTS (
  SELECT 1 FROM public.vendor_market_intel_request_audit_log l
  WHERE l.request_id = r.id AND l.event = 'created'
);

INSERT INTO public.vendor_market_intel_request_audit_log
  (request_id, vendor_id, event, previous_status, new_status, actor_user_id, message, created_at)
SELECT r.id, r.vendor_id,
       CASE r.status WHEN 'handled' THEN 'handled' WHEN 'dismissed' THEN 'dismissed' ELSE 'status_changed' END,
       'pending', r.status, r.handled_by, NULL, COALESCE(r.handled_at, now())
FROM public.vendor_market_intel_requests r
WHERE r.status IN ('handled','dismissed')
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_market_intel_request_audit_log l
    WHERE l.request_id = r.id AND l.event IN ('handled','dismissed')
  );
