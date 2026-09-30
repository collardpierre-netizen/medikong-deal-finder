# Paiement sur facture par fournisseur, pour une sélection d'acheteurs

## Ce que vous pourrez faire (admin)
Sur la page **Utilisateurs** :

1. **Sélection** : vous cochez plusieurs acheteurs, ou « tout sélectionner » après un filtre.
2. **Action** : vous cliquez sur « Conditions de paiement ».
3. **Règle** : vous choisissez :
   - **Fournisseur** : par exemple Fixmer Pharma.
   - **Mode** : paiement sur facture.
   - **Délai** : 30 jours, ou 15, 45, 60 jours, ou un nombre libre.
   - **Plafond d'encours** (facultatif) : montant non encore payé au-delà duquel la facture n'est plus proposée. Le champ vide signifie sans plafond.
4. **Application** : vous validez. Un récapitulatif indique X acheteurs mis à jour et Y qui avaient déjà cette règle (elle est alors remplacée).

Sur la fiche d'un acheteur, un encart **« Conditions de paiement »** liste ses règles, par exemple « Fixmer Pharma — sur facture 30 j ». Vous pouvez les modifier ou les retirer.

## Ce que voit l'acheteur au paiement
Le panier est coupé en deux blocs :

- **« Sur facture — 30 jours »** : les produits Fixmer. Rien à payer maintenant. La facture arrive avec l'échéance indiquée.
- **« À payer maintenant »** : le reste du panier, par virement ou en ligne, comme aujourd'hui.

Le montant à payer maintenant n'est que le solde. Si tout le panier est sur facture, l'acheteur valide la commande sans aucun paiement.

La commande apparaît comme « paiement mixte ». Chaque partie fournisseur garde son mode : la partie sur facture est envoyée au fournisseur tout de suite, la partie à payer attend le paiement comme aujourd'hui.

## Contrôles
- Les règles ne sont modifiables que par un admin. La vérification se fait côté serveur : un acheteur ne peut ni ajouter ni forcer une règle.
- Le montant à payer est recalculé côté serveur à la création de la commande. L'écran seul ne suffit pas pour obtenir la facture.
- Un acheteur non validé ne voit jamais l'option facture.
- Les commandes existantes ne changent pas.

## Points à confirmer avant de commencer
1. **Qui émet la facture « 30 jours »** : Fixmer directement, ou MediKong au nom et pour le compte de Fixmer (mandat du 29/09) ? Cela détermine qui suit l'échéance et les relances.
2. **Plafond d'encours** : le garder facultatif, ou le supprimer entièrement ?
3. **Frais de port** : le port d'une partie sur facture (par exemple 9,50 € sous le franco Fixmer) est-il facturé avec elle ?

## Mise en ligne
- Il faut un changement de base (une nouvelle table de règles), qui sera en ligne immédiatement puisque l'aperçu et le site partagent la base. Il faut votre GO.
- Le paiement coupé en deux demande ensuite votre **GO PUBLICATION**.
- Je testerai sur un compte de test uniquement, jamais sur une vraie officine.

## Hors périmètre
- La création de comptes en masse, faite au tour précédent, est en attente de GO PUBLICATION.
- Les points 1 à 3 d'avant (champ APB sans titre, emails d'inscription, tri des comptes en attente) sont inchangés.
- L'alerte de sécurité sur les profils acheteurs reste ouverte, comme vous l'avez décidé.

## Détails techniques
- Nouvelle table `buyer_vendor_payment_terms` : `customer_id`, `vendor_id`, `method` ('invoice'), `terms_days`, `credit_limit_cents` (nullable), `is_active`, `created_by`, horodatages, et une contrainte d'unicité (`customer_id`, `vendor_id`).
  - Droits : RLS lecture réservée à l'admin et au client concerné ; écriture réservée à l'admin, via une fonction serveur d'application en masse avec entrée dans le journal admin.
- Au paiement : les lignes sont regroupées par vendeur. Si une règle active existe pour ce vendeur, le groupe passe en « invoice ». Le total restant passe par le virement ou Stripe existants, et `orders.payment_method` vaut 'mixed' ou 'invoice'.
  - La répartition est recalculée dans la fonction de création de commande.
- Le champ existant `customers.payment_terms_days` (inutilisé, 0 partout) n'est pas touché.
