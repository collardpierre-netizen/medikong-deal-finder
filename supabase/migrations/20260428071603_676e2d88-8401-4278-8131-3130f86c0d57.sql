-- ============================================================
-- SNAPSHOT DE SAUVEGARDE — Table brands
-- Date : 2026-04-28
-- Objectif : Sécuriser les données avant les migrations du sprint
--            "Refonte fiche labo / Système Transparence"
-- ============================================================

-- Étape 1 : Créer le snapshot complet de la table brands
-- (copie toutes les lignes + structure de colonnes, sans index/contraintes/RLS)
CREATE TABLE IF NOT EXISTS public.brands_backup_20260428 AS
SELECT * FROM public.brands;

-- Marquer la table comme snapshot temporaire pour faciliter le tri
COMMENT ON TABLE public.brands_backup_20260428 IS
  'Snapshot de la table brands pris le 2026-04-28 avant le sprint Transparence. À supprimer manuellement après validation production (~2026-05-28).';

-- ============================================================
-- PROCÉDURE DE RESTAURATION (en cas de problème)
-- ============================================================
-- Pour restaurer en cas de problème :
-- DROP TABLE public.brands CASCADE;
-- ALTER TABLE public.brands_backup_20260428 RENAME TO brands;
-- (puis recréer les contraintes, index, triggers et policies RLS
--  d'origine — voir les migrations précédentes du dossier supabase/migrations
--  pour la définition complète)
-- ============================================================
