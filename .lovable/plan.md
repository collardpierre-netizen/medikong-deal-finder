
# Module Offre Pharmacien MediKong

Mise en place du modèle commercial acheteur : 6 mois free → bonus 6 mois si volume ≥ 6 000 € HT → sinon 199 €/mois, avec extension manuelle 3 mois sur demande téléphonique.

## 1. Migration SQL unique `pharmacist_subscription`

Crée tout le schéma en une migration :

- `pricing_plans` (référentiel) + seed `pharmacien_standard_2026` (6/6/3 mois, 6 000 €, 199 € HTVA, TVA 21 %).
- `buyer_subscriptions` (1 par buyer, statuts `trial|bonus_free|extension_free|paid|paused|canceled`, dates trial/bonus/extension/paid, volume tracking dénormalisé, `auto_switch_to_paid`).
- `subscription_events` (timeline append-only, `event_type` libre + payload jsonb).
- `subscription_extension_requests` (file commerciale : `pending|contacted|approved|rejected|expired`, contact_attempts, notes, assigned_to).
- Vue `v_buyer_subscription_overview` (phase courante, jours restants, % progression seuil, has_active_extension_request) en `security_invoker`.
- Helper `public.current_buyer_id()` (mappé sur `buyers.user_id = auth.uid()`).
- RLS sur les 4 tables (pharmacien voit ses données, admin tout, events read-only client).
- Trigger `AFTER INSERT ON buyers` → crée auto le `buyer_subscriptions` trial + 2 events (`subscription.created`, `trial.started`).
- Trigger `AFTER INSERT/UPDATE ON orders` (si table existe) → recalcule `trial_volume_ht` / `lifetime_volume_ht`, log `volume.threshold_reached` au franchissement. Sinon RPC `recompute_buyer_volume(buyer_id)` exposée pour branchement futur.
- RPCs admin : `grant_subscription_extension(req_id, months, notes)`, `force_bonus_volume(sub_id, reason)`, `force_switch_to_paid(sub_id)`, `pause_subscription(sub_id)`, `cancel_subscription(sub_id)`.
- RPC pharmacien : `request_subscription_extension(reason, callback_window)` (snapshot context, garde-fou anti-doublon).

Note : si la table `buyers` n'existe pas, on la crée minimale (`id, user_id, pharmacy_name, email, phone, status`).

## 2. Job quotidien (pg_cron 03:00 UTC)

Edge function `subscription-daily-tick` + cron pg_net :
- Bascule trial → bonus_free (si volume ≥ seuil) ou paid (sinon, si auto_switch).
- Bascule bonus_free / extension_free → paid à échéance.
- Met en pause toute bascule si `extension_request` active (event `trial.bascule_paused_pending_extension`).
- Reminders J-30 / J-7 / J-2 (idempotents via events `reminder.sent` payload offset_days).
- Expiration des `extension_requests` pending depuis >14j sans contact → `expired`.
- Tous les envois email = TODO (templates listés en commentaires, branchement Lovable Emails à faire en passe ultérieure).

## 3. Pages pharmacien (rôle `buyer`)

- **`/espace-pharmacie/abonnement`** : `<SubscriptionOverviewCard variant="full">` (chip statut, compteur jours, `<VolumeProgressBar>`, `<PhaseStepper>`), encadré "Besoin de plus de temps ?", panneau détails plan replié, `<SubscriptionTimeline audience="buyer">`.
- **`/espace-pharmacie/abonnement/demander-extension`** : `<ExtensionRequestForm>` (téléphone pré-rempli + plage de rappel + raison optionnelle + récap contexte), appelle RPC `request_subscription_extension`, redirige avec toast.
- Widget compact sur dashboard pharmacien existant + bannière < 30j.
- Onglet "Abonnement" dans la sidebar pharmacien (icône Sparkles, point orange si demande pending).

## 4. Pages admin

