# Virement par défaut + activation par fournisseur

## Ce qui existe déjà
- Toute commande payée par virement déclenche déjà l'émission de la facture fournisseur « au nom et pour le compte de » + la facture de commission MediKong, avec l'IBAN MediKong comme compte de paiement.
- Le mandat de facturation signé par le fournisseur (`vendors.mandate_signed_at`) est déjà exigé : sans mandat, aucune facture n'est émise, une notification et une trace d'audit sont créées.

## Ce qui manque
Un interrupteur par fournisseur : aujourd'hui le comportement est global, il n'y a aucun moyen d'activer ou de suspendre ce mode pour un fournisseur donné.

## Ce que je propose de faire

### 1. Un réglage par fournisseur (base de données)
Ajout d'un indicateur `self_billing_enabled` sur la fiche fournisseur, activé par défaut (comportement actuel préservé, aucune commande existante modifiée).
Cela nécessite une migration versionnée — j'attends votre feu vert.

### 2. Écran d'activation « Facturation au nom et pour le compte »
Nouvelle page admin listant les fournisseurs avec, par ligne :
- l'état du mandat de facturation (signé le … / manquant),
- un interrupteur d'activation, désactivable seulement si le mandat est signé,
- l'IBAN MediKong utilisé comme compte de paiement, en rappel,
- un filtre « mandat manquant » pour repérer les fournisseurs bloquants.

Chaque changement est tracé (qui, quand) dans le journal d'audit existant.

### 3. Prise en compte à l'émission
L'émission de factures vérifie l'interrupteur en plus du mandat. Si le fournisseur est désactivé, aucune facture n'est émise et la raison est journalisée (comme aujourd'hui pour un mandat manquant).

## Hors périmètre
Aucune modification des commandes, montants, commissions ou factures déjà émises. Aucun envoi automatique d'e-mail ajouté. Aucun autre écran touché.

## Détails techniques
- Migration : `ALTER TABLE public.vendors ADD COLUMN self_billing_enabled boolean NOT NULL DEFAULT true;` (pas de RLS à changer, colonne sur table existante).
- `supabase/functions/_shared/order-invoices.ts` : lecture de `self_billing_enabled` dans le select vendors, court-circuit + trace si `false`.
- Nouvelle page `src/pages/admin/AdminSelfBilling.tsx`, route `/admin/facturation-mandat`, entrée dans `AdminSidebar`.
- Mise à jour du flag via `supabase.from("vendors").update(...)` (policies admin existantes), audit via le mécanisme d'audit déjà en place.
