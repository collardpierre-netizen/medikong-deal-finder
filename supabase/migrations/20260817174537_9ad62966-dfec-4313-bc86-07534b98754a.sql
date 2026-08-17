ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.order_invoices ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_customers_is_test ON public.customers(is_test) WHERE is_test;
CREATE INDEX IF NOT EXISTS idx_vendors_is_test ON public.vendors(is_test) WHERE is_test;
CREATE INDEX IF NOT EXISTS idx_order_invoices_is_test ON public.order_invoices(is_test) WHERE is_test;

CREATE OR REPLACE FUNCTION public.generate_document_number(p_document_type text, p_year int DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year   int := COALESCE(p_year, EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Brussels'))::int);
  v_prefix text;
  v_pad    int;
  v_next   int;
BEGIN
  v_prefix := CASE p_document_type
    WHEN 'sale'               THEN 'MK'
    WHEN 'commission_invoice' THEN 'COM'
    WHEN 'credit_note'        THEN 'NC'
    WHEN 'delivery_note'      THEN 'BL'
    WHEN 'affiliate_payout'   THEN 'AP'
    WHEN 'sale_test'          THEN 'TEST'
    ELSE NULL
  END;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Type de document inconnu: %', p_document_type;
  END IF;

  v_pad := CASE p_document_type WHEN 'sale' THEN 5 WHEN 'sale_test' THEN 5 ELSE 4 END;

  INSERT INTO public.document_number_sequences (document_type, year, last_number)
  VALUES (p_document_type, v_year, 0)
  ON CONFLICT (document_type, year) DO NOTHING;

  UPDATE public.document_number_sequences
     SET last_number = last_number + 1,
         updated_at  = now()
   WHERE document_type = p_document_type AND year = v_year
  RETURNING last_number INTO v_next;

  RETURN v_prefix || '-' || v_year || '-' ||
         CASE WHEN v_next > (10 ^ v_pad - 1)::int
              THEN v_next::text
              ELSE lpad(v_next::text, v_pad, '0')
         END;
END;
$$;