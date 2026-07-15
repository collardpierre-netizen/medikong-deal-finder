ALTER TABLE public.vendors ALTER COLUMN margin_split_pct DROP NOT NULL;
ALTER TABLE public.vendors ALTER COLUMN margin_split_pct SET DEFAULT 0;
UPDATE public.vendors SET margin_split_pct = 0 WHERE margin_split_pct IS NULL;