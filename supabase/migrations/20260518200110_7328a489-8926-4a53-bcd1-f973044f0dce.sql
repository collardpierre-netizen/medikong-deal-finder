CREATE TABLE IF NOT EXISTS public.category_alias_apply_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  updated_count integer,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.category_alias_apply_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read alias apply logs"
  ON public.category_alias_apply_logs FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins insert alias apply logs"
  ON public.category_alias_apply_logs FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_category_alias_apply_logs_started_at
  ON public.category_alias_apply_logs (started_at DESC);

CREATE OR REPLACE FUNCTION public.admin_run_apply_category_aliases()
RETURNS public.category_alias_apply_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_log public.category_alias_apply_logs;
  v_start timestamptz := clock_timestamp();
  v_count int;
  v_err text;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  INSERT INTO public.category_alias_apply_logs (triggered_by, started_at, status)
  VALUES (auth.uid(), v_start, 'running')
  RETURNING * INTO v_log;

  BEGIN
    UPDATE public.products p
       SET primary_category_id = a.category_id
      FROM public.category_source_aliases a
     WHERE p.primary_category_id IS NULL
       AND p.category_name = a.source_path
       AND a.category_id IS NOT NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE public.category_alias_apply_logs
       SET finished_at = clock_timestamp(),
           duration_ms = EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::int,
           updated_count = v_count,
           status = 'success'
     WHERE id = v_log.id
    RETURNING * INTO v_log;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    UPDATE public.category_alias_apply_logs
       SET finished_at = clock_timestamp(),
           duration_ms = EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::int,
           status = 'error',
           error_message = v_err
     WHERE id = v_log.id
    RETURNING * INTO v_log;
    RAISE;
  END;

  RETURN v_log;
END $function$;