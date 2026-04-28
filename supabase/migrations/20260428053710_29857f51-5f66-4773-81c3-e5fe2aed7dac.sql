DO $$
DECLARE
  v RECORD;
  new_code TEXT;
  attempts INT;
BEGIN
  FOR v IN
    SELECT id FROM public.vendors
    WHERE qogita_seller_alias IS NOT NULL
      AND display_code IS NOT NULL
      AND upper(display_code) = upper(qogita_seller_alias)
  LOOP
    attempts := 0;
    LOOP
      -- 6 caractères alphanum aléatoires
      new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      attempts := attempts + 1;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.vendors
        WHERE display_code = new_code
           OR upper(qogita_seller_alias) = upper(new_code)
      ) OR attempts > 20;
    END LOOP;
    UPDATE public.vendors SET display_code = new_code WHERE id = v.id;
  END LOOP;
END $$;