
ALTER TABLE public.offers DISABLE TRIGGER USER;
DELETE FROM public.offers WHERE vendor_id = '0bddfabf-c704-48e1-a2ec-518dda06bde7' AND id IN (SELECT id FROM public.offers WHERE vendor_id = '0bddfabf-c704-48e1-a2ec-518dda06bde7' LIMIT 15000);
ALTER TABLE public.offers ENABLE TRIGGER USER;
