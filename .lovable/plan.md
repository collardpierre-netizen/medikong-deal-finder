# Facturation « au nom et pour le compte de » par défaut sur les virements

## Décision retenue
Option 1 : dès qu'une commande est payée par virement, MediKong émet automatiquement la facture au nom et pour le compte du fournisseur, avec l'IBAN MediKong comme compte de paiement. Pas d'écran d'activation par fournisseur.

## Ce qui existe déjà
- La facture « au nom et pour le compte de » est produite par la fonction `emit-self-billing-invoice` (PDF + mention légale du mandat + envoi Peppol acheteur et copie fournisseur).
- Elle est bien déclenchée pour les paiements passés par Stripe (carte et virement SEPA Stripe), via la confirmation de commande.
- Elle **n'est pas** déclenchée quand le virement est encaissé hors Stripe : commande passée en « paiement manuel » puis marquée payée, ou commande créée par l'admin avec paiement virement. C'est exactement le trou à combler.

## Ce que je change

### 1. Un point d'entrée unique
Nouvelle fonction serveur `emit-order-invoices` qui, pour une commande donnée, émet pour chaque fournisseur de la commande :
- la facture au nom et pour le compte du fournisseur (acheteur),
- la facture de commission (interne, jamais envoyée à l'acheteur).

Elle réutilise les fonctions existantes, reste idempotente (une commande déjà facturée ne l'est pas deux fois) et ne modifie ni les montants ni les commissions.

### 2. Déclenchement au passage en « payé »
- Quand l'admin marque une commande virement comme payée (éditeur de commande), la nouvelle fonction est appelée juste après l'enregistrement.
- Le webhook Stripe garde son comportement actuel : il appellera le même point d'entrée, donc un seul chemin de code à maintenir.

### 3. Filet de sécurité horaire
Un balayage automatique repère les commandes payées par virement qui n'ont pas encore de facture fournisseur et les rattrape. Cela couvre les paiements encaissés en banque sans passer par l'application.

### 4. Garde-fou mandat
Si le fournisseur n'a pas de mandat de facturation signé, aucune facture n'est émise en son nom : la commande est signalée à l'admin (notification + trace) pour régularisation. Émettre sans mandat serait juridiquement invalide.

## Ce que je ne touche pas
- Aucune modification des commandes existantes, des montants, des commissions ni des factures déjà émises.
- Pas de réglage par fournisseur (option 2 écartée).
- Pas de changement sur les commandes carte, ni sur Peppol, ni sur les reversements Stripe.

## Point nécessitant votre autorisation explicite
Le filet de sécurité horaire (point 3) demande une tâche planifiée en base, donc une migration versionnée. Dites-moi si je l'inclus, ou si je m'arrête au déclenchement direct (points 1, 2 et 4) sans aucune migration.

## Détails techniques
- Extraction de `emitOrderInvoices` de `supabase/functions/stripe-webhook/index.ts` vers `_shared`, consommée par la nouvelle fonction `emit-order-invoices`.
- Sélection des commandes : `payment_status = 'paid'` et `payment_method = 'bank_transfer'`, absence de ligne `order_invoices` de type `self_billing` pour le couple commande/fournisseur.
- Contrôle mandat sur `vendors.mandate_signed_at` avant émission ; sinon `vendor_notifications` + `audit_logs`.
- Appel front depuis `src/pages/admin/AdminCommandeManuelle.tsx` après succès de l'enregistrement.
