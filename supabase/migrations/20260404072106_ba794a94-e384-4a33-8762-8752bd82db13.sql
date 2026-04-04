-- Delete older duplicates, keeping only the most recent per (source_id, ean)
DELETE FROM public.market_prices
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY source_id, ean
      ORDER BY imported_at DESC
    ) as rn
    FROM public.market_prices
    WHERE ean IS NOT NULL AND ean != ''
  ) sub
  WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS market_prices_source_ean_unique
ON public.market_prices (source_id, ean)
WHERE ean IS NOT NULL AND ean != '';