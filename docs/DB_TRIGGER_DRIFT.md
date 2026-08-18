# Dérive hors dépôt des triggers & colonnes fantômes

## Ce qui s'est passé

`public.guard_customers_privileged_columns()` a été appliquée **directement en base**,
sans migration versionnée dans `supabase/migrations/`. Sa version en base référençait
`NEW.is_active` / `OLD.is_active`, colonne qui **n'a jamais existé** sur `public.customers`
(recopie du guard `vendors`, où la colonne existe).

Conséquence : toute écriture sur `customers` par un acteur **non admin / non service_role**
plantait (`record "new" has no field "is_active"`). La dérive a aussi fait perdre le
bypass `service_role`, présent dans la version d'origine.

Détecté le 17/08/2026 pendant la campagne de tests Peppol, corrigé par migration versionnée.

## Règles

1. **Aucune fonction ni trigger ne s'écrit directement en base.** Toute création ou
   modification passe par une migration versionnée, donc revue et rejouable.
2. Un guard recopié d'une autre table doit être relu colonne par colonne : les tables
   `customers` et `vendors` n'ont pas le même schéma.
3. Un guard `SECURITY DEFINER` doit conserver son bypass `public._is_admin_or_service()`,
   sinon les edge functions et les jobs backend sont bloqués eux aussi.
4. Une écriture en base qui échoue ne doit jamais être présentée comme réussie côté UI :
   on lit toujours l'`error` renvoyé par PostgREST avant de mettre à jour l'état local.

## Contrôle anti-régression

```bash
bun scripts/check-trigger-columns.ts
```

Le script confronte les références `NEW.<col>` / `OLD.<col>` du corps de chaque fonction
trigger `public` aux colonnes réelles de la table portant le trigger, et sort en code 1
dès qu'une colonne référencée n'existe pas. Il nécessite un accès `psql` en lecture
(variables `PG*`). À lancer après toute migration touchant un trigger ou supprimant /
renommant une colonne.

## État connu (17/08/2026)

`customers` est propre. Le script signale encore 4 fonctions porteuses du même défaut,
non corrigées à ce stade (en attente d'arbitrage) :

- `restock_transactions_block_buyer_sensitive_update()` — 7 colonnes fantômes sur `restock_transactions`
- `vendors_block_sensitive_self_update()` — `kyc_status`, `stripe_details_submitted`
- `_guard_vendors_privileged_cols()` — `stripe_details_submitted`
- `p2p_listings_block_unauthorized_field_updates()` — `offer_id`
- `_audit_rfq_external_invitation_ai()` — `expires_at`
