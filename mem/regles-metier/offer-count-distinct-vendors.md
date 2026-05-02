---
name: Offer count = vendeurs distincts
description: products.offer_count compte les vendor_id distincts (pas les lignes offers), car un vendeur publie 1 offre commerciale déclinée sur N pays
type: feature
---

# Compteur d'offres affiché sur les cards catalogue

`products.offer_count` (maintenu par le trigger `update_product_aggregates`) =
**`COUNT(DISTINCT vendor_id)`** sur les offres actives, **pas `COUNT(*)`**.

## Pourquoi
La contrainte UNIQUE de `offers` est `(product_id, vendor_id, country_code)` :
un même vendeur (ex: Valerco BE/FR/NL/LU) crée 4 lignes pour la **même offre
commerciale** déclinée sur 4 pays. Compter les lignes ferait afficher
"4 offres" sur la card alors qu'il n'y a qu'**un seul fournisseur**.

## Convention produit
- Card catalogue / fiche produit : "N offres" = N fournisseurs distincts.
- Le filtrage par pays acheteur reste géré côté `products_with_country_stats_v`
  (cf. memory `catalog-country-aware-filters-sort`).

## Backfill
La migration recalcule `offer_count` pour tous les produits existants.
