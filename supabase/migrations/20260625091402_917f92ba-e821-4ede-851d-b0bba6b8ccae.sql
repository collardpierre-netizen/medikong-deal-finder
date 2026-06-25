ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS bic text;

UPDATE public.vendors
SET bank_name = 'KBC',
    iban = 'BE47 7360 6995 8080',
    bic = 'KREDBEBB'
WHERE id = '063807eb-e087-49f9-bbbc-846e78f70446';
