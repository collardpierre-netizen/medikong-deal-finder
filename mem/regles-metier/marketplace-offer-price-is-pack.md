---
name: Prix offre marketplace = prix du PACK
description: offers.price_excl_vat est le prix de l'unité de vente vendeur = prix du pack (pas l'unitaire). Dériver l'unitaire = pack ÷ packSize.
type: feature
---
**Source de vérité** : dans `public.offers`, les colonnes `price_excl_vat` et
`price_incl_vat` représentent le prix de **l'unité de vente côté vendeur**,
c'est-à-dire le prix d'**UN pack** (le pack étant l'unité commandable, MOQ exprimé
en packs). Ce N'EST PAS un prix unitaire.

Exemple : Fortimel Compact 4×125 ml chez Valerco → `price_excl_vat = 8.39`,
`pack_size_override = 4`. Le vrai prix unitaire HTVA = 8,39 / 4 = **2,0975 €/u**.

**Côté front (`Offer.unitPriceEur`)** : la valeur exposée par `useProductOffers`
est donc le prix du PACK, malgré son nom historique trompeur. Tout consommateur
qui veut afficher un €/u DOIT diviser par le packSize résolu via
`resolvePackSize({ offerOverride, productPackSize, productName })`.

Helpers :
- `priceFromUnit(unitPrice, basis, packSize)` attend un **vrai unitaire** en entrée.
- `ProductPage.tsx` calcule `bestOfferPackPrice` (= valeur DB) puis
  `bestOfferUnitPrice = bestOfferPackPrice / packSize` ; tous les comparateurs
  (Marketplace tab, Référence MediKong, Prix du marché) consomment l'unitaire
  dérivé.

**Anti-pattern** : utiliser `bestOffer.unitPriceEur` directement comme €/u puis
appliquer `priceFromUnit(..., 'pack', packSize)` → produit un faux prix pack
multiplié 2× (vu sur Fortimel : 33,56 € au lieu de 8,39 €).
