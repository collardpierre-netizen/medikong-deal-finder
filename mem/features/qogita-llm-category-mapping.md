---
name: Mapping LLM catégories Qogita (passe 2)
description: Pipeline LLM Gemini Flash Lite via Lovable AI Gateway pour mapper les ~2450 cats Qogita restantes vers les 14 cats MK ; dry-run obligatoire puis apply manuel ou bulk
type: feature
---

## Pipeline
- Edge function `classify-qogita-categories` (verify_jwt par défaut, admin only via is_admin RPC) : lit `admin_unmapped_qogita_categories`, batches de N (défaut 30, max 50), appelle Lovable AI Gateway (`google/gemini-2.5-flash-lite`) avec tool calling structuré (`classify_categories(results[])`), upsert dans `category_llm_mapping_proposals` (status=pending). Skip auto les cats déjà proposées sauf `force_resync`.
- Body : `{ batch_size?: 30, max_batches?: 10, force_resync?: false }`. Délai 250ms entre batchs.

## Table & RPCs
- `category_llm_mapping_proposals` (RLS admin) : qogita_category_id (UNIQUE), suggested_mk_slug + suggested_mk_category_id, confidence 0..1, reason, status pending/approved/rejected/applied, model.
- RPC `apply_qogita_llm_mapping(_proposal_id)` : crée alias `category_source_aliases` (notes='auto:llm-v1', upsert sur (source_path,source_locale)) + UPDATE direct `products.primary_category_id` (le trigger ne se déclenche que sur changement de category_id, donc backfill explicite). Marque la proposition `applied`.
- RPC `apply_qogita_llm_mappings_bulk(_min_confidence numeric default 0.75)` : applique en lot les pending au-dessus du seuil.

## UI
- Page admin `/admin/categories/qogita-mapping-llm` : bloc lancement (batch_size, max_batches, force_resync), 5 KPI cards (total/produits/conf ≥85%/60-85%/<60%), bulk apply avec seuil ajustable, table filtrable (statut, confiance min, recherche libellé), actions Appliquer/Rejeter par ligne.
- CTA "Mapping LLM (passe 2)" ajouté dans `/admin/categories/non-mappees`.

## Coût/perf
- Lovable AI Gateway : pas de clé OpenAI requise (LOVABLE_API_KEY auto). Embeddings reportés (passe 3 quand OPENAI_API_KEY sera dispo).
- Flow recommandé : run dry-run → trier par produits desc → bulk apply ≥0.85 → revue manuelle 0.6-0.85 → ignorer/rejeter <0.6.
