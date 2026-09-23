# Roadmap

- [x] Lien Stripe vendeur : régénérer + copier + préparer l'e-mail depuis /admin/vendors-stripe
- [x] Adresse de livraison : lecture/écriture sur le compte acheteur actif + erreur visible si la sauvegarde échoue

## Lot sécurité (après LOT 1 Scan, migrations séparées)
- [ ] Règles d'affichage vendeurs : bloquer lecture directe, fonction serveur renvoyant uniquement le libellé ; tester fiche produit, verdict Scan, panier (compte pharmacien)
- [ ] Historique des prix : contient seulement prix de vente HTVA/TVAC par produit × pays (aucun prix d'achat ni vendeur), table vide, alimentée par scrape Qogita → proposé : laisser ouvert (attente décision)
- [ ] Réglages P2P : 1 ligne globale (commission par défaut, payeur, validité max, activé) → à décider avec ReStock

## LOT 1 Scan
- [ ] Migrations 0032 présentées, en attente GO
- [ ] scan-resolve + /admin/scan/imports après GO
