ALTER TABLE public.restock_offers
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

-- S'assure que le bucket existe et est public en lecture
INSERT INTO storage.buckets (id, name, public)
VALUES ('restock-photos', 'restock-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Lecture publique des fichiers du bucket restock-photos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Restock photos are publicly readable'
  ) THEN
    CREATE POLICY "Restock photos are publicly readable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'restock-photos');
  END IF;
END $$;

-- Upload réservé aux utilisateurs authentifiés (dossier = offer id appartenant au seller)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Authenticated users can upload restock photos'
  ) THEN
    CREATE POLICY "Authenticated users can upload restock photos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'restock-photos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Sellers can update their restock photos'
  ) THEN
    CREATE POLICY "Sellers can update their restock photos"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'restock-photos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Sellers can delete their restock photos'
  ) THEN
    CREATE POLICY "Sellers can delete their restock photos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'restock-photos');
  END IF;
END $$;