ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS email_cagnotte_earned_sent_at TIMESTAMPTZ;

INSERT INTO public.settings (key, value)
VALUES ('cagnotte_vat_rate', '0.21'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.settings (key, value)
VALUES ('cagnotte_vat_mode', '"payment"'::jsonb)
ON CONFLICT (key) DO NOTHING;