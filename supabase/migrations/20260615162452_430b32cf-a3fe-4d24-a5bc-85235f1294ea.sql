
CREATE TABLE IF NOT EXISTS public.vendor_onboarding_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NULL,
  mode text NOT NULL CHECK (mode IN ('create','attach','self_register')),
  template_name text NOT NULL,
  locale text NULL,
  recipient_email text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('enqueued','failed')),
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voel_created_at ON public.vendor_onboarding_email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voel_vendor_id ON public.vendor_onboarding_email_logs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_voel_idempotency ON public.vendor_onboarding_email_logs(idempotency_key);

GRANT SELECT ON public.vendor_onboarding_email_logs TO authenticated;
GRANT ALL ON public.vendor_onboarding_email_logs TO service_role;

ALTER TABLE public.vendor_onboarding_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voel_admin_read"
ON public.vendor_onboarding_email_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));