- **`/admin/abonnements`** : 4 KPI cards + `<AdminSubscriptionTable>` (TanStack Table) avec filtres (statut, phase, fenêtre fin de phase, seuil, demande active, recherche), actions par ligne, export CSV.
- **`/admin/abonnements/[id]`** : panneau identité + dates clés + notes inline, timeline complète, bloc actions (`<GrantExtensionModal>`, forcer bonus avec raison, basculer paid, pause, annuler, surcharger seuil).
- **`/admin/abonnements/demandes-extension`** : 3 onglets (À rappeler / Rappels en cours / Résolues 30j), tableau avec `tel:` clic-to-copy, drawer de détail, actions Prendre en charge / Marquer contacté / Accorder / Rejeter.
- Section sidebar admin "Abonnements pharmaciens" avec badge nb pending.

## 5. Page publique `/offre-pharmacien`

Landing prospects : Hero ("6 mois gratuits. Et probablement 6 de plus."), 3 colonnes (free/bonus/payant), pour qui, inclus, FAQ (4 questions), CTA inscription. SEO indexable. Lien dans le footer.

## 6. Composants UI réutilisables (`src/components/subscription/`)

`SubscriptionStatusChip`, `SubscriptionPhaseBadge`, `VolumeProgressBar`, `DaysRemainingCounter` (variant urgence auto), `SubscriptionTimeline` (audience buyer/admin), `PhaseStepper`, `ExtensionRequestCard`, `ExtensionRequestForm`, `GrantExtensionModal`, `SubscriptionOverviewCard` (variants compact/full), `AdminSubscriptionTable`. Réutilisation `KpiCard` admin existant.

Tous les textes copiés depuis la section 7 du prompt (chips, bandeaux, copy emails à laisser en TODO templates).

## 7. Inscription pharmacien

Encadré "Vos 6 mois gratuits démarrent maintenant" sur la page de confirmation (création abonnement déléguée au trigger DB).

## 8. TODOs explicites en code

Commentaires `// TODO(subscription):` couvrant : Stripe/Mollie SEPA, facturation Peppol mensuelle, branchement webhooks Slack équipe commerciale, templates Lovable Emails (8 templates listés), tests métier (cas A/B/C/D), instrumentation analytique conversion bonus/extension/rétention.

## Détails techniques

- Stack : React + TS + Tailwind + shadcn (existants). TanStack Query pour data, TanStack Table pour les tableaux admin.
- Fichiers : `src/pages/buyer/BuyerSubscription.tsx`, `BuyerSubscriptionRequestExtension.tsx`, `src/pages/admin/AdminSubscriptions.tsx`, `AdminSubscriptionDetail.tsx`, `AdminSubscriptionExtensionRequests.tsx`, `src/pages/OffrePharmacienPage.tsx`, hooks `useBuyerSubscription`, `useAdminSubscriptions`, `useExtensionRequests`.
- Routing : ajouter dans `App.tsx` (ou router central), route admin protégée par `useAdminAuth`, routes pharmacien protégées par auth `buyer`.
- Sidebar admin : nouvelle section dans `src/components/admin/AdminSidebar.tsx` (section `subscriptions`).
- Mémoire : sauvegarder un mémoire `mem://features/buyer-subscription-trial-bonus-paid.md` couvrant le modèle (statuts, transitions, seuil).

## Ordre d'exécution

1. Migration SQL (tables + RLS + triggers + RPCs + vue + helper + seed plan).
2. Trigger auto-create sur `buyers` + RPCs.
3. Edge function `subscription-daily-tick` + cron pg_net.
4. Composants UI partagés.
5. Pages pharmacien + widget dashboard + sidebar.
6. Pages admin + sidebar + détail + file extensions.
7. Page publique `/offre-pharmacien` + lien footer.
8. Mémoire projet + checklist d'acceptation vérifiée.

## Hors scope (TODO laissés en commentaires)

- Paiement réel (Stripe/Mollie SEPA) à la bascule paid.
- Émission facture Peppol mensuelle.
- Templates email Lovable Emails brandés (structure prête, envoi à brancher).
- Webhook Slack équipe commerciale sur `extension.requested`.
- Génération PDF `/offre-pharmacien.pdf`.
- Tests vitest/playwright des cas A/B/C/D.
