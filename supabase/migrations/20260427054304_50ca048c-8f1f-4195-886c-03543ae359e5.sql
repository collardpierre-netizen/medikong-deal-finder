CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'error',
  source text NOT NULL DEFAULT 'manual',
  message text NOT NULL,
  stack text,
  component text,
  route text,
  user_agent text,
  user_id uuid,
  fingerprint text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_error_logs_created_at ON public.client_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_route ON public.client_error_logs (route);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_fingerprint ON public.client_error_logs (fingerprint);

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or authenticated) can insert error reports
CREATE POLICY "Anyone can insert client error logs"
ON public.client_error_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can read client error logs"
ON public.client_error_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Only admins can delete (cleanup)
CREATE POLICY "Admins can delete client error logs"
ON public.client_error_logs
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));