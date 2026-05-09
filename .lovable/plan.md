# Calculateur d'économies — Plan d'implémentation

Feature majeure d'acquisition. Découpée en 6 lots livrables séquentiellement pour valider la valeur avant chaque étape coûteuse (Claude OCR, Resend, PDF).

## Pré-requis à confirmer avant le lot 1

1. **Clés API à fournir** (via secrets) : `ANTHROPIC_API_KEY` (Claude Sonnet vision) et `RESEND_API_KEY`.
   - Note : ce projet utilise déjà Lovable AI Gateway pour Gemini/GPT. Anthropic Claude n'est pas dans Lovable AI ; il faut donc ajouter le secret Anthropic.
   - Pour l'email, MediKong a déjà son infra email (templates React-Email, edge functions transactionnelles, DKIM/SPF). Le brief impose Resend ; **je propose plutôt d'utiliser l'infra email existante** (template `savings-report`) pour rester cohérent. À confirmer.
2. **Domaine de réception du PDF** : public (URL non-listée) → bucket `savings-reports` `public=true` + `X-Robots-Tag: noindex`. OK ?
3. **Table `admin_users`** dans le brief n'existe pas tel quel — on a `user_roles` + `is_admin()`. J'adapterai les RLS en conséquence.
4. **Table `supplier_offer_items`** mentionnée dans le brief n'existe pas — la source de vérité pour les prix MediKong est `effective_offer_prices_v` (vue unifiée). J'adapterai.

## Lot 1 — Schéma DB + Storage + RLS (1 migration)

- Tables : `savings_simulations`, `savings_simulation_lines`, `supplier_proprietary_codes`, `market_price_observations`.
- Vue agrégée k-anonyme `market_intelligence_v` (≥5 obs, security_invoker).
- Buckets Storage : `savings-uploads` (privé, 10 Mo, lifecycle 30j) et `savings-reports` (public).
- RLS strictes :
  - `savings_simulations` / `_lines` : SELECT public (UUID = capacité), aucune écriture client (service_role only).
  - `supplier_proprietary_codes` / `market_price_observations` / vue MI : `is_admin()` only.
- RPCs SQL : `match_product_by_name` (pg_trgm), `increment_proprietary_code_observation`, `cleanup_old_savings_uploads`.
- Cron `pg_cron` 03:00 UTC pour la purge.

## Lot 2 — Edge Function `process-savings-upload` (cœur métier)

Reçoit le multipart, upload dans Storage, insère la simulation en `processing`, lance le pipeline en arrière-plan via `EdgeRuntime.waitUntil`, répond immédiatement `{ id }`.

Pipeline :
1. **Extraction** : CSV → parser direct ; PDF/image → Claude Sonnet vision avec le prompt OCR figé du brief.
2. **Matching cascade** : CNK → EAN → `supplier_proprietary_codes` appris → `match_product_by_name` (pg_trgm ≥0.7) → `no_match`.
3. **Apprentissage** : tout match fuzzy avec un `proprietary_code` est upserté dans `supplier_proprietary_codes` (`match_method='llm'`).
4. **Calcul économies** : lecture du meilleur prix actif via `effective_offer_prices_v`.
5. **Observations marché** : insert dans `market_price_observations` (semaine ISO + bucket taille + région).
6. **Status final** : `done` / `no_match` / `failed`.

Endpoint frère `GET /process-savings-upload?id=...` pour le polling (3 s côté client).

## Lot 3 — Front public `/economies`

- `EconomiesPage.tsx` (landing + form) avec SEO H1 unique, hreflang.
- `SavingsCalculatorForm` en 3 étapes : grossiste → upload (drag-drop) → identité + consent unique obligatoire.
- Polling `useSavingsSimulation(id)` toutes les 3s avec React Query.
- **Résultat inline AVANT capture email** (point clé du brief) : héro chiffré, top 5 lignes, taux de match.
- `EmailCaptureCTA` post-résultat : déclenche la génération PDF + envoi email.
- `PrivacyTrustBanner` sous le formulaire + page dédiée `/confidentialite-economies`.
- Tracking GTM : 10 événements (`savings_landing_viewed` … `savings_signup_after`).
- Maj du CTA primaire de la HomePage : « Calculer mes économies en 60 secondes ».

