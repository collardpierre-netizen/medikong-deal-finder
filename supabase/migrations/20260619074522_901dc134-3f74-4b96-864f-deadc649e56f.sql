
CREATE TABLE IF NOT EXISTS public.email_template_overrides (
  template_name text PRIMARY KEY,
  trigger_event text,
  custom_subject text,
  custom_body_html text,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_template_overrides TO authenticated;
GRANT ALL ON public.email_template_overrides TO service_role;

ALTER TABLE public.email_template_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email template overrides"
  ON public.email_template_overrides
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_email_template_overrides_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_template_overrides_updated_at ON public.email_template_overrides;
CREATE TRIGGER trg_email_template_overrides_updated_at
  BEFORE UPDATE ON public.email_template_overrides
  FOR EACH ROW EXECUTE FUNCTION public.tg_email_template_overrides_updated_at();
