CREATE OR REPLACE FUNCTION public.admin_test_show_payment_info_toggle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_order_id uuid;
  v_token text;
  v_helper_true boolean;
  v_helper_false boolean;
  v_public_true jsonb;
  v_public_false jsonb;
  v_results jsonb := '[]'::jsonb;
  v_pass boolean := true;
  v_msg text;
BEGIN
  IF v_caller IS NULL OR NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 1) Create synthetic test order
  INSERT INTO public.orders (
    order_number, status, payment_status, show_payment_info,
    subtotal_excl_vat, vat_amount, total_incl_vat, created_by_admin
  ) VALUES (
    'MK-TEST-TOGGLE-' || substr(gen_random_uuid()::text, 1, 8),
    'draft', 'pending', true,
    100, 21, 121, v_caller
  ) RETURNING id INTO v_order_id;

  -- public token so we can call public_get_order_by_token
  v_token := 'test-' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.vendor_order_tokens (order_id, token, expires_at)
  VALUES (v_order_id, v_token, now() + interval '5 minutes');

  -- 2) Scenario A : toggle = TRUE  → both surfaces must say "shown"
  v_helper_true := public.order_should_show_payment_info(v_order_id);
  v_public_true := public.public_get_order_by_token(v_token, NULL);

  v_msg := format('helper=%s public.show_payment_info=%s',
                  v_helper_true, v_public_true->>'show_payment_info');
  IF v_helper_true IS TRUE
     AND coalesce((v_public_true->>'show_payment_info')::boolean, false) IS TRUE THEN
    v_results := v_results || jsonb_build_object('scenario','toggle_true','pass',true,'detail',v_msg);
  ELSE
    v_pass := false;
    v_results := v_results || jsonb_build_object('scenario','toggle_true','pass',false,'detail',v_msg);
  END IF;

  -- 3) Scenario B : toggle = FALSE → both surfaces must say "hidden" + vendor_bank null
  UPDATE public.orders SET show_payment_info = false WHERE id = v_order_id;

  v_helper_false := public.order_should_show_payment_info(v_order_id);
  v_public_false := public.public_get_order_by_token(v_token, NULL);

  v_msg := format('helper=%s public.show_payment_info=%s vendor_bank=%s',
                  v_helper_false,
                  v_public_false->>'show_payment_info',
                  CASE WHEN v_public_false->'vendor_bank' IS NULL
                            OR v_public_false->'vendor_bank' = 'null'::jsonb
                       THEN 'null' ELSE 'present' END);
  IF v_helper_false IS FALSE
     AND coalesce((v_public_false->>'show_payment_info')::boolean, true) IS FALSE
     AND (v_public_false->'vendor_bank' IS NULL
          OR v_public_false->'vendor_bank' = 'null'::jsonb) THEN
    v_results := v_results || jsonb_build_object('scenario','toggle_false','pass',true,'detail',v_msg);
  ELSE
    v_pass := false;
    v_results := v_results || jsonb_build_object('scenario','toggle_false','pass',false,'detail',v_msg);
  END IF;

  -- 4) Cleanup
  DELETE FROM public.vendor_order_tokens WHERE order_id = v_order_id;
  DELETE FROM public.orders WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'pass', v_pass,
    'scenarios', v_results,
    'tested_at', now()
  );

EXCEPTION WHEN OTHERS THEN
  -- Best-effort cleanup
  IF v_order_id IS NOT NULL THEN
    DELETE FROM public.vendor_order_tokens WHERE order_id = v_order_id;
    DELETE FROM public.orders WHERE id = v_order_id;
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_test_show_payment_info_toggle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_test_show_payment_info_toggle() TO authenticated, service_role;