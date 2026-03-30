CREATE OR REPLACE FUNCTION public.create_offers_from_products(_country_code text DEFAULT 'BE')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id uuid;
  v_vat_rate numeric := 21;
  v_upserted_count integer := 0;
BEGIN
  -- Resolve VAT rate from active country config when available
  SELECT COALESCE(default_vat_rate, 21)
  INTO v_vat_rate
  FROM public.countries
  WHERE code = _country_code
  LIMIT 1;

  -- Ensure dedicated virtual vendor exists
  SELECT id
  INTO v_vendor_id
  FROM public.vendors
  WHERE slug = 'qogita-best-price'
  LIMIT 1;

  IF v_vendor_id IS NULL THEN
    INSERT INTO public.vendors (
      name,
      slug,
      type,
      is_active,
      is_verified,
      auto_forward_to_qogita,
      can_manage_offers,
      country_code,
      commission_rate
    )
    VALUES (
      'Qogita - Meilleur prix',
      'qogita-best-price',
      'qogita_virtual',
      true,
      true,
      true,
      false,
      _country_code,
      0
    )
    RETURNING id INTO v_vendor_id;
  END IF;

  INSERT INTO public.offers (
    product_id,
    vendor_id,
    country_code,
    qogita_base_price,
    qogita_base_delay_days,
    is_qogita_backed,
    price_excl_vat,
    price_incl_vat,
    vat_rate,
    moq,
    mov,
    stock_quantity,
    stock_status,
    delivery_days,
    shipping_from_country,
    is_active,
    synced_at,
    updated_at
  )
  SELECT
    p.id,
    v_vendor_id,
    _country_code,
    COALESCE(p.best_price_excl_vat, 0),
    COALESCE(p.min_delivery_days, 3),
    true,
    COALESCE(p.best_price_excl_vat, 0),
    COALESCE(p.best_price_incl_vat, ROUND(COALESCE(p.best_price_excl_vat, 0) * (1 + v_vat_rate / 100.0), 2)),
    v_vat_rate,
    1,
    NULL,
    COALESCE(p.total_stock, 0),
    CASE
      WHEN COALESCE(p.total_stock, 0) > 0 THEN 'in_stock'::stock_status_enum
      ELSE 'out_of_stock'::stock_status_enum
    END,
    COALESCE(p.min_delivery_days, 3),
    _country_code,
    true,
    now(),
    now()
  FROM public.products p
  WHERE p.is_active = true
    AND COALESCE(p.best_price_excl_vat, 0) > 0
  ON CONFLICT (product_id, vendor_id, country_code)
  DO UPDATE SET
    qogita_base_price = EXCLUDED.qogita_base_price,
    qogita_base_delay_days = EXCLUDED.qogita_base_delay_days,
    is_qogita_backed = EXCLUDED.is_qogita_backed,
    price_excl_vat = EXCLUDED.price_excl_vat,
    price_incl_vat = EXCLUDED.price_incl_vat,
    vat_rate = EXCLUDED.vat_rate,
    stock_quantity = EXCLUDED.stock_quantity,
    stock_status = EXCLUDED.stock_status,
    delivery_days = EXCLUDED.delivery_days,
    shipping_from_country = EXCLUDED.shipping_from_country,
    is_active = EXCLUDED.is_active,
    synced_at = EXCLUDED.synced_at,
    updated_at = now();

  GET DIAGNOSTICS v_upserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'country', _country_code,
    'vendor_id', v_vendor_id,
    'offers_upserted', v_upserted_count
  );
END;
$$;