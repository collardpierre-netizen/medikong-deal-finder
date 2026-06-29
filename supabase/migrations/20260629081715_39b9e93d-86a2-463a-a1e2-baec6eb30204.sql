
CREATE TABLE IF NOT EXISTS public.customer_profile_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  auth_user_id uuid,
  field_name text NOT NULL CHECK (field_name IN ('customer_type','visibility_profile')),
  old_value text,
  new_value text,
  old_label text,
  new_label text,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.customer_profile_history TO authenticated;
GRANT ALL ON public.customer_profile_history TO service_role;

ALTER TABLE public.customer_profile_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read history"
  ON public.customer_profile_history FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admins insert history"
  ON public.customer_profile_history FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS customer_profile_history_customer_idx
  ON public.customer_profile_history(customer_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.admin_change_buyer_profile(
  _customer_id uuid,
  _auth_user_id uuid,
  _new_customer_type text,
  _new_profile_id uuid,
  _reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_type text;
  v_old_profile uuid;
  v_old_profile_name text;
  v_new_profile_name text;
  v_changes int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT customer_type::text INTO v_old_type FROM public.customers WHERE id = _customer_id;
  IF v_old_type IS NULL THEN
    RAISE EXCEPTION 'customer_not_found';
  END IF;

  IF _new_customer_type IS NOT NULL AND _new_customer_type <> v_old_type THEN
    UPDATE public.customers
       SET customer_type = _new_customer_type::customer_type, updated_at = now()
     WHERE id = _customer_id;
    INSERT INTO public.customer_profile_history(
      customer_id, auth_user_id, field_name, old_value, new_value,
      old_label, new_label, reason, changed_by
    ) VALUES (
      _customer_id, _auth_user_id, 'customer_type', v_old_type, _new_customer_type,
      v_old_type, _new_customer_type, _reason, auth.uid()
    );
    v_changes := v_changes + 1;
  END IF;

  IF _auth_user_id IS NOT NULL AND _new_profile_id IS NOT NULL THEN
    SELECT profile_id INTO v_old_profile
      FROM public.user_profile_assignments WHERE user_id = _auth_user_id;
    IF v_old_profile IS DISTINCT FROM _new_profile_id THEN
      SELECT name INTO v_old_profile_name FROM public.user_profiles WHERE id = v_old_profile;
      SELECT name INTO v_new_profile_name FROM public.user_profiles WHERE id = _new_profile_id;
      INSERT INTO public.user_profile_assignments(user_id, profile_id)
      VALUES (_auth_user_id, _new_profile_id)
      ON CONFLICT (user_id) DO UPDATE SET profile_id = EXCLUDED.profile_id;
      INSERT INTO public.customer_profile_history(
        customer_id, auth_user_id, field_name, old_value, new_value,
        old_label, new_label, reason, changed_by
      ) VALUES (
        _customer_id, _auth_user_id, 'visibility_profile',
        v_old_profile::text, _new_profile_id::text,
        v_old_profile_name, v_new_profile_name, _reason, auth.uid()
      );
      v_changes := v_changes + 1;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'changes', v_changes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_change_buyer_profile(uuid, uuid, text, uuid, text) TO authenticated;
