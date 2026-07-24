GRANT SELECT ON public.product_country_stats TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_country_stats'
      AND policyname = 'Public can read product country stats'
  ) THEN
    CREATE POLICY "Public can read product country stats"
      ON public.product_country_stats
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;