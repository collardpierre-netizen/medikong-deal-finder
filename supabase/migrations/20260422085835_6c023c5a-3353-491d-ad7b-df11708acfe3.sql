
-- Sécurisation du bucket seller-contracts (immuabilité + isolation par vendeur)

-- 1) Resserrer l'INSERT vendeur : doit être dans son propre dossier {vendor_id}/...
DROP POLICY IF EXISTS "Vendors upload own contract PDFs" ON storage.objects;

CREATE POLICY "Vendors upload own contract PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'seller-contracts'
  AND (storage.foldername(name))[1] IN (
    SELECT vendors.id::text FROM vendors WHERE vendors.auth_user_id = auth.uid()
  )
);

-- 2) Service role peut tout faire (génération serveur future + admin ops)
DROP POLICY IF EXISTS "Service role manages seller contracts" ON storage.objects;
CREATE POLICY "Service role manages seller contracts"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'seller-contracts')
WITH CHECK (bucket_id = 'seller-contracts');

-- 3) Bloquer explicitement UPDATE et DELETE côté utilisateur (immuabilité légale).
--    Aucune policy UPDATE/DELETE pour les rôles authenticated/anon = denied par défaut.
--    On crée néanmoins des policies admin pour permettre la gestion admin contrôlée.
DROP POLICY IF EXISTS "Admins delete contract PDFs" ON storage.objects;
CREATE POLICY "Admins delete contract PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'seller-contracts'
  AND is_admin(auth.uid())
);

-- 4) S'assurer que le bucket est privé (pas de SELECT public)
UPDATE storage.buckets SET public = false WHERE id = 'seller-contracts';
