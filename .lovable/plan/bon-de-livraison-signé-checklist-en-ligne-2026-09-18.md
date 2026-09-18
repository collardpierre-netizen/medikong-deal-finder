# Bon de livraison signé + checklist en ligne

## Ce qui est déjà corrigé (fait, hors plan)

Après « Enregistrer » en édition d'une commande, la page de détail affichait encore l'ancienne liste
de produits (cache non rafraîchi). C'est corrigé : la ligne supprimée disparaît immédiatement.
La base était déjà à jour — seul l'affichage était en retard.

## Ce qui existe déjà

- Bons de livraison totaux/partiels avec reliquat (tables `delivery_notes` / `delivery_note_lines`),
  numérotation `BL-YYYY-####`, PDF imprimable, panneau visible côté admin et côté fournisseur.
- Envois d'e-mails transactionnels et pages publiques à jeton (déjà utilisés pour les devis / paiements).

## Ce qui manque et sera ajouté

### 1. Checklist à remettre au client (PDF)
Sur le PDF du bon de livraison : bloc checklist imprimable (colisage conforme, températures,
DLU/lot vérifiés, emballage intact, nombre de colis reçus) + zone de signature client
(nom, date, signature manuscrite) + zone remarques.

### 2. Confirmation en ligne par le client
- Lien unique par bon de livraison, envoyé par e-mail au client quand le fournisseur/admin
  déclare la livraison effectuée.
- Page publique (sans compte, non indexée) : le client cochait la checklist ligne par ligne,
  indique les quantités réellement reçues, signe au doigt/souris, ajoute des remarques
  et valide. Horodatage serveur enregistré (date/heure + adresse IP).
- Le résultat s'affiche côté admin et fournisseur, et est repris dans le PDF signé archivé.

### 3. Déblocage du paiement fournisseur
Trois issues possibles, décidées par l'admin à partir de la confirmation client :
- **Complet** : tout est conforme → paiement fournisseur autorisé pour la totalité.
- **Partiel** : écarts constatés (manquants, casse) → montant autorisé recalculé sur les
  quantités réellement acceptées.
- **Bloqué** : litige → aucun paiement autorisé, motif obligatoire.
L'écran admin de la commande affiche l'état de déblocage et le montant autorisé par fournisseur.

## Détails techniques

- Migration additive (aucune suppression) :
  - `delivery_notes` : `delivery_confirmation_token`, `confirmed_at`, `confirmed_by_name`,
    `signature_storage_path`, `client_remarks`, `confirmation_ip`, `checklist jsonb`.
  - `delivery_note_lines` : `accepted_quantity`, `refused_quantity`, `refusal_reason`.
  - Nouvelle table `delivery_payment_releases` (bon de livraison, fournisseur, décision
    complet/partiel/bloqué, montant autorisé HT, motif, auteur, horodatage) + GRANTs + RLS
    (admin complet, fournisseur lecture sur ses propres lignes, service_role complet).
  - RPCs : `delivery_note_public_get(token)`, `delivery_note_public_confirm(token, payload)`
    (anon, jeton uniquement, une seule confirmation), `set_delivery_payment_release(...)` (admin).
- Bucket privé `delivery-signatures` pour les images de signature, URL signées côté admin.
- Edge function d'envoi du lien + modèle d'e-mail transactionnel `delivery-confirmation-request`.
- Front : extension de `src/lib/delivery-note-pdf.ts` (checklist + signature), nouvelle page
  publique `/livraison/:token`, bloc « Déblocage paiement » dans `DeliveryNotesPanel`.

## Hors périmètre

Aucun changement sur les commandes, factures, commissions ou paiements existants.
Aucun paiement n'est déclenché automatiquement : la décision reste manuelle côté MediKong.
