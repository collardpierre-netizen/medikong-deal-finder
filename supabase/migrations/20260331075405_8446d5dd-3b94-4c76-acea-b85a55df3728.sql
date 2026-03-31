
CREATE TABLE IF NOT EXISTS public.sync_pipeline_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL DEFAULT 'BE',
  status TEXT NOT NULL DEFAULT 'pending',
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 6,
  steps_status JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  triggered_by TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sync_pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sync_pipeline_runs"
  ON public.sync_pipeline_runs FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));
