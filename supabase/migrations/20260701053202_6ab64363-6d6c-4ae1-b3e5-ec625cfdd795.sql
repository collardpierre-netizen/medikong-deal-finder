CREATE INDEX IF NOT EXISTS idx_products_qogita_sync_cursor
  ON public.products (created_at, id)
  WHERE is_active = true
    AND gtin IS NOT NULL
    AND (offer_count > 0 OR synced_at IS NULL OR qogita_qid IS NULL);