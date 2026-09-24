CREATE TABLE public.pharmacy_product_declared_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_excl_vat_cents integer NOT NULL CHECK (price_excl_vat_cents > 0),
  supplier_name text NOT NULL CHECK (length(btrim(supplier_name)) BETWEEN 1 AND 160),
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_product_declared_prices TO authenticated;
GRANT ALL ON public.pharmacy_product_declared_prices TO service_role;

ALTER TABLE public.pharmacy_product_declared_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pharmacy members read declared prices"
ON public.pharmacy_product_declared_prices
FOR SELECT TO authenticated
USING (
  customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
    UNION
    SELECT x FROM public.current_user_buyer_account_ids() x
  )
);

CREATE POLICY "Pharmacy members insert declared prices"
ON public.pharmacy_product_declared_prices
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND updated_by = auth.uid()
  AND customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
    UNION
    SELECT x FROM public.current_user_buyer_account_ids() x
  )
);

CREATE POLICY "Pharmacy members update declared prices"
ON public.pharmacy_product_declared_prices
FOR UPDATE TO authenticated
USING (
  customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
    UNION
    SELECT x FROM public.current_user_buyer_account_ids() x
  )
)
WITH CHECK (
  updated_by = auth.uid()
  AND customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
    UNION
    SELECT x FROM public.current_user_buyer_account_ids() x
  )
);

CREATE POLICY "Pharmacy members delete declared prices"
ON public.pharmacy_product_declared_prices
FOR DELETE TO authenticated
USING (
  customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
    UNION
    SELECT x FROM public.current_user_buyer_account_ids() x
  )
);

CREATE OR REPLACE FUNCTION public.scan_declare_product_price(
  _scan_event_id uuid,
  _price_excl_vat_cents integer,
  _supplier_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event public.scan_events%ROWTYPE;
  v_customer_id uuid;
  v_best numeric;
  v_reference numeric;
  v_delta numeric;
  v_ratio numeric;
  v_verdict text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _price_excl_vat_cents IS NULL OR _price_excl_vat_cents <= 0 THEN RAISE EXCEPTION 'invalid_price'; END IF;
  IF length(btrim(COALESCE(_supplier_name, ''))) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'invalid_supplier'; END IF;

  SELECT se.* INTO v_event
  FROM public.scan_events se
  WHERE se.id = _scan_event_id;

  IF v_event.id IS NULL OR v_event.product_id IS NULL OR v_event.best_price_excl_vat IS NULL THEN
    RAISE EXCEPTION 'invalid_scan_event';
  END IF;

  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.id = v_event.customer_id
    AND c.scan_enabled = true
    AND (
      c.auth_user_id = v_user_id
      OR c.id IN (SELECT x FROM public.current_user_buyer_account_ids() x)
    );

  IF v_customer_id IS NULL OR v_event.user_id <> v_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.site_config sc WHERE sc.id = 1 AND sc.scan_enabled = true) THEN
    RAISE EXCEPTION 'scan_disabled';
  END IF;

  INSERT INTO public.pharmacy_product_declared_prices (
    customer_id, product_id, price_excl_vat_cents, supplier_name, created_by, updated_by
  ) VALUES (
    v_customer_id, v_event.product_id, _price_excl_vat_cents, btrim(_supplier_name), v_user_id, v_user_id
  )
  ON CONFLICT (customer_id, product_id) DO UPDATE SET
    price_excl_vat_cents = EXCLUDED.price_excl_vat_cents,
    supplier_name = EXCLUDED.supplier_name,
    updated_by = v_user_id,
    updated_at = now();

  v_best := v_event.best_price_excl_vat;
  v_reference := round((_price_excl_vat_cents::numeric / 100), 2);
  v_delta := round(v_reference - v_best, 2);
  v_ratio := CASE WHEN v_reference > 0 THEN v_delta / v_reference ELSE NULL END;
  v_verdict := CASE
    WHEN v_delta <= 0 THEN 'green'
    WHEN v_ratio <= 0.10 THEN 'orange'
    ELSE 'red'
  END;

  UPDATE public.scan_events
  SET ref_price_excl_vat = v_reference,
      ref_source = 'DECLARED',
      delta_excl_vat = v_delta,
      verdict = v_verdict
  WHERE id = v_event.id;

  RETURN jsonb_build_object(
    'verdict', v_verdict,
    'delta', v_delta,
    'best_reference_price', v_reference,
    'supplier_name', btrim(_supplier_name)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.scan_declare_product_price(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.scan_declare_product_price(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.scan_declare_product_price(uuid, integer, text) TO service_role;