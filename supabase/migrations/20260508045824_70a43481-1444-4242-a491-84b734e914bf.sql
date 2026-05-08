CREATE TABLE IF NOT EXISTS public.search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  session_id text NULL,
  query text NOT NULL,
  normalized_query text GENERATED ALWAYS AS (lower(btrim(query))) STORED,
  results_count integer NULL,
  zero_results boolean GENERATED ALWAYS AS (results_count IS NOT NULL AND results_count = 0) STORED,
  clicked_type text NULL CHECK (clicked_type IN ('product','brand','category') OR clicked_type IS NULL),
  clicked_id uuid NULL,
  clicked_slug text NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  country text NULL,
  locale text NULL,
  source text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_normalized_query ON public.search_logs (normalized_query);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON public.search_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_zero_results ON public.search_logs (created_at DESC) WHERE zero_results = true;
CREATE INDEX IF NOT EXISTS idx_search_logs_user_id ON public.search_logs (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert search logs"
  ON public.search_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read search logs"
  ON public.search_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));