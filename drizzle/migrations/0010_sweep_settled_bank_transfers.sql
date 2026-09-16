-- Rattrapage automatique des virements encaissés en banque :
-- marque payées les commandes dont les virements encaissés couvrent le total TTC.
CREATE OR REPLACE FUNCTION public.sweep_settled_bank_transfers(_limit integer DEFAULT 200)
RETURNS TABLE (order_id uuid, order_number text, settled_cents bigint, total_cents bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._is_admin_or_service() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT o.id,
           o.order_number,
           SUM(t.amount_cents)::bigint AS settled_cents,
           ROUND(COALESCE(o.total_incl_vat, 0) * 100)::bigint AS total_cents
    FROM public.orders o
    JOIN public.order_bank_transfers t ON t.order_id = o.id
    WHERE t.state = 'settled'
      AND o.payment_status IS DISTINCT FROM 'paid'
      AND COALESCE(o.status::text, '') <> 'cancelled'
      AND COALESCE(o.is_test, false) = false
    GROUP BY o.id, o.order_number, o.total_incl_vat
    HAVING ROUND(COALESCE(o.total_incl_vat, 0) * 100)::bigint > 0
       AND SUM(t.amount_cents)::bigint >= ROUND(COALESCE(o.total_incl_vat, 0) * 100)::bigint
    ORDER BY o.id
    LIMIT GREATEST(COALESCE(_limit, 200), 1)
  ), updated AS (
    UPDATE public.orders o
       SET payment_status = 'paid',
           updated_at = now()
      FROM candidates c
     WHERE o.id = c.id
       AND o.payment_status IS DISTINCT FROM 'paid'
    RETURNING o.id
  )
  SELECT c.id, c.order_number, c.settled_cents, c.total_cents
  FROM candidates c
  JOIN updated u ON u.id = c.id;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_settled_bank_transfers(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_settled_bank_transfers(integer) TO authenticated, service_role;