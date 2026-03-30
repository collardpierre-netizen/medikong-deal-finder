
-- Add display_code column to vendors
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS display_code VARCHAR(6);

-- Generate display_code for all existing vendors that don't have one
UPDATE public.vendors
SET display_code = UPPER(SUBSTR(MD5(id::text || random()::text), 1, 6))
WHERE display_code IS NULL;

-- Create a trigger function to auto-generate display_code on insert
CREATE OR REPLACE FUNCTION public.generate_vendor_display_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.display_code IS NULL OR NEW.display_code = '' THEN
    NEW.display_code := UPPER(SUBSTR(MD5(NEW.id::text || random()::text), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_display_code
BEFORE INSERT ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.generate_vendor_display_code();
