
-- Impersonation sessions table
CREATE TABLE public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  admin_email text NOT NULL,
  target_user_id uuid NOT NULL,
  target_email text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('vendor', 'buyer')),
  target_company_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  actions_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage impersonation sessions"
  ON public.impersonation_sessions FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Impersonation actions table
CREATE TABLE public.impersonation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.impersonation_sessions(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip_address text
);

ALTER TABLE public.impersonation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage impersonation actions"
  ON public.impersonation_actions FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Function to increment actions count
CREATE OR REPLACE FUNCTION public.increment_impersonation_actions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.impersonation_sessions
  SET actions_count = actions_count + 1
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_impersonation_action_insert
  AFTER INSERT ON public.impersonation_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_impersonation_actions();
