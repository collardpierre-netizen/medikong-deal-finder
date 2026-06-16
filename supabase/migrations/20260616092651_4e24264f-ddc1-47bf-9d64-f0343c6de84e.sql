
CREATE TABLE public.qogita_connection_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tested_at timestamptz NOT NULL DEFAULT now(),
  tested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tested_email_masked text,
  success boolean NOT NULL,
  http_status int,
  latency_ms int,
  error_message text,
  source text NOT NULL DEFAULT 'admin_ui',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qogita_connection_tests TO authenticated;
GRANT ALL ON public.qogita_connection_tests TO service_role;

ALTER TABLE public.qogita_connection_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read qogita connection tests"
  ON public.qogita_connection_tests
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role manages qogita connection tests"
  ON public.qogita_connection_tests
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_qogita_connection_tests_tested_at
  ON public.qogita_connection_tests (tested_at DESC);
