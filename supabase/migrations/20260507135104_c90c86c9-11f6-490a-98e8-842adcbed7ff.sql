DELETE FROM public.order_transfers ot1
USING public.order_transfers ot2
WHERE ot1.order_id = ot2.order_id
  AND ot1.vendor_id = ot2.vendor_id
  AND ot1.id <> ot2.id
  AND (
    (ot1.status = 'pending' AND ot2.status IN ('completed', 'failed'))
    OR (ot1.status = 'failed' AND ot2.status = 'completed')
    OR (ot1.status = ot2.status AND ot1.created_at < ot2.created_at)
  );

ALTER TABLE public.order_transfers
  ADD CONSTRAINT order_transfers_order_vendor_unique
  UNIQUE (order_id, vendor_id);