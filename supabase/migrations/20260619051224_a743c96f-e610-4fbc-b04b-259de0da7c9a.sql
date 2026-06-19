
CREATE TABLE IF NOT EXISTS public.delegate_callback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegate_id uuid NOT NULL REFERENCES public.vendor_delegates(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_first_name text,
  requester_last_name text,
  requester_company text,
  requester_email text NOT NULL,
  requester_phone text NOT NULL,
  buyer_profile text,
  country_code text,
  postal_code text,
  preferred_language text,
  preferred_slot text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  vendor_notes text,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dcr_vendor ON public.delegate_callback_requests(vendor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dcr_delegate ON public.delegate_callback_requests(delegate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dcr_customer ON public.delegate_callback_requests(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dcr_auth_user ON public.delegate_callback_requests(auth_user_id) WHERE auth_user_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.delegate_callback_requests TO authenticated;
GRANT ALL ON public.delegate_callback_requests TO service_role;

ALTER TABLE public.delegate_callback_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can create their callback requests"
ON public.delegate_callback_requests
FOR INSERT
TO authenticated
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Buyers can read their callback requests"
ON public.delegate_callback_requests
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

CREATE POLICY "Vendor reads own callback requests"
ON public.delegate_callback_requests
FOR SELECT
TO authenticated
USING (vendor_id IN (SELECT public.current_user_vendor_account_ids()));

CREATE POLICY "Vendor updates own callback requests"
ON public.delegate_callback_requests
FOR UPDATE
TO authenticated
USING (vendor_id IN (SELECT public.current_user_vendor_account_ids()))
WITH CHECK (vendor_id IN (SELECT public.current_user_vendor_account_ids()));

CREATE POLICY "Admins manage all callback requests"
ON public.delegate_callback_requests
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_dcr_updated_at
BEFORE UPDATE ON public.delegate_callback_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notify_vendor_callback_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delegate_name text;
BEGIN
  SELECT (first_name || ' ' || last_name) INTO v_delegate_name
  FROM public.vendor_delegates WHERE id = NEW.delegate_id;

  INSERT INTO public.vendor_notifications (vendor_id, type, title, body, cta_url, payload)
  VALUES (
    NEW.vendor_id,
    'callback_request',
    'Nouvelle demande de rappel pour ' || COALESCE(v_delegate_name, 'votre délégué'),
    COALESCE(NULLIF(trim(coalesce(NEW.requester_first_name,'') || ' ' || coalesce(NEW.requester_last_name,'')), ''), NEW.requester_email)
      || COALESCE(' (' || NEW.requester_company || ')', '')
      || ' souhaite être rappelé au ' || NEW.requester_phone || '.',
    '/vendor/leads-rappel',
    jsonb_build_object(
      'callback_request_id', NEW.id,
      'delegate_id', NEW.delegate_id,
      'requester_email', NEW.requester_email,
      'requester_phone', NEW.requester_phone
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_vendor_callback_request
AFTER INSERT ON public.delegate_callback_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_vendor_callback_request();
