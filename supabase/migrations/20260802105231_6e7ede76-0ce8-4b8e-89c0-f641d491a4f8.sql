ALTER TABLE public.offers DISABLE TRIGGER trg_bulk_check_offers_threshold;
ALTER TABLE public.offers DISABLE TRIGGER trg_bulk_record_offers_deact;

UPDATE public.offers o
SET is_active = false, updated_at = now()
FROM public.vendors v
WHERE v.id = o.vendor_id
  AND v.name = 'Medista NV'
  AND o.price_source LIKE 'qogita%'
  AND o.is_active = true;

ALTER TABLE public.offers ENABLE TRIGGER trg_bulk_check_offers_threshold;
ALTER TABLE public.offers ENABLE TRIGGER trg_bulk_record_offers_deact;