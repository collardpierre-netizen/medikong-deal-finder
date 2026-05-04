CREATE OR REPLACE FUNCTION public.start_vendor_market_intel_trial(_vendor_id uuid, _trial_days integer DEFAULT 180, _notes text DEFAULT NULL::text)
 RETURNS vendor_market_intel_entitlements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _row public.vendor_market_intel_entitlements;
BEGIN
  IF NOT (is_admin(auth.uid()) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF _trial_days IS NULL OR _trial_days <= 0 THEN
    RAISE EXCEPTION 'Trial duration must be positive';
  END IF;

  INSERT INTO public.vendor_market_intel_entitlements
    (vendor_id, status, trial_started_at, trial_ends_at, granted_by, notes)
  VALUES
    (_vendor_id, 'trial', now(), now() + make_interval(days => _trial_days), auth.uid(), _notes)
  ON CONFLICT (vendor_id) DO UPDATE SET
    status = 'trial',
    trial_started_at = now(),
    trial_ends_at = now() + make_interval(days => _trial_days),
    granted_by = auth.uid(),
    notes = COALESCE(EXCLUDED.notes, public.vendor_market_intel_entitlements.notes)
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (user_id, action, module, detail)
  VALUES (auth.uid(), 'vmi.trial_started', 'vendor_market_intel',
          jsonb_build_object('vendor_id', _vendor_id, 'trial_days', _trial_days, 'ends_at', _row.trial_ends_at)::text);

  RETURN _row;
END $function$;

CREATE OR REPLACE FUNCTION public.activate_vendor_market_intel_subscription(_vendor_id uuid, _plan_id uuid, _billing_method vendor_market_intel_billing, _stripe_subscription_id text DEFAULT NULL::text, _period_end timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS vendor_market_intel_entitlements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _row public.vendor_market_intel_entitlements;
BEGIN
  IF NOT (is_admin(auth.uid()) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  INSERT INTO public.vendor_market_intel_entitlements
    (vendor_id, status, plan_id, billing_method, stripe_subscription_id,
     subscription_started_at, subscription_current_period_end)
  VALUES
    (_vendor_id, 'active', _plan_id, _billing_method, _stripe_subscription_id,
     now(), COALESCE(_period_end, now() + interval '30 days'))
  ON CONFLICT (vendor_id) DO UPDATE SET
    status = 'active',
    plan_id = _plan_id,
    billing_method = _billing_method,
    stripe_subscription_id = COALESCE(_stripe_subscription_id, public.vendor_market_intel_entitlements.stripe_subscription_id),
    subscription_started_at = COALESCE(public.vendor_market_intel_entitlements.subscription_started_at, now()),
    subscription_current_period_end = COALESCE(_period_end, now() + interval '30 days')
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (user_id, action, module, detail)
  VALUES (auth.uid(), 'vmi.subscription_activated', 'vendor_market_intel',
          jsonb_build_object('vendor_id', _vendor_id, 'plan_id', _plan_id, 'billing', _billing_method)::text);

  RETURN _row;
END $function$;

CREATE OR REPLACE FUNCTION public.cancel_vendor_market_intel_subscription(_vendor_id uuid)
 RETURNS vendor_market_intel_entitlements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _row public.vendor_market_intel_entitlements;
BEGIN
  IF NOT (is_admin(auth.uid()) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE public.vendor_market_intel_entitlements
  SET status = 'cancelled',
      subscription_current_period_end = now()
  WHERE vendor_id = _vendor_id
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (user_id, action, module, detail)
  VALUES (auth.uid(), 'vmi.subscription_cancelled', 'vendor_market_intel',
          jsonb_build_object('vendor_id', _vendor_id)::text);

  RETURN _row;
END $function$;