# Plan — edge function `scan-resolve` (LOT 1, non codée)

Entrée : `{ raw_code, symbology: 'ean13'|'datamatrix'|'manual_cnk'|'other', session_id?, mode: 'single'|'burst' }`. JWT validé en code.

1. **Garde** : utilisateur → `customers` (direct ou `account_memberships`). Refus 403 si `site_config.scan_enabled` ou `customers.scan_enabled` est faux.
2. **Parser**
   - EAN-13 : clé GS1 vérifiée → GTIN.
   - DataMatrix GS1 (séparateur FNC1 / `\x1d`, ou `]d2`) : AI 01 → GTIN (14 → 13 si zéro de tête), AI 17 AAMMJJ → `expiry_date` (JJ=00 → dernier jour du mois), AI 10 → lot. **AI 21 ignoré et supprimé de `raw_code` avant stockage.**
   - CNK saisi : 7 chiffres.
3. **Produit** (actif uniquement) : `products.gtin` → `product_market_codes.code_normalized` → `products.cnk_normalized`. Plusieurs fiches : on garde celle qui a la meilleure offre active, `match_status='ambiguous_match'` + `candidate_product_ids`.
4. **Meilleure offre** : `get_best_offers_for_products` (réutilisée). Libellé vendeur via les règles d'affichage existantes (équivalent serveur de `resolveVendorLabel`), jamais le nom brut.
5. **Prix de référence** (service_role) : pour chaque ligne `pharmacist_wholesaler_settings` du compte → dernier `market_prices.prix_grossiste` de la source liée au grossiste × (1 − remise). La remise suit la priorité marque > catégorie > générale (`override_rules_json` v2) > `override_default_discount_pct` > `wholesaler_profiles.default_discount_pct`. Les labos en direct sont ignorés au MVP. On garde le minimum → `ref_price_excl_vat`, `ref_source`.
6. **Verdict** : delta = ref − best. Vert si delta ≤ 0 ; orange si 0 < delta/ref ≤ 10 % ; rouge au-delà ; `none` sans référence (message « Ajoutez vos conditions pour voir votre gain »).
7. **Masquage** : si `display_prices_allowed = false`, pas de détail par grossiste, seulement « Votre meilleur prix actuel : X € ».
8. **Ruptures** : `stock_signals: []` jusqu'au LOT 3.
9. **Journal** : exactement une ligne `scan_events` par appel, y compris en erreur métier (`unknown`), avec `latency_ms`.
10. **Réponse** : `{ scan_event_id, product{id,name,pack,cnk,image}, lot, expiry_date, verdict, delta, best{price, vendor_label, franco, lead_time_days, offer_id}, references[{source,label,discount_pct,net}], stock_signals, in_test_scope, match_status, candidates }`. Montants en euros.
11. **Performance** : 3 à 4 requêtes groupées, index sur GTIN/CNK normalisés, objectif p95 < 400 ms.

Format `override_rules_json` v2 (rétro-compatible) :

```json
{ "version": 2, "general_pct": 4,
  "categories": [{ "category_id": "uuid", "pct": 5 }],
  "brands": [{ "brand_id": "uuid", "pct": 8 }] }
```

## Page `/admin/scan/imports` (après GO)
Upload CSV/XLSX → choix grossiste (`wholesaler_profiles`) + mois → mapping colonnes (CNK, EAN, prix pharmacien HTVA) → aperçu → import dans `market_prices` (source liée au grossiste, période = 1er du mois). Rattachement par CNK normalisé puis GTIN. Rapport : lignes importées, non rattachées, écarts > 15 % vs mois précédent, propositions d'EAN manquants (`product_gtin_proposals`, validation admin avant écriture).

## Tests d'acceptation prévus
- RLS avec deux comptes pharmaciens : A ne lit pas les réglages de B.
- Un admin ne lit pas `pharmacist_wholesaler_settings`.
- Parser DataMatrix NAN réel : GTIN, lot et péremption corrects, AI 21 absent de la base.
- Test unitaire : la remise marque passe avant la remise générale.
- Un appel crée exactement une ligne `scan_events`.
