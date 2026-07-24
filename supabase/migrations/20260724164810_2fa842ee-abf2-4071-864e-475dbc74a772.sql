
-- 1. Table de compteurs
CREATE TABLE IF NOT EXISTS public.document_number_sequences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type  text NOT NULL CHECK (document_type IN ('sale','commission_invoice','credit_note')),
  year           int  NOT NULL,
  last_number    int  NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type, year)
);

GRANT ALL ON public.document_number_sequences TO service_role;
ALTER TABLE public.document_number_sequences ENABLE ROW LEVEL SECURITY;
-- Aucune policy : accès uniquement via fonction SECURITY DEFINER ou service_role.

-- 2. Fonction d'attribution atomique (bascule d'année en Europe/Brussels)
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
    ELSE NULL
  END;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Type de document inconnu: %', p_document_type;
  END IF;

  v_pad := CASE p_document_type WHEN 'sale' THEN 5 ELSE 4 END;

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

REVOKE ALL ON FUNCTION public.generate_document_number(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_document_number(text, int) TO service_role;

-- 3. Unicité des numéros sur les 3 tables
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_unique_idx
  ON public.orders (order_number) WHERE order_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS commission_invoices_invoice_number_unique_idx
  ON public.commission_invoices (invoice_number) WHERE invoice_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS peppol_credit_notes_invoice_number_unique_idx
  ON public.peppol_credit_notes (invoice_number) WHERE invoice_number IS NOT NULL;

-- 4. Trigger ventes : attribue MK-YYYY-##### à la sortie de 'draft'
CREATE OR REPLACE FUNCTION public.assign_sale_document_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'draft'::order_status
     AND (NEW.order_number IS NULL OR NEW.order_number LIKE 'DRAFT-%') THEN
    -- Ne renumérote jamais un document déjà porteur d'un vrai numéro
    IF TG_OP = 'UPDATE' AND OLD.order_number IS NOT NULL
       AND OLD.order_number NOT LIKE 'DRAFT-%' THEN
      RETURN NEW;
    END IF;
    NEW.order_number := public.generate_document_number('sale');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_sale_document_number ON public.orders;
CREATE TRIGGER trg_assign_sale_document_number
  BEFORE INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_sale_document_number();

-- 5. Trigger factures de commission : attribue COM-YYYY-#### à la sortie de 'to_invoice'
CREATE OR REPLACE FUNCTION public.assign_commission_invoice_document_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_number IS NULL
     AND NEW.status IS DISTINCT FROM 'to_invoice'::commission_invoice_status
     AND NEW.status IS DISTINCT FROM 'cancelled'::commission_invoice_status THEN
    NEW.invoice_number := public.generate_document_number('commission_invoice');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_commission_invoice_document_number ON public.commission_invoices;
CREATE TRIGGER trg_assign_commission_invoice_document_number
  BEFORE INSERT OR UPDATE OF status ON public.commission_invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_commission_invoice_document_number();

-- 6. Trigger notes de crédit : attribue NC-YYYY-#### à l'insertion
CREATE OR REPLACE FUNCTION public.assign_credit_note_document_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := public.generate_document_number('credit_note');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_credit_note_document_number ON public.peppol_credit_notes;
CREATE TRIGGER trg_assign_credit_note_document_number
  BEFORE INSERT ON public.peppol_credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.assign_credit_note_document_number();
