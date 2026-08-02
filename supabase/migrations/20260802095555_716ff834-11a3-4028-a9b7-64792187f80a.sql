DO $$
DECLARE
  v_order uuid;
  v_user uuid;
  v_snap jsonb;
  v_rate numeric;
  v_earned numeric;
  v_ledger uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  SELECT o.id, c.auth_user_id INTO v_order, v_user
  FROM public.orders o JOIN public.customers c ON c.id = o.customer_id
  WHERE o.order_number = 'TEST-CAGNOTTE-001';

  v_snap := public.snapshot_order_commission(v_order);

  SELECT COALESCE((value)::text::numeric, 0.02) INTO v_rate
  FROM public.settings WHERE key = 'cagnotte_rate';

  v_earned := ROUND(((v_snap->>'cagnotte_eligible_ht')::numeric) * COALESCE(v_rate, 0.02), 2);

  DELETE FROM public.cagnotte_ledger WHERE order_id = v_order;

  IF v_earned >= 0.01 THEN
    v_ledger := public.insert_ledger_entry(
      v_user, 'earn', v_earned,
      'Gain sur commande TEST-CAGNOTTE-001 (' || (v_snap->>'cagnotte_eligible_ht') || ' EUR HT eligible)',
      v_order,
      make_date(EXTRACT(YEAR FROM now())::int + 1, 12, 31)
    );
    UPDATE public.orders
    SET cagnotte_eligible_ht = (v_snap->>'cagnotte_eligible_ht')::numeric,
        cagnotte_earned = v_earned
    WHERE id = v_order;
  END IF;

  RAISE NOTICE 'snap=% earned=% ledger=%', v_snap, v_earned, v_ledger;
END $$;