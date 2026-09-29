DO $$
DECLARE f text; d text; old text := 'IF v_line_rate IS NOT NULL OR v_line_amount IS NOT NULL THEN';
BEGIN
  FOREACH f IN ARRAY ARRAY['admin_create_manual_order','admin_update_manual_order'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=f;
    IF position(old IN d) = 0 THEN RAISE EXCEPTION 'pattern not found in %', f; END IF;
    d := replace(d, old, 'IF v_line_rate IS NOT NULL OR v_line_amount IS NOT NULL OR NULLIF(v_line->>''commission_rate'', '''') IS NOT NULL OR NULLIF(v_line->>''commission_amount'', '''') IS NOT NULL THEN');
    EXECUTE d;
  END LOOP;
END $$;

UPDATE public.sub_orders SET commission_amount_override = 0, commission_rate_override = NULL
WHERE id IN ('9ea3db2a-bd6b-407c-a003-db03bf9124a5','4de75311-9259-4e63-ad08-1f5c72891739','b9a36331-e8aa-40b6-8507-c44d52e43284','362db250-0320-4451-994c-c0ae05612cf0','3fc7ee09-3eb7-47ae-8940-559c47bbd694','98c81e4e-a93c-4279-9d96-8dc34403a33a','0d430933-3870-4905-a66c-59419316dc5e');