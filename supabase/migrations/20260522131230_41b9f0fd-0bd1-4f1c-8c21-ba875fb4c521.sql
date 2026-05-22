ALTER TABLE public.restock_offers DROP CONSTRAINT restock_offers_status_check;
ALTER TABLE public.restock_offers ADD CONSTRAINT restock_offers_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'counter_offer'::text, 'sold'::text, 'rejected'::text, 'expired'::text]));