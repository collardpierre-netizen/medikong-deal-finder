-- Enums
DO $$ BEGIN
  CREATE TYPE public.import_job_type AS ENUM ('buyer_comparator', 'product_submission');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.import_job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table principale : 1 ligne par import lancé
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type public.import_job_type NOT NULL,
  status public.import_job_status NOT NULL DEFAULT 'pending',

  file_name text,
  file_size_bytes integer,
  total_rows integer NOT NULL DEFAULT 0,
  processed_rows integer NOT NULL DEFAULT 0,

  -- compteurs résultats (selon job_type)
  found_count integer NOT NULL DEFAULT 0,
  unavailable_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,

  -- métadonnées libres + résultat final agrégé (résumé léger; détails dans payload)
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,

  error_message text,

  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_user ON public.import_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status) WHERE status IN ('pending','processing');
CREATE INDEX IF NOT EXISTS idx_import_jobs_type_status ON public.import_jobs(job_type, status);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_import_jobs_updated_at ON public.import_jobs;
CREATE TRIGGER trg_import_jobs_updated_at
BEFORE UPDATE ON public.import_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Table payload : lignes brutes en jsonb (1 ligne par job, peut peser plusieurs MB)
CREATE TABLE IF NOT EXISTS public.import_job_payload (
  job_id uuid PRIMARY KEY REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_import_job_payload_updated_at ON public.import_job_payload;
CREATE TRIGGER trg_import_job_payload_updated_at
BEFORE UPDATE ON public.import_job_payload
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_payload ENABLE ROW LEVEL SECURITY;

-- Policies import_jobs : owner CRUD limité, admin lecture
DROP POLICY IF EXISTS "Users select own import jobs" ON public.import_jobs;
CREATE POLICY "Users select own import jobs"
ON public.import_jobs FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users insert own import jobs" ON public.import_jobs;
CREATE POLICY "Users insert own import jobs"
ON public.import_jobs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users cancel own import jobs" ON public.import_jobs;
CREATE POLICY "Users cancel own import jobs"
ON public.import_jobs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- Policies import_job_payload : owner via job
DROP POLICY IF EXISTS "Users select own payload" ON public.import_job_payload;
CREATE POLICY "Users select own payload"
ON public.import_job_payload FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.import_jobs j
    WHERE j.id = import_job_payload.job_id
      AND (j.user_id = auth.uid() OR public.is_admin(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users insert own payload" ON public.import_job_payload;
CREATE POLICY "Users insert own payload"
ON public.import_job_payload FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.import_jobs j
    WHERE j.id = import_job_payload.job_id
      AND j.user_id = auth.uid()
  )
);

-- Realtime
ALTER TABLE public.import_jobs REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='import_jobs';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.import_jobs';
  END IF;
END $$;