## Lot 4 — Génération PDF + envoi email

- Edge Function `generate-savings-report` : pdfkit-style (on a déjà la skill PDF côté serveur via `_shared/contract-template.ts`). Layout : héro chiffré, top 10 lignes, QR code → `/inscription?ref={id}`, mention RGPD + lien suppression.
- Upload du PDF dans `savings-reports` ; URL publique avec `X-Robots-Tag: noindex` injecté via header de l'edge function de proxy.
- Template React-Email `savings-report` (infra existante) avec récap chiffré + 3 lignes preview + 2 boutons (télécharger / créer compte) + lien suppression.
- Idempotency key = `savings-report-${simulation_id}`.

## Lot 5 — Suppression RGPD + cron Storage

- Edge Function `delete-savings-simulation` (UUID = capacité, idempotente, audit_log).
- Edge Function planifiée `cleanup-savings-storage` (quotidienne 03:15 UTC) qui supprime les objets du bucket `savings-uploads` pour les simulations dont `source_file_url IS NULL`.

## Lot 6 — Back-office admin

Trois pages, accessibles via `is_admin()` :
1. `/admin/economies/codes-grossistes` — file de revue des `supplier_proprietary_codes` (status `llm` + obs ≥10 ou confidence <0.85). Boutons Valider / Réassigner / Rejeter.
2. `/admin/economies/simulations` — liste paginée filtrable des 100 dernières.
3. `/admin/economies/market-intelligence` — 4 onglets (top SKU, écarts MK vs grossiste, évolution prix grossiste, SKU manquants pour sourcing).

Cron SQL de promotion auto : `obs ≥10 AND confidence ≥0.85` → `auto_inferred`.

## Détails techniques transverses

- **Pas de `dangerouslySetInnerHTML`** sur les libellés OCR (tout passe par React).
- **Validation Zod** côté edge function pour l'input multipart.
- **Anti-DOS** : taille max 10 Mo enforcée côté edge ET côté bucket policy ; rate limit 5 simulations/heure/IP.
- **Région BE** : table `be_city_to_province` (mini-référence statique seedée) plutôt qu'objet TS hard-codé, pour pouvoir l'enrichir sans redeploy.
- **Money** : tout en euros décimaux (`numeric(12,2)`) ici car prix grossistes affichés en €, pas de conversion vers cents — sortie du standard MediKong (cents int) car ces prix viennent d'OCR et nécessitent la précision décimale native ; je documenterai cette exception en mémoire.

## Hors scope (rappel du brief)

- Pas de Stripe, pas d'admin fin des simulations au-delà du listing, pas d'autres grossistes que Febelco/CERP/Pharma Belgium, pas de scoring d'opportunité auto, pas d'ads.

## Livraison proposée

Lots 1+2 ensemble (pas de valeur sans le pipeline), puis lot 3 (UI publique testable), puis 4, 5, 6. Estimation : ~6-8 messages au total avec validation après chaque lot.

## À confirmer avant de démarrer

1. **Anthropic vs Lovable AI** : on garde Claude Sonnet (et tu fournis `ANTHROPIC_API_KEY`), ou on bascule sur `google/gemini-2.5-pro` via Lovable AI Gateway (vision multimodale, déjà câblé, pas de secret à ajouter) ?
2. **Resend vs infra email MediKong existante** : on garde Resend (et tu fournis `RESEND_API_KEY` + DKIM séparé) ou on utilise l'infra déjà en prod (template `savings-report` dans la registry transactionnelle) ?
3. **Bucket PDF public** : OK pour public + `X-Robots-Tag: noindex`, ou tu préfères URL signée 30 jours (plus sûr, mais expire) ?
4. **Démarre directement par le lot 1+2** une fois les 3 questions ci-dessus tranchées ?
