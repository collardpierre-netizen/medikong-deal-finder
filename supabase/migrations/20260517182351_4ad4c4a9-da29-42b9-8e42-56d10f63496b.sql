-- BRIQUE 1 : nouveaux champs order_lines
ALTER TABLE public.order_lines 
  ADD COLUMN IF NOT EXISTS quantity_shipped integer,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_amount_incl_vat numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_refund_id text;

-- Backfill : quantity_shipped = quantity pour les lignes déjà shipped/delivered
UPDATE public.order_lines 
SET quantity_shipped = quantity 
WHERE quantity_shipped IS NULL 
  AND fulfillment_status::text IN ('shipped', 'delivered');

-- BRIQUE 2 : fonctions atomic stock management
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
BEGIN
  UPDATE public.offers 
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at = now()
  WHERE id = p_offer_id
  RETURNING stock_quantity INTO v_new_stock;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'offer_not_found');
  END IF;
  
  IF v_new_stock < 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'insufficient_stock',
      'new_stock', v_new_stock,
      'requested', p_quantity
    );
  END IF;
  
  IF v_new_stock <= 0 THEN
    UPDATE public.offers 
    SET stock_status = 'out_of_stock'::public.stock_status_enum, 
        updated_at = now()
    WHERE id = p_offer_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'new_stock', v_new_stock,
    'decremented', p_quantity
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_offer_stock(
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
BEGIN
  UPDATE public.offers 
  SET stock_quantity = stock_quantity + p_quantity,
      stock_status = CASE 
        WHEN stock_quantity + p_quantity > 0 THEN 'in_stock'::public.stock_status_enum
        ELSE stock_status
      END,
      updated_at = now()
  WHERE id = p_offer_id
  RETURNING stock_quantity INTO v_new_stock;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'offer_not_found');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'new_stock', v_new_stock);
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_offer_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_offer_stock(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_offer_stock(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_offer_stock(uuid, integer) TO service_role;