# Suivi des virements reçus

Objectif : pouvoir enregistrer, sur une commande payée par virement, le paiement reçu sur le compte MediKong, avec sa date, son montant et son état, et le confirmer d'un clic.

## Ce que vous verrez

Un nouveau bloc « Virements reçus » sur la fiche d'une commande en admin :

- La liste des virements déjà enregistrés : date de valeur, montant, état, référence bancaire, commentaire.
- Un formulaire d'ajout : date, montant, référence, commentaire, état initial.
- Trois états possibles : **En cours** (annoncé, pas encore sur le compte), **Reçu** (vu sur le compte), **Encaissé** (définitivement acquis).
- Un bouton **Confirmer l'encaissement** sur chaque ligne, qui passe l'état à « Encaissé » et horodate qui a confirmé.
- Un rappel du total encaissé face au total TTC de la commande, avec l'écart éventuel (partiel / trop-perçu).

Les commandes déjà existantes ne sont pas modifiées : elles apparaissent simplement sans virement enregistré.

## Détails techniques

- Nouvelle migration versionnée :
  - type `bank_transfer_state` : `pending`, `received`, `settled`
  - table `public.order_bank_transfers` : `id`, `order_id` (FK `orders(id)` ON DELETE CASCADE), `value_date date`, `amount_cents integer NOT NULL CHECK > 0`, `state bank_transfer_state NOT NULL DEFAULT 'pending'`, `bank_reference text`, `note text`, `confirmed_by uuid`, `confirmed_at timestamptz`, `created_by uuid`, `created_at/updated_at timestamptz`
  - index sur `order_id`
  - `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` + `GRANT ALL ... TO service_role` (pas d'accès `anon`)
  - RLS activée, policies réservées aux admins via `is_admin()`
- Nouveau composant `src/components/admin/OrderBankTransfersPanel.tsx` (liste + formulaire + bouton de confirmation, React Query), monté dans `src/pages/admin/AdminCommandeDetail.tsx`.
- Aucun changement sur les montants, statuts de commande, factures, commissions ou flux Stripe existants : ce suivi est purement déclaratif côté trésorerie.

## Hors périmètre (à valider séparément si vous le souhaitez)

- Passage automatique du statut de la commande à « payée » lors de la confirmation d'un encaissement.
- Déclenchement automatique des factures fournisseur/commission depuis ce bloc.
- Rapprochement bancaire automatique (import CODA/CSV).
