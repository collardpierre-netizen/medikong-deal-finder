ALTER TABLE public.investors DROP CONSTRAINT IF EXISTS investors_status_check;
ALTER TABLE public.investors ADD CONSTRAINT investors_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'contacted'::text, 'signed'::text, 'paid'::text, 'confirmed'::text, 'refunded'::text, 'cancelled'::text]));