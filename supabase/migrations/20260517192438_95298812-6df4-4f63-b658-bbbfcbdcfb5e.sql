CREATE OR REPLACE FUNCTION public.decrement_offer_stock(
  p_offer_id uuid,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_stock integer;
  v_offer_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM offers WHERE id = p_offer_id)
  INTO v_offer_exists;

  IF NOT v_offer_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'offer_not_found');
  END IF;

  UPDATE offers
  SET stock_quantity = stock_quantity - p_quantity,
      stock_status = CASE
        WHEN stock_quantity - p_quantity = 0 THEN 'out_of_stock'::stock_status_enum
        ELSE stock_status
      END,
      updated_at = now()
  WHERE id = p_offer_id
    AND stock_quantity >= p_quantity
  RETURNING stock_quantity INTO v_new_stock;

  IF v_new_stock IS NULL THEN
    SELECT stock_quantity INTO v_new_stock
    FROM offers WHERE id = p_offer_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_stock',
      'current_stock', v_new_stock,
      'requested', p_quantity
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_stock', v_new_stock,
    'decremented', p_quantity
  );
END;
$$;