-- ============================================================================
-- PURGE PRÉ-PRODUCTION — À EXÉCUTER MANUELLEMENT, UNE SEULE FOIS
-- ============================================================================
-- ⚠️  Volontairement placé HORS de supabase/migrations/ pour ne pas être
--     appliqué automatiquement par les migrations Lovable.
--     À copier/coller manuellement dans le SQL editor le jour de la bascule.
--
-- AVANT exécution :
--   1. Backup complet de la base (page admin /admin/db-backups)
--   2. Vérifier le compte exact de lignes impactées avec les SELECT correspondants
--   3. Exécuter dans une transaction et faire un ROLLBACK si le résultat surprend
--
-- Adapter les noms de tables si besoin avant exécution.
-- ============================================================================

BEGIN;

-- 1. Comptes utilisateurs de test
-- ⚠️  delete from auth.users CASCADE supprime aussi profiles, vendors associés, etc.
DELETE FROM auth.users
 WHERE email ILIKE '%@test.%'
    OR email ILIKE '%@example.com'
    OR email ILIKE '%@medikong.test'
    OR email ILIKE '%+test@%'
    OR email ILIKE '%@mailinator.com'
    OR email ILIKE '%@yopmail.com';

-- 2. Paniers actifs anciens (> 30 jours) — décommenter si tables présentes
-- DELETE FROM public.cart_items
--  WHERE cart_id IN (SELECT id FROM public.carts
--                     WHERE updated_at < now() - interval '30 days' AND status = 'active');
-- DELETE FROM public.carts
--  WHERE updated_at < now() - interval '30 days' AND status = 'active';

-- 3. Témoignages placeholder
-- DELETE FROM public.testimonials
--  WHERE body ILIKE '%lorem%' OR body ILIKE '%placeholder%'
--     OR body ILIKE '%à compléter%' OR author_name ILIKE '%test%';

-- 4. Logos partenaires placeholder
-- DELETE FROM public.partner_logos
--  WHERE image_url ILIKE '%placeholder%' OR image_url ILIKE '%example.com%';

-- 5. Promo codes / offres marketing de test
-- DELETE FROM public.promo_codes WHERE code ILIKE 'TEST%' OR code ILIKE '%-DEV';

-- 6. RFQs de test (jamais dispatchées)
-- DELETE FROM public.rfqs
--  WHERE status = 'draft' AND created_at < now() - interval '30 days';

-- 7. Search logs > 90 jours (RGPD)
-- DELETE FROM public.search_logs WHERE created_at < now() - interval '90 days';

-- ⚠️  Vérifier les lignes impactées AVANT de COMMIT.
-- ROLLBACK;
COMMIT;
