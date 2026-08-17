ALTER TABLE public.document_number_sequences DROP CONSTRAINT IF EXISTS document_number_sequences_document_type_check;
ALTER TABLE public.document_number_sequences ADD CONSTRAINT document_number_sequences_document_type_check
  CHECK (document_type IN ('sale','commission_invoice','credit_note','delivery_note','affiliate_payout','sale_test'));