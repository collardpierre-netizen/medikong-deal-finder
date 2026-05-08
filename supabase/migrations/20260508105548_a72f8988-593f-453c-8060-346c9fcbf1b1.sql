ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.set_user_preference(_key text, _value text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.profiles
     SET preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object(_key, _value),
         updated_at = now()
   WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.set_user_preference(text, text) TO authenticated;