---
name: Revue catégories Qogita ambiguës
description: Page admin /admin/categories/qogita-mapping-review pour corriger la cible MK des propositions LLM medium-confidence (0.5-0.85) avant validation à l'unité
type: feature
---

## Page
- Route `/admin/categories/qogita-mapping-review` (composant `AdminQogitaAmbiguousReview`).
- Lit `category_llm_mapping_proposals` filtrée `status='pending'` + plage de confiance ajustable (défaut 0.5 ≤ conf < 0.85), tri produits desc, limite 500.
- Pour chaque ligne : Select des 14 catégories `mk-*` pré-rempli avec la suggestion LLM + option "(aucune)". L'admin peut corriger avant de cliquer **Valider**.
- Bouton **Rejeter** : passe la proposition à `rejected`.

## Workflow validate
1. Si l'admin a corrigé le slug → UPDATE `suggested_mk_slug` + `suggested_mk_category_id` sur la proposition (préfixe `[admin override]` ajouté à `reason` pour audit).
2. RPC `apply_qogita_llm_mapping(_proposal_id)` → crée l'alias dans `category_source_aliases` + UPDATE `products.primary_category_id`.

## Liens
- CTA "Revue ambiguës" ajouté dans le header de `/admin/categories/qogita-mapping-llm`.
- Lien retour vers `/admin/categories/dashboard` pour suivre la progression.
