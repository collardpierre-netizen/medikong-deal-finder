# N° de PO sur les commandes + site de livraison sur les bons de commande fournisseurs

Rien n'existe aujourd'hui dans l'application pour ces deux points.

## 1. N° de PO client sur une commande
- Champ « N° de PO » (texte libre, plusieurs N° possibles séparés par des virgules) sur la fiche commande admin, modifiable.
- Option : un N° de PO par fournisseur (sous-commande) si le client en émet un par fournisseur.
- Affiché sur le bon de commande fournisseur (PDF), en haut à côté du N° de commande.
- Aussi saisissable par l'acheteur au moment de la commande (facultatif) — à confirmer.

## 2. Site de livraison sur le bon de commande fournisseur
Bloc « Livraison » sur le PDF, repris de la commande :
- Nom du site, adresse complète
- Contact sur place + téléphone
- Horaires de réception (ex. lun–ven 8h–12h)
- Instructions / modalités (quai, rendez-vous obligatoire, étage, code d'accès, hayon…)

Les sites de livraison seraient enregistrés sur le client (réutilisables d'une commande à l'autre), en complétant les adresses de livraison client déjà existantes, puis copiés sur la commande au moment de la commande (pour que le bon ne change pas si le client modifie ensuite son site).

## Détails techniques
- Migration additive (en ligne immédiatement, GO requis) :
  - `orders.po_numbers text` et `order_lines`/sous-commande : `vendor_po_number text` (si option par fournisseur).
  - `customer_shipping_addresses` : `contact_name`, `contact_phone`, `delivery_hours`, `delivery_instructions`.
  - `orders.delivery_site_snapshot jsonb`.
- Front : fiche commande admin (saisie PO + choix du site), `src/lib/vendor-order-pdf.ts` (PO + bloc livraison), fonction serveur du bon fournisseur si elle génère aussi le document.
- Publication : « GO PUBLICATION ».

## Hors périmètre
Factures, bons de livraison et e-mails inchangés sauf demande.
