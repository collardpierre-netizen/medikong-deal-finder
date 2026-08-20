ALTER TABLE public.restock_buyers
  ADD COLUMN IF NOT EXISTS restock_mov_min_cents integer;

ALTER TABLE public.restock_buyers
  ADD CONSTRAINT restock_buyers_mov_min_cents_positive
  CHECK (restock_mov_min_cents IS NULL OR restock_mov_min_cents >= 0);

CREATE OR REPLACE FUNCTION public.restock_global_mov_cents()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT GREATEST(round(NULLIF(btrim(s.value), '')::numeric * 100)::int, 0)
     FROM public.restock_settings s
     WHERE s.key = 'mov_min_eur'
     LIMIT 1),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.restock_resolve_mov_cents(_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_mov int;
  v_global int := public.restock_global_mov_cents();
BEGIN
  SELECT rb.restock_mov_min_cents
  INTO v_seller_mov
  FROM public.restock_offers o
  JOIN public.restock_buyers rb ON rb.id = o.seller_id
  WHERE o.id = _offer_id;

  IF v_seller_mov IS NOT NULL THEN
    RETURN jsonb_build_object('mov_cents', v_seller_mov, 'source', 'seller');
  END IF;

  RETURN jsonb_build_object('mov_cents', COALESCE(v_global, 0), 'source', 'global');
END;
$$;

CREATE OR REPLACE FUNCTION public.restock_enforce_mov()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mov int;
  v_amount_cents int;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (NEW.status = 'paid' AND COALESCE(OLD.status, '') <> 'paid') THEN
    RETURN NEW;
  END IF;

  v_mov := COALESCE((public.restock_resolve_mov_cents(NEW.offer_id) ->> 'mov_cents')::int, 0);
  IF v_mov <= 0 THEN
    RETURN NEW;
  END IF;

  v_amount_cents := round(COALESCE(NEW.final_price, 0) * COALESCE(NEW.quantity, 0) * 100)::int;

  IF v_amount_cents < v_mov THEN
    RAISE EXCEPTION 'RESTOCK_MOV_NOT_REACHED: montant % EUR inferieur au minimum de commande de % EUR',
      to_char(v_amount_cents / 100.0, 'FM999999990.00'),
      to_char(v_mov / 100.0, 'FM999999990.00');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restock_enforce_mov ON public.restock_transactions;
CREATE TRIGGER trg_restock_enforce_mov
BEFORE INSERT OR UPDATE OF status ON public.restock_transactions
FOR EACH ROW EXECUTE FUNCTION public.restock_enforce_mov();

REVOKE ALL ON FUNCTION public.restock_global_mov_cents() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restock_resolve_mov_cents(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restock_global_mov_cents() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restock_resolve_mov_cents(uuid) TO authenticated, service_role;