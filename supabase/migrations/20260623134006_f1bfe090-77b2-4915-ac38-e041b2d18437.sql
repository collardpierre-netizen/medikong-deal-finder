
-- 1) Ajouter les colonnes chiffrées (texte base64 du payload AES-GCM)
ALTER TABLE public.vendor_sendcloud_credentials
  ADD COLUMN IF NOT EXISTS public_key_cipher text,
  ADD COLUMN IF NOT EXISTS secret_key_cipher text;

-- 2) Supprimer les colonnes en clair (les valeurs précédentes étaient exposées
--    et ne sont plus accessibles côté UI ; les vendeurs doivent re-saisir).
ALTER TABLE public.vendor_sendcloud_credentials
  DROP COLUMN IF EXISTS sendcloud_public_key,
  DROP COLUMN IF EXISTS sendcloud_secret_key;

-- 3) Forcer is_connected à false pour toutes les lignes existantes,
--    puisque les clés en clair ont disparu et la connexion doit être re-vérifiée.
UPDATE public.vendor_sendcloud_credentials
   SET is_connected = false, last_verified_at = NULL
 WHERE is_connected = true OR last_verified_at IS NOT NULL;

-- 4) Retirer les anciennes politiques vendeurs qui donnaient un accès direct
DROP POLICY IF EXISTS "Vendors read own sendcloud credentials"   ON public.vendor_sendcloud_credentials;
DROP POLICY IF EXISTS "Vendors update own sendcloud credentials" ON public.vendor_sendcloud_credentials;
DROP POLICY IF EXISTS "Vendors insert own sendcloud credentials" ON public.vendor_sendcloud_credentials;

-- La policy admin "Admins manage all sendcloud credentials" est conservée pour le support.

-- 5) Révoquer tout accès direct à la table pour anon/authenticated
REVOKE ALL ON public.vendor_sendcloud_credentials FROM anon, authenticated;
GRANT  ALL ON public.vendor_sendcloud_credentials TO   service_role;

-- 6) Vue métadonnées (sans clé en clair ni ciphertext) lisible par les vendeurs propriétaires
CREATE OR REPLACE VIEW public.vendor_sendcloud_status_v
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.vendor_id,
  c.is_connected,
  c.last_verified_at,
  c.created_at,
  (c.public_key_cipher IS NOT NULL) AS has_public_key,
  (c.secret_key_cipher IS NOT NULL) AS has_secret_key
FROM public.vendor_sendcloud_credentials c;

GRANT SELECT ON public.vendor_sendcloud_status_v TO authenticated;

-- La vue est en security_invoker : il faut une policy SELECT pour que les vendeurs
-- voient leur propre ligne. On ré-autorise SELECT mais UNIQUEMENT via la vue
-- (les colonnes ciphertext ne sont pas exposées par la vue).
CREATE POLICY "Vendors read own sendcloud status row"
  ON public.vendor_sendcloud_credentials
  FOR SELECT
  TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

-- Re-grant SELECT colonne par colonne (exclut public_key_cipher / secret_key_cipher)
GRANT SELECT (id, vendor_id, is_connected, last_verified_at, created_at)
  ON public.vendor_sendcloud_credentials TO authenticated;

-- INSERT/UPDATE/DELETE restent interdits aux vendeurs : tout passe par l'edge function
-- vendor-sendcloud-credentials (service_role) qui chiffre les clés avant écriture.
