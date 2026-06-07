# Exclusivités vendeurs — plan en 3 lots

Tu as choisi **D** : on livre tout, dans l'ordre, en lots indépendants déployables un par un. Le Lot 1a (table `vendor_exclusivities` + triggers write-side + RPC `resolve_offer_exclusivity` + cron expiration) est déjà en place ; on construit dessus.

---

## Lot 1b — Schéma étendu (ciblage acheteurs + conditions)

**Objectif :** rendre l'exclu conditionnable (qui ? combien ? combien de temps ?).

Migration sur `public.vendor_exclusivities` :
- `buyer_profile_ids uuid[] NULL` — null = tous profils ; sinon restreint à pharmaciens / médecins / vétos / etc. (référence `buyer_profiles.id`).
- `min_revenue_cents bigint NULL` — CA minimum engagé sur la période.
- `min_volume_units integer NULL` — volume minimum engagé.
- `commitment_months integer NULL` — durée d'engagement contractuelle (informative + utilisée pour alertes fin de période).
- `conditions_notes text NULL` — clause libre (markdown court).
- `contract_ref text NULL` — référence interne contrat/avenant.
- Index GIN sur `buyer_profile_ids` pour le filtrage runtime.

Mise à jour `resolve_offer_exclusivity(_offer_id, _country, _buyer_profile_id)` :
- Ajoute le 3e paramètre `_buyer_profile_id uuid` (NULL = anonyme/visiteur).
- Une exclu matche si : `buyer_profile_ids IS NULL OR _buyer_profile_id = ANY(buyer_profile_ids)`.
- Anonyme + exclu ciblée → comportement `mode=showcase` par défaut (vitrine), pas de hide/block (sinon on casserait SEO public).
- Cascade product > brand > manufacturer > category inchangée.

Helpers SQL nouveaux (consommés par Lot 3) :
- `current_buyer_profile_id()` SECURITY DEFINER — résout le profil acheteur de `auth.uid()` via `user_profile_assignments` → `profile_visibility` → mapping vers `buyer_profiles`.
- Vue `effective_offer_exclusivity_v` (security_invoker) : pour chaque offer active, expose `vendor_id, mode, exclu_id, scope, applied_buyer_profile_id`.

Aucun changement RLS sur `vendor_exclusivities` (déjà gérée Lot 1a).

---

## Lot 2 — Admin UI `/admin/exclusivites`

Page React (sidebar section "management" entre `delegates` et `pimSchemas`).

Composants :
- **Liste** : table filtrable (scope, vendor, mode, pays, état actif/expiré/futur), badge couleur par mode (showcase=bleu / hide=ambre / block=rouge).
- **Drawer création/édition** :
  - Step scope : radio product / brand / manufacturer / category + picker async correspondant (réutilise `ProductPicker`, `BrandPicker`, etc.).
  - Step vendor : `VendorPicker` (vendeurs `is_active=true`).
  - Step règles : mode (radio), pays (multi-select avec chips), profils acheteurs (multi-select `buyer_profiles`, vide = tous).
  - Step conditions : CA min (€), volume min (u), durée engagement (mois), réf contrat, notes (textarea).
  - Step dates : `valid_from` (default today), `valid_until` (obligatoire, validé côté UI).
- Actions : créer, éditer, **désactiver** (set `valid_until=now()`), dupliquer.
- Alerte overlap : appel `resolve_offer_exclusivity` côté UI pour preview "Cette règle écrasera N offres existantes".

Pas de bulk actions au Lot 2 (à voir plus tard).

---

## Lot 3 — Consumers (catalogue, fiche produit, RFQ)

Activation des modes `hide` et `block` côté lecture.

### 3.1 — Catalogue & fiche produit
- `useProductOffers` : après fetch des offres, croise avec `effective_offer_exclusivity_v` + `current_buyer_profile_id()` :
  - `mode=showcase` → badge "Exclusivité <vendor>" sur la card offre (UI uniquement).
  - `mode=hide` → l'offre disparaît de la liste, **sauf** celle du vendeur exclusif.
  - `mode=block` → idem hide + bandeau "Distribution exclusive — contactez <vendor>" sur la fiche produit.
- `useCatalogProducts` (vue `products_with_country_stats_v`) : ajouter colonne `exclusive_vendor_id` calculée, et au tri `cheapest`/`relevance` n'agréger que les offres visibles pour le profil courant.

### 3.2 — RFQ routing
- `rfq_resolve_target_vendors` : filtrer les candidats par exclusivité. En `mode=block`, seul le vendeur exclusif est éligible pour la marque/produit/fabricant ciblé.
- Trace `reason_code=exclusivity_block` / `exclusivity_excluded` dans `rfq_routing_audit_log`.
- Badge "Exclu" dans `RfqDispatchTracker` quand un vendeur est sélectionné/exclu via exclu.

### 3.3 — Badge acheteur réutilisable
- Composant `<ExclusivityBadge mode scope vendor />` (showcase = label "Exclusivité", block = "Distribution exclusive") — utilisé fiche produit, cards, page marque, RFQ.

---

## Détails techniques transverses

- **Money cents / UTC** : `min_revenue_cents` int, dates UTC.
- **i18n** : labels FR (Bricolage Grotesque / DM Sans), réservation clés NL/EN à plat (pas de traduction auto Lot 2/3).
- **Mémoire** : à chaque lot livré, j'étends `mem://features/vendor-exclusivities` avec ce qui a été ajouté.
- **Tests** : un test SQL `vendor_exclusivities_self_test()` côté Lot 1b (matrice scope × mode × profil × pays), 0 test e2e UI (à la demande seulement).
- **Hors scope explicite** : facturation automatique des engagements CA, alertes "fin d'exclu dans X jours", contractualisation PDF — à proposer dans un Lot 4 séparé si tu valides la base.

---

## Ordre de livraison

1. **Lot 1b** (1 migration + 1 RPC mise à jour + 1 vue) — pas d'impact UI, pas de risque catalogue.
2. **Lot 2** (page admin + drawer CRUD) — visible admin uniquement.
3. **Lot 3** (consumers catalogue + fiche + RFQ) — impact acheteur, à activer après QA Lot 2.

Tu valides ce plan, je démarre par **Lot 1b** seul et je te montre la migration avant exécution.
