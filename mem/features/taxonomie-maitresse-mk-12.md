---
name: Taxonomie maîtresse MK 12+2
description: 14 catégories maîtresses MediKong (slug mk-*), mapping regex vers cats Qogita, trigger auto, sidebar /catalogue limitée à mk-*
type: feature
---

## Schéma
- `categories` étendu : 14 lignes `slug LIKE 'mk-%'`, `name` préfixé `MK · ` (contrainte `categories_name_unique` existante), `name_fr/nl/en` localisés. 12 `is_featured_top=true` (display_order 1..12) + 2 secondaires (90..91).
- Slugs : mk-otc-medicaments, mk-complements-nutrition, mk-hygiene-desinfection, mk-pansements-soins-plaies, mk-diagnostic-autonomie, mk-soins-infirmiers, mk-maman-bebe, mk-dermatocosmetique, mk-soin-corps-mains, mk-capillaire-coiffure, mk-maquillage-ongles, mk-parfumerie, mk-medecines-complementaires, mk-hygiene-domestique.
- `category_source_aliases` : nouvelle contrainte `category_source_aliases_path_locale_uniq (source_path, source_locale)`. Aliases auto-générés notés `notes='auto:regex-v1'`.

## Mapping
- Regex côté SQL (Postgres `\y` pour word boundary, `~*` pour ILIKE), priorisée pour éviter les multi-matches (ex: parfumerie > capillaire > makeup > body > dermo …).
- Trigger `BEFORE INSERT OR UPDATE OF category_id ON products` → `auto_set_primary_category()` : remplit `primary_category_id` à partir de `category_id → categories.name → category_source_aliases (source_locale='en')`.
- Vue admin `admin_unmapped_qogita_categories` (security_invoker) : catégories Qogita non encore aliasées, triées par volume produits décroissant.

## État après passe 1
- 738 / 3187 catégories Qogita mappées (~23%) — couvre ~55% des produits (229k/415k). Cible 90% → passe 2 prévue (embeddings + LLM sur le résiduel).

## Front
- `useCatalogCategories` (src/hooks/useCatalog.ts) : retourne uniquement les 14 catégories `mk-*` à plat (pas d'arborescence L2/L3), triées par `display_order`. `product_count` non calculé en V1 (RPC `count_products_per_category` clé sur `category_id`, pas `primary_category_id`).
- `useCatalogProducts` détecte `filters.category` commençant par `mk-` → filtre via `primary_category_id IN (mk_id)` au lieu de `category_id IN (cat + children)`. Géré via `applyCatalogProductFilters` option `categoryColumn`.
- Sidebar `/catalogue` (CatalogSidebar.tsx) inchangée — consomme la liste à plat.
- Hero home : H1 + sous-titre repositionnés beauté/soin/santé (FR/NL/EN dans i18n).

## Hors-scope
- Pas de modification des 3187 catégories Qogita (pipeline d'import inchangé).
- `category_id` (Qogita) et `primary_category_id` (MediKong) coexistent.
- 2e passe (embeddings/LLM) sur le résiduel à venir.
