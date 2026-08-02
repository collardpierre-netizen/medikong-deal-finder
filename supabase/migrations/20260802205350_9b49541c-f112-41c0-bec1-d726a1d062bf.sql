-- 1. Champ de traçabilité sur les commandes
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cagnotte_restituted_at timestamptz;

-- 2. Unicité : une seule restitution par commande
CREATE UNIQUE INDEX IF NOT EXISTS idx_cagnotte_refund_unique_order
  ON public.cagnotte_ledger (order_id)
  WHERE movement_type = 'refund' AND order_id IS NOT NULL;

-- 3. Trigger de restitution automatique
CREATE OR REPLACE FUNCTION public.cagnotte_restitute_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_used numeric(10,2);
  v_balance numeric(10,2);
  v_was_cancelled boolean;
  v_is_cancelled boolean;
BEGIN
  v_used := ROUND(COALESCE(OLD.cagnotte_used, 0), 2);

  IF v_used <= 0 OR OLD.cagnotte_restituted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_was_cancelled := OLD.status = 'cancelled'
    OR COALESCE(OLD.payment_status, '') IN ('refunded', 'partially_refunded');
  v_is_cancelled := NEW.status = 'cancelled'
    OR COALESCE(NEW.payment_status, '') IN ('refunded', 'partially_refunded');

  IF v_is_cancelled AND NOT v_was_cancelled THEN
    -- Titulaire de la cagnotte
    SELECT c.auth_user_id INTO v_user_id
    FROM public.customers c
    WHERE c.id = NEW.customer_id;

    IF v_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(amount_eur), 0) INTO v_balance
    FROM public.cagnotte_ledger
    WHERE user_id = v_user_id;

    v_balance := ROUND(v_balance + v_used, 2);

    BEGIN
      INSERT INTO public.cagnotte_ledger (
        user_id, order_id, movement_type, amount_eur, balance_after, description
      ) VALUES (
        v_user_id, NEW.id, 'refund', v_used, v_balance,
        'Restitution cagnotte - commande ' || COALESCE(NEW.order_number, NEW.id::text) || ' annulee/remboursee'
      );
    EXCEPTION WHEN unique_violation THEN
      -- restitution deja enregistree : on se contente de tracer
      NEW.cagnotte_restituted_at := COALESCE(NEW.cagnotte_restituted_at, now());
      RETURN NEW;
    END;

    NEW.cagnotte_used := 0;
    NEW.cagnotte_restituted_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cagnotte_restitute_on_cancel ON public.orders;
CREATE TRIGGER trg_cagnotte_restitute_on_cancel
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.cagnotte_restitute_on_cancel();