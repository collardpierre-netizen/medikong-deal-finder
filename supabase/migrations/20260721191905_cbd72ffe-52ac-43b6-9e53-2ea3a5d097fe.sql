
CREATE TABLE public.peppol_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  invoice_type text NOT NULL DEFAULT 'order' CHECK (invoice_type IN ('order','commission')),
  invoice_number text,
  reason text NOT NULL,
  falco_original_document_id text,
  falco_credit_note_id text,
  falco_payload jsonb,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX peppol_credit_notes_invoice_idx ON public.peppol_credit_notes (invoice_type, invoice_id, created_at DESC);

GRANT SELECT, INSERT ON public.peppol_credit_notes TO authenticated;
GRANT ALL ON public.peppol_credit_notes TO service_role;

ALTER TABLE public.peppol_credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read peppol credit notes"
  ON public.peppol_credit_notes
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert peppol credit notes"
  ON public.peppol_credit_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
