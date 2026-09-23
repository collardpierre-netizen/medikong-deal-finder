# Plan — edge function `scan-resolve` (LOT 1, non codée)

Entrée : `POST { code, mode: 'single'|'burst', country? }` (burst = tableau de codes, max 50). JWT obligatoire.

1. Garde : utilisateur → `customers` (direct ou `account_memberships`) ; refus si `site_config.scan_enabled` ou `customers.scan_enabled` est faux.
2. Normalisation : chiffres seuls. 8/12/13/14 chiffres + clé GS1 valide → GTIN ; 7 chiffres → CNK ; sinon `unknown`.
3. Recherche en cascade, arrêt au premier palier non vide :
   a. `products.gtin = code` (et variante 13↔14 chiffres avec zéro de tête)
   b. `product_market_codes.code_normalized = code`
   c. `products.cnk_normalized = code` (et CNK issu du GTIN si pertinent)
   Uniquement `is_active = true`.
4. Plusieurs fiches : `get_best_offers_for_products(ids, country, buyer_profile)` ; on garde celle qui a la meilleure offre active, statut `ambiguous_match`, `candidate_product_ids` = tous.
5. Prix de référence pharmacien : `market_prices.prix_grossiste` (source liée au grossiste du pharmacien) moins remise selon `override_rules_json` : marque > catégorie > générale > `override_default_discount_pct` > `wholesaler_profiles.default_discount_pct`. Affiché seulement si `display_prices_allowed` ou prix saisi par le pharmacien.
6. Verdict : `matched` (offre moins chère / pas moins chère), `no_offer`, `not_found` → proposition de sourcing (`sourcing_requests`, `source='scan'`, rattachée à l'item `buyer_comparator_sourcing_items` dédoublonné GTIN puis CNK).
7. Journalisation `scan_events` (service_role). Réponse : produit, offre (vendeur anonymisé via règles existantes), prix HTVA, écart, candidats.
8. Jamais renvoyé : prix d'achat, commissions, marges MediKong, identité vendeur non autorisée.

Format proposé `override_rules_json` (v2, rétro-compatible : absence de `version` = seul `override_default_discount_pct` compte) :

```json
{ "version": 2,
  "general_pct": 4,
  "categories": [{ "category_id": "uuid", "pct": 5 }],
  "brands": [{ "brand_id": "uuid", "pct": 8 }] }
```
