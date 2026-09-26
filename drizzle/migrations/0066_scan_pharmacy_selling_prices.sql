CREATE TABLE public.pharmacy_product_selling_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_incl_vat_cents integer NOT NULL CHECK (price_incl_vat_cents > 0 AND price_incl_vat_cents <= 10000000),
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);
GRANT SELECT ON public.pharmacy_product_selling_prices TO authenticated;
GRANT ALL ON public.pharmacy_product_selling_prices TO service_role;
ALTER TABLE public.pharmacy_product_selling_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pharmacy members read selling prices"
ON public.pharmacy_product_selling_prices FOR SELECT TO authenticated
USING (customer_id IN (
  SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
  UNION SELECT x FROM public.current_user_buyer_account_ids() x));

CREATE TABLE public.pharmacy_product_selling_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_incl_vat_cents integer NOT NULL,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.pharmacy_product_selling_price_history (customer_id, product_id, changed_at DESC);
GRANT SELECT ON public.pharmacy_product_selling_price_history TO authenticated;
GRANT ALL ON public.pharmacy_product_selling_price_history TO service_role;
ALTER TABLE public.pharmacy_product_selling_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pharmacy members read selling price history"
ON public.pharmacy_product_selling_price_history FOR SELECT TO authenticated
USING (customer_id IN (
  SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
  UNION SELECT x FROM public.current_user_buyer_account_ids() x));

CREATE OR REPLACE FUNCTION public.scan_set_selling_price(_product_id uuid, _price_incl_vat_cents integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_customer uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _price_incl_vat_cents IS NULL OR _price_incl_vat_cents <= 0 OR _price_incl_vat_cents > 10000000 THEN RAISE EXCEPTION 'invalid_price'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = _product_id) THEN RAISE EXCEPTION 'invalid_product'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.site_config sc WHERE sc.id = 1 AND sc.scan_enabled = true) THEN RAISE EXCEPTION 'scan_disabled'; END IF;
  SELECT c.id INTO v_customer FROM public.customers c
  WHERE c.scan_enabled = true
    AND (c.auth_user_id = v_user OR c.id IN (SELECT x FROM public.current_user_buyer_account_ids() x))
  ORDER BY (c.auth_user_id = v_user) DESC LIMIT 1;
  IF v_customer IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.pharmacy_product_selling_prices (customer_id, product_id, price_incl_vat_cents, created_by, updated_by)
  VALUES (v_customer, _product_id, _price_incl_vat_cents, v_user, v_user)
  ON CONFLICT (customer_id, product_id) DO UPDATE SET
    price_incl_vat_cents = EXCLUDED.price_incl_vat_cents, updated_by = v_user, updated_at = now();
  INSERT INTO public.pharmacy_product_selling_price_history (customer_id, product_id, price_incl_vat_cents, changed_by)
  VALUES (v_customer, _product_id, _price_incl_vat_cents, v_user);
  RETURN jsonb_build_object('ok', true, 'price_incl_vat_cents', _price_incl_vat_cents);
END $$;
REVOKE ALL ON FUNCTION public.scan_set_selling_price(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_set_selling_price(uuid, integer) TO authenticated;