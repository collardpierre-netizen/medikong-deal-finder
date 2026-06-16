CREATE TABLE public.vendor_exclusivity_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('showcase','hide','block')),
  scope_type text NOT NULL CHECK (scope_type IN ('brand','manufacturer','product','category')),
  scope_id uuid,
  scope_label text,
  country_codes text[] NOT NULL DEFAULT '{}',
  valid_from date,
  valid_until date,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_exclusivity_id uuid REFERENCES public.vendor_exclusivities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.vendor_exclusivity_requests TO authenticated;
GRANT ALL ON public.vendor_exclusivity_requests TO service_role;

ALTER TABLE public.vendor_exclusivity_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors view own exclusivity requests"
ON public.vendor_exclusivity_requests FOR SELECT
TO authenticated
USING (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Vendors create own exclusivity requests"
ON public.vendor_exclusivity_requests FOR INSERT
TO authenticated
WITH CHECK (
  vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
  AND requested_by = auth.uid()
  AND status = 'pending'
);

CREATE POLICY "Vendors cancel own pending or admins update"
ON public.vendor_exclusivity_requests FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (
    vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
    AND status = 'pending'
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
    AND status IN ('pending','cancelled')
  )
);

CREATE TRIGGER trg_vendor_exclusivity_requests_updated_at
BEFORE UPDATE ON public.vendor_exclusivity_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vendor_excl_req_vendor ON public.vendor_exclusivity_requests(vendor_id, status);
CREATE INDEX idx_vendor_excl_req_status ON public.vendor_exclusivity_requests(status, created_at DESC);
