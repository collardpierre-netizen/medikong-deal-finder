
ALTER TABLE public.offers DISABLE TRIGGER USER;
DELETE FROM public.offers WHERE vendor_id = '0bddfabf-c704-48e1-a2ec-518dda06bde7';
ALTER TABLE public.offers ENABLE TRIGGER USER;

-- Now delete the old vendor
DELETE FROM public.vendors WHERE id = '0bddfabf-c704-48e1-a2ec-518dda06bde7';
