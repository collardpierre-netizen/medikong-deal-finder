UPDATE public.vendors
SET mandate_signed_at = now()
WHERE name ILIKE 'Medista%'
  AND mandate_signed_at IS NULL;