-- Bucket privé nh-invoices : aucun accès anonyme.
-- Les PDF sont écrits et signés côté serveur (service_role, URL signée à TTL court).
-- Lecture directe réservée au SUPERADMIN pour audit.
DROP POLICY IF EXISTS "Super admins can read nh invoices files" ON storage.objects;
CREATE POLICY "Super admins can read nh invoices files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'nh-invoices' AND public.is_nh_super_admin(auth.uid()));