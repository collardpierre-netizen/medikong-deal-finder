# Plan — Broadcast RFQ + Console admin RFQ agrégée

## Décisions actées
1. **Ciblage** : suppression du cap Top 8. Tous les vendeurs éligibles (porteurs d'offre + intérêts marque/fabricant/produit/catégorie) sont notifiés. **Tous les filtres serveur actuels sont conservés** : KYC (`accepted`/`approved`), `accepts_rfq`, `max_open_rfqs`, devise, pays (ships_to_countries ∪ limitrophes), stock + MOQ pour la branche `product_offer`.
2. **Relances** : auto (templates T+24h / T+72h existants, inchangé) **+** relance manuelle admin avec choix du template existant (pas de message libre dans ce lot).
3. **Ajout manuel** : picker proposant uniquement les vendeurs **éligibles non encore ciblés** (mêmes filtres que le routing automatique).
4. **Console admin agrégée** : nouvelle page `/admin/rfq` (liste + détail).

## Périmètre — ce qui change

### 1. Backend — suppression du cap, conservation du scoring (pour info uniquement)

- `rfq_select_top_vendors` : on bypass la sélection Top N → renvoie **tous** les candidats éligibles renvoyés par `rfq_score_target_vendors`. Le score reste calculé pour affichage admin (ordre par défaut dans `/admin/rfq/:id`).
- `rfq_routing_settings.default_max_target_vendors` : conservé en colonne mais **ignoré** par `rfq_dispatch`. Un commentaire SQL le signale (utilisable plus tard si on veut revenir à un cap par RFQ via `rfqs.max_target_vendors`).
- `rfq_audit_routing` : le statut `over_cap` n'est plus produit (tous les éligibles passent en `selected`). On garde le code path pour rétrocompatibilité.

### 2. Backend — Ajout manuel d'un vendeur à une RFQ dispatchée

- Nouvelle RPC `rfq_admin_add_vendor(_rfq_id uuid, _vendor_id uuid, _reason text default 'manual')` SECURITY DEFINER, gated `is_admin()` :
  - Vérifie que le vendeur passe les filtres d'éligibilité (KYC + accepts_rfq + capacité + devise + pays + stock/MOQ si product_id). Renvoie une erreur explicite sinon.
  - Insert idempotent dans `rfq_dispatch_log` (UNIQUE `rfq_id`+`vendor_id`).
  - Crée la `vendor_notification` + déclenche l'email d'invitation (réutilise la logique de `dispatch-rfq`).
  - Audit dans `rfq_routing_audit_log` (`status='selected'`, `reason_code='manual_admin'`).
- Nouvelle RPC `rfq_admin_eligible_vendors_not_targeted(_rfq_id uuid)` : renvoie la liste paginable des vendeurs qui passeraient les filtres mais ne sont pas encore dans `rfq_dispatch_log` (pour alimenter le picker).

### 3. Backend — Relance manuelle admin

- Nouvelle RPC `rfq_admin_send_reminder_now(_rfq_id uuid, _vendor_id uuid, _template_id uuid)` SECURITY DEFINER, gated `is_admin()` :
  - Vérifie qu'une `rfq_dispatch_log` existe pour ce couple.
  - Vérifie qu'aucune relance déjà loggée pour la **vague courante** (sinon retourne `already_sent`).
  - Rend le template (mêmes variables que le cron), crée la `vendor_notification`, log dans `rfq_reminder_log` avec une marque `manual_admin = true` (nouvelle colonne booléenne, default false).
  - Bypass des conditions temporelles (T+24h / T+72h) puisque c'est volontaire admin.
- Aucune modif du cron auto (`send-rfq-reminders` reste tel quel).

### 4. Frontend — Console admin agrégée `/admin/rfq`

#### Page liste `/admin/rfq`
- KPIs (4 cards) : RFQ actives, en attente de réponse, RFQ sans aucune réponse à T+48h (à challenger), taux de réponse global 30j.
- Table paginée : RFQ ID court, acheteur (email), produit/marque, quantité, pays, deadline, statut (badge), # ciblés, # répondus, # déclinés, # vues, dernière activité, actions (Voir détail).
- Filtres : statut (multi), pays, période, recherche acheteur/produit, "uniquement RFQ sans réponse".
- Tri : par défaut deadline asc, sinon créés/ciblés/répondus.

#### Page détail `/admin/rfq/:id`
- En-tête RFQ : tous les champs (produit, brand, quantité, prix cible, pays, deadline, paiement, validité, commentaire, statut), bouton "Relancer le dispatch" (rejoue `dispatch-rfq` pour cibler de nouveaux vendeurs apparus depuis).
- Bloc **Funnel** : réutilise `RfqDispatchTracker` (chips ciblés/ouverts/cliqués/vus/relancés/répondus/refusés).
- Bloc **Acheteur** : réutilise `BuyerRfqTracker` pour la timeline.
- Bloc **Audit routing** : lien vers `/admin/rfq-routing-audit?rfq=<id>` + résumé inline (selected/excluded par reason_code).
- Bloc **Réponses** : table des `rfq_responses` avec score, prix, délai, conformité, attachments.
- Bloc **Vendeurs ciblés** : table enrichie de `RfqDispatchTracker` avec, par ligne :
  - Vendeur (nom + lien), source (`reason`), statut, dernière action, vagues de relance reçues.
  - Actions par ligne : **"Relancer maintenant"** (modal sélection template) → `rfq_admin_send_reminder_now`.
- Bloc **Ajouter un vendeur** : bouton ouvre un Dialog avec `Combobox` listant les vendeurs éligibles non ciblés (RPC `rfq_admin_eligible_vendors_not_targeted`), recherche par nom. Soumet → `rfq_admin_add_vendor`.

### 5. Mémoires à mettre à jour
- Mettre à jour `mem://features/rfq-vendor-prioritization` pour acter le broadcast (scoring conservé en affichage uniquement, plus de cap).
- Mettre à jour `mem://features/rfq-routing-audit-log` pour acter le retrait du statut `over_cap`.
- Nouvelle mémoire `mem://admin/rfq-console-aggregee` : page `/admin/rfq` + détail + RPCs `rfq_admin_add_vendor` / `rfq_admin_send_reminder_now` / `rfq_admin_eligible_vendors_not_targeted`.

## Hors scope (à confirmer pour un lot ultérieur)
- Cap par RFQ (`rfqs.max_target_vendors`) → infrastructure conservée mais pas d'UI.
- Vendeurs de **marques équivalentes** (extension future de la branche brand_interest).
- Messages libres pour relances manuelles (uniquement templates pour l'instant).
- Stop / annulation manuelle d'une RFQ depuis l'admin.

## Découpage en livraisons
1. **Migration DB** : modif `rfq_select_top_vendors`, nouvelles RPCs admin, colonne `rfq_reminder_log.manual_admin`. Linter après.
2. **Frontend** : page liste + page détail + modal "Ajouter vendeur" + modal "Relancer maintenant".
3. **Mémoires** : maj des 2 existantes + création de la nouvelle.

## Note technique sensible
La suppression du cap peut générer **20–50+ emails par RFQ** au lieu de 8. Les filtres `max_open_rfqs` (par vendeur) et `accepts_rfq` (opt-out) restent les seules vannes anti-spam. Si après quelques semaines tu constates de la friction vendeur, on pourra ré-activer un cap soft via `rfqs.max_target_vendors` sans migration supplémentaire (uniquement un toggle dans le code de `rfq_dispatch`).

OK pour lancer la migration DB (étape 1) ?
