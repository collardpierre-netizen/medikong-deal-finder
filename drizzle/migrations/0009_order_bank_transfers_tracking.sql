DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bank_transfer_state') THEN
    CREATE TYPE public.bank_transfer_state AS ENUM ('pending', 'received', 'settled');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.order_bank_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  value_date date,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  state public.bank_transfer_state NOT NULL DEFAULT 'pending',
  bank_reference text,
  note text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.order_bank_transfers IS 'Suivi declaratif des virements recus sur le compte MediKong pour une commande (date, montant, etat).';

CREATE INDEX IF NOT EXISTS idx_order_bank_transfers_order_id ON public.order_bank_transfers(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_bank_transfers TO authenticated;
GRANT ALL ON public.order_bank_transfers TO service_role;

ALTER TABLE public.order_bank_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage order bank transfers" ON public.order_bank_transfers;
CREATE POLICY "Admins manage order bank transfers"
ON public.order_bank_transfers
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.touch_order_bank_transfers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_bank_transfers_touch ON public.order_bank_transfers;
CREATE TRIGGER trg_order_bank_transfers_touch
BEFORE UPDATE ON public.order_bank_transfers
FOR EACH ROW EXECUTE FUNCTION public.touch_order_bank_transfers_updated_at();