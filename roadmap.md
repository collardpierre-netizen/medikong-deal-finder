# Roadmap

- [x] Lien Stripe vendeur : régénérer + copier + préparer l'e-mail depuis /admin/vendors-stripe
- [x] Adresse de livraison : lecture/écriture sur le compte acheteur actif + erreur visible si la sauvegarde échoue

## Lot sécurité (après LOT 1 Scan, migrations séparées)
- [ ] Règles d'affichage vendeurs : bloquer lecture directe, fonction serveur renvoyant uniquement le libellé ; tester fiche produit, verdict Scan, panier (compte pharmacien)
- [x] Historique des prix : laissé ouvert (décision Pit, prix de vente publics uniquement)
- [x] Réglages P2P : laissé ouvert (décision Pit)
- [ ] market_prices : contrainte unique existante (source, CNK) empêche de garder plusieurs mois par source — à arbitrer

## LOT 1 Scan
- [x] Migrations 0032 appliquées + index CNK normalisés créés en CONCURRENTLY
- [x] scan-resolve déployé (parser GS1, remise marque>catégorie>générale, verdict, journal)
- [x] Page /admin/scan/imports (upload, mapping, aperçu, rapport écarts >15 % via market_price_history)
- [ ] Propositions EAN (gtin vide complété par CNK) + écran de validation — à faire
- [x] Test live « 1 appel = 1 ligne » (Pharmacie Test MediKong)
- [ ] Scan DataMatrix réel NAN — en attente des contenus bruts de l'utilisateur
- [x] Sécurité 1 : règles d'affichage vendeurs (fonction serveur)
- [ ] LOT 2 onboarding : texte « Jamais partagées avec un grossiste, un labo ou une autre pharmacie. » (remplace « Visibles par vous seul »)
