
-- Purge des données de test laissées par les tests d'intégration (préfixes TEST-FANOUT-/TEST-COMOV-/TEST-INV-/TEST-PARITY- + emails @example.invalid)
DO $$
DECLARE
  v_vendor_ids uuid[];
  v_customer_ids uuid[];
  v_product_ids uuid[];
  v_order_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_vendor_ids FROM public.vendors
    WHERE email LIKE '%@example.invalid'
       OR name LIKE 'TEST-FANOUT-%' OR name LIKE 'TEST-COMOV-%'
       OR name LIKE 'TEST-INV-%' OR name LIKE 'TEST-PARITY-%';

  SELECT array_agg(id) INTO v_customer_ids FROM public.customers
    WHERE email LIKE '%@example.invalid'
       OR company_name LIKE 'TEST-FANOUT-%' OR company_name LIKE 'TEST-COMOV-%'
       OR company_name LIKE 'TEST-INV-%' OR company_name LIKE 'TEST-PARITY-%';

  SELECT array_agg(id) INTO v_product_ids FROM public.products
    WHERE name LIKE 'TEST-FANOUT-%' OR name LIKE 'TEST-COMOV-%'
       OR name LIKE 'TEST-INV-%' OR name LIKE 'TEST-PARITY-%'
       OR slug LIKE 'test-fanout-%' OR slug LIKE 'test-comov-%'
       OR slug LIKE 'test-inv-%' OR slug LIKE 'test-parity-%';

  SELECT array_agg(id) INTO v_order_ids FROM public.orders
    WHERE (v_customer_ids IS NOT NULL AND customer_id = ANY(v_customer_ids))
       OR order_number LIKE 'TEST-%';

  -- Order-related
  IF v_order_ids IS NOT NULL THEN
    DELETE FROM public.sub_order_generation_logs WHERE order_id = ANY(v_order_ids);
    DELETE FROM public.sub_orders WHERE order_id = ANY(v_order_ids);
    DELETE FROM public.order_lines WHERE order_id = ANY(v_order_ids);
    DELETE FROM public.order_items WHERE order_id = ANY(v_order_ids);
    DELETE FROM public.orders WHERE id = ANY(v_order_ids);
  END IF;

  -- Vendor-related
  IF v_vendor_ids IS NOT NULL THEN
    DELETE FROM public.vendor_invoice_payment_rules WHERE vendor_id = ANY(v_vendor_ids);
    DELETE FROM public.vendor_invoice_payment_settings WHERE vendor_id = ANY(v_vendor_ids);
    DELETE FROM public.offers WHERE vendor_id = ANY(v_vendor_ids);
  END IF;

  -- Products
  IF v_product_ids IS NOT NULL THEN
    DELETE FROM public.offers WHERE product_id = ANY(v_product_ids);
    DELETE FROM public.products WHERE id = ANY(v_product_ids);
  END IF;

  -- Customers
  IF v_customer_ids IS NOT NULL THEN
    DELETE FROM public.customers WHERE id = ANY(v_customer_ids);
  END IF;

  -- Vendors
  IF v_vendor_ids IS NOT NULL THEN
    DELETE FROM public.vendors WHERE id = ANY(v_vendor_ids);
  END IF;
END $$;
