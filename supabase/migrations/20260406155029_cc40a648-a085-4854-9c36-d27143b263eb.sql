
-- Recreate the filtered unique index
CREATE UNIQUE INDEX IF NOT EXISTS market_prices_source_ean_unique 
ON public.market_prices (source_id, ean) 
WHERE ean IS NOT NULL AND ean <> '';

-- Create an RPC function for proper upsert that works with filtered unique indexes
CREATE OR REPLACE FUNCTION public.upsert_market_prices(rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  upserted_count integer := 0;
  r jsonb;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(rows)
  LOOP
    INSERT INTO market_prices (
      source_id, ean, cnk, product_name_source, prix_grossiste, prix_pharmacien,
      prix_public, tva_rate, supplier_name, product_url, stock_source, remise_pct,
      product_id, is_matched, imported_at
    ) VALUES (
      (r->>'source_id')::uuid,
      NULLIF(r->>'ean', ''),
      NULLIF(r->>'cnk', ''),
      r->>'product_name_source',
      (r->>'prix_grossiste')::numeric,
      (r->>'prix_pharmacien')::numeric,
      (r->>'prix_public')::numeric,
      (r->>'tva_rate')::numeric,
      r->>'supplier_name',
      r->>'product_url',
      r->>'stock_source',
      (r->>'remise_pct')::numeric,
      (r->>'product_id')::uuid,
      COALESCE((r->>'is_matched')::boolean, false),
      COALESCE((r->>'imported_at')::timestamptz, now())
    )
    ON CONFLICT (source_id, ean) WHERE ean IS NOT NULL AND ean <> ''
    DO UPDATE SET
      cnk = EXCLUDED.cnk,
      product_name_source = EXCLUDED.product_name_source,
      prix_grossiste = EXCLUDED.prix_grossiste,
      prix_pharmacien = EXCLUDED.prix_pharmacien,
      prix_public = EXCLUDED.prix_public,
      tva_rate = EXCLUDED.tva_rate,
      supplier_name = EXCLUDED.supplier_name,
      product_url = EXCLUDED.product_url,
      stock_source = EXCLUDED.stock_source,
      remise_pct = EXCLUDED.remise_pct,
      product_id = EXCLUDED.product_id,
      is_matched = EXCLUDED.is_matched,
      imported_at = EXCLUDED.imported_at;
    
    upserted_count := upserted_count + 1;
  END LOOP;
  
  RETURN upserted_count;
END;
$$;
