-- Restreindre l'exécution des nouvelles fonctions SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.dispatch_brand_activation_notifications(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.dispatch_product_activation_notifications(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_brand_activation_notify() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_product_activation_notify() FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.admin_redispatch_catalog_notifications(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_review_product_submission(uuid, text, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_claim_product_submission(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_find_submission_duplicates(uuid) FROM anon, public;

-- Les admin RPCs restent appelables par 'authenticated' (le RPC vérifie is_admin() en interne).
GRANT EXECUTE ON FUNCTION public.admin_redispatch_catalog_notifications(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_product_submission(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_claim_product_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_find_submission_duplicates(uuid) TO authenticated;