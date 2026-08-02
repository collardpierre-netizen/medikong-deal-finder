DO $$
DECLARE
  v_cust uuid := 'cb12ca42-723e-4fb5-964a-9162727cf8ee';
  v_p_elig uuid;
  v_p_trad uuid;
  v_order uuid;
BEGIN
  -- Produits de test : 1 éligible (commission 20%), 1 trading (commission 5%)
  INSERT INTO public.products (name, slug, commission_rate, is_active)
  VALUES ('ZZ TEST Cagnotte Éligible', 'zz-test-cagnotte-eligible', 0.20, false)
  ON CONFLICT (slug) DO UPDATE SET commission_rate = 0.20
  RETURNING id INTO v_p_elig;

  INSERT INTO public.products (name, slug, commission_rate, is_active)
  VALUES ('ZZ TEST Cagnotte Trading', 'zz-test-cagnotte-trading', 0.05, false)
  ON CONFLICT (slug) DO UPDATE SET commission_rate = 0.05
  RETURNING id INTO v_p_trad;

  -- Commande de test payée : 1000 € HT éligible + 500 € HT trading
  DELETE FROM public.orders WHERE order_number = 'TEST-CAGNOTTE-001';

  INSERT INTO public.orders (order_number, customer_id, status, payment_status, is_test,
                             subtotal_excl_vat, total_incl_vat)
  VALUES ('TEST-CAGNOTTE-001', v_cust, 'confirmed', 'paid', true, 1500, 1815)
  RETURNING id INTO v_order;

  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price_excl_vat, line_total_excl_vat)
  VALUES (v_order, v_p_elig, 1, 1000, 1000),
         (v_order, v_p_trad, 1, 500, 500);

  RAISE NOTICE 'order=%', v_order;
END $$;