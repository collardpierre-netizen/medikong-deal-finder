-- Sécuriser le snapshot : activer RLS sans aucune policy
-- => aucun accès via PostgREST (anon/authenticated), seul service_role peut lire
ALTER TABLE public.brands_backup_20260428 ENABLE ROW LEVEL SECURITY;

-- Révoquer explicitement les droits PostgREST pour être 100% sûr
REVOKE ALL ON public.brands_backup_20260428 FROM anon, authenticated;
