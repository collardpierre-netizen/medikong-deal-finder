CREATE OR REPLACE FUNCTION public.get_buyer_p2p_settings()
RETURNS TABLE(default_commission_bps integer, commission_payer public.buyer_p2p_commission_payer, max_validity_days integer, is_enabled boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.default_commission_bps::integer, s.commission_payer, s.max_validity_days::integer, s.is_enabled
  FROM public.buyer_p2p_settings s WHERE s.id = true
$$;
REVOKE ALL ON FUNCTION public.get_buyer_p2p_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_buyer_p2p_settings() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._buyer_p2p_status_transitions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  _max_days integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT g.max_validity_days INTO _max_days FROM public.get_buyer_p2p_settings() g;
    IF _max_days IS NOT NULL AND NEW.valid_until > now() + (_max_days || ' days')::interval THEN
      RAISE EXCEPTION 'valid_until dépasse la validité maximale (% jours)', _max_days;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF NOT (
      (OLD.status = 'draft'      AND NEW.status IN ('sent','cancelled'))
      OR (OLD.status = 'sent'    AND NEW.status IN ('accepted','declined','expired','cancelled'))
      OR (OLD.status = 'accepted' AND NEW.status IN ('paid','cancelled'))
      OR (OLD.status = 'paid'    AND NEW.status IN ('shipped','completed'))
      OR (OLD.status = 'shipped' AND NEW.status IN ('completed'))
    ) THEN
      RAISE EXCEPTION 'Transition de statut invalide : % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'sent'      AND NEW.sent_at      IS NULL THEN NEW.sent_at = now();      END IF;
    IF NEW.status = 'accepted'  AND NEW.accepted_at  IS NULL THEN NEW.accepted_at = now();  END IF;
    IF NEW.status = 'declined'  AND NEW.declined_at  IS NULL THEN NEW.declined_at = now();  END IF;
    IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN NEW.cancelled_at = now(); END IF;
    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN NEW.completed_at = now(); END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS p2p_settings_select_authenticated ON public.buyer_p2p_settings;