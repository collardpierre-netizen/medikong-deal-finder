-- 0023 : correction du lot 0021 — gen_random_bytes vit dans le schéma "extensions",
-- pas dans "public", donc la génération du jeton de signature échouait systématiquement.
-- Seule cette fonction est remplacée, aucune autre modification.

CREATE OR REPLACE FUNCTION public.create_delivery_note_confirmation_token(_delivery_note_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean := public.is_admin();
  v_vendor uuid := public.current_vendor_id();
  v_note record;
  v_token text;
BEGIN
  SELECT * INTO v_note FROM public.delivery_notes WHERE id = _delivery_note_id;
  IF v_note.id IS NULL THEN RAISE EXCEPTION 'delivery_note_not_found'; END IF;
  IF NOT v_is_admin AND (v_vendor IS NULL OR v_note.vendor_id IS DISTINCT FROM v_vendor) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF v_note.status <> 'issued' THEN RAISE EXCEPTION 'delivery_note_cancelled'; END IF;
  IF v_note.confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'already_confirmed'; END IF;

  v_token := COALESCE(v_note.confirmation_token, encode(extensions.gen_random_bytes(24), 'hex'));

  UPDATE public.delivery_notes
     SET confirmation_token = v_token,
         confirmation_sent_at = now(),
         updated_at = now()
   WHERE id = _delivery_note_id;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_delivery_note_confirmation_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_delivery_note_confirmation_token(uuid) TO authenticated, service_role;