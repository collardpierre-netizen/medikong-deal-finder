CREATE OR REPLACE FUNCTION public.bulk_set_cnk_codes(pairs jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE products p
  SET cnk_code = pair->>'cnk'
  FROM jsonb_array_elements(pairs) AS pair
  WHERE p.id = (pair->>'id')::uuid;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;