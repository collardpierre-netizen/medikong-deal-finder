CREATE OR REPLACE FUNCTION public.rfq_consume_credit(_user_id uuid, _rfq_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  bal public.rfq_buyer_balances;
  is_admin_flag boolean;
  monthly_remaining integer;
  consumed_from text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'rfq_consume: utilisateur non authentifié' USING ERRCODE = '28000';
  END IF;

  is_admin_flag := public.is_admin(_user_id);
  PERFORM public.rfq_ensure_buyer_balance(_user_id);

  -- Verrou ligne pour éviter les courses concurrentes
  SELECT * INTO bal FROM public.rfq_buyer_balances WHERE user_id = _user_id FOR UPDATE;

  -- ⬇️ NOUVEAU : reset automatique du quota mensuel si on a changé de mois
  IF bal.current_period_start < date_trunc('month', now()) THEN
    UPDATE public.rfq_buyer_balances
       SET monthly_used = 0,
           current_period_start = date_trunc('month', now())
     WHERE user_id = _user_id
     RETURNING * INTO bal;
  END IF;

  IF is_admin_flag THEN
    consumed_from := 'admin';
  ELSIF bal.is_unlimited OR bal.rfq_unlimited_override THEN
    consumed_from := 'unlimited';
  ELSE
    monthly_remaining := GREATEST(0, bal.monthly_quota - bal.monthly_used);
    IF monthly_remaining > 0 THEN
      UPDATE public.rfq_buyer_balances
         SET monthly_used = monthly_used + 1,
             total_consumed = total_consumed + 1
       WHERE user_id = _user_id;
      consumed_from := 'monthly';
    ELSIF bal.permanent_credits > 0 THEN
      UPDATE public.rfq_buyer_balances
         SET permanent_credits = permanent_credits - 1,
             total_consumed = total_consumed + 1
       WHERE user_id = _user_id;
      consumed_from := 'permanent';
    ELSE
      RAISE EXCEPTION 'Crédits insuffisants pour créer une nouvelle demande de prix.'
        USING ERRCODE = 'P0001', HINT = 'rfq_no_credits';
    END IF;
  END IF;

  INSERT INTO public.rfq_credit_ledger (
    user_id, kind, delta_quota, delta_permanent, rfq_id, performed_by_user_id, reason, metadata
  ) VALUES (
    _user_id,
    'consume',
    CASE WHEN consumed_from = 'monthly' THEN -1 ELSE 0 END,
    CASE WHEN consumed_from = 'permanent' THEN -1 ELSE 0 END,
    _rfq_id,
    _user_id,
    CASE consumed_from
      WHEN 'admin' THEN 'Conso exemptée (admin)'
      WHEN 'unlimited' THEN 'Conso exemptée (forfait illimité)'
      WHEN 'monthly' THEN 'Conso quota mensuel'
      WHEN 'permanent' THEN 'Conso crédits achetés'
    END,
    jsonb_build_object('source', consumed_from)
  );

  RETURN jsonb_build_object('ok', true, 'consumed_from', consumed_from);
END;
$function$;