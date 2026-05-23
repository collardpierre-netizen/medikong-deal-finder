# LOT 0a — Fondations scan facture pharmacien

Pivot complet : on quitte le sujet pickup ReStock pour poser les fondations du scan de factures grossistes (Phoenix, Febelco, CERP, Pharma Belgium, Meditrade, Cophana) avec extraction OCR Claude Vision, matching catalogue MediKong, calcul d'économie signée et intelligence commerciale (alignement vendeurs + signaux gamme).

C'est un lot très volumineux (10 tables, 6 edge functions, ~10 écrans UI, crons, RLS). Je propose de le découper en **6 étapes** validées une par une pour éviter une PR monstre impossible à relire.

## Étape 1 — Migration DB complète

Une seule migration qui crée tout le schéma de la section 2 :

- `buyers` (si absente) + RLS
- `known_suppliers` + seed des 6 grossistes BE
- `wholesaler_profiles` + seed des 6 profils avec règles de remise
- `pharmacist_wholesaler_settings` + RLS
- `product_eligibility_categories` + seed des 9 codes
- `imported_invoices` + indexes + RLS
- `imported_invoice_lines` + indexes + RLS
- `seller_alignment_requests` + RLS
- `gamme_demand_signals`
- `admin_settings` + seed des 5 clés de config
- Bucket Storage `imported-invoices` (10 MB, MIME PDF/JPEG/PNG/HEIC/WEBP) + policies

Vérif `cloud_status` avant + linter après.

## Étape 2 — Secret Claude + Edge functions extraction

- Demander `ANTHROPIC_API_KEY` à l'utilisateur (Claude Sonnet 4.6 + Haiku pour classification)
- `invoice-upload` : hash SHA-256, dedup, création row `imported_invoices`, déclenche extraction async
- `invoice-extract` : Claude Vision Sonnet 4.6 → JSON header + lignes brutes, sauvegarde, MAJ statut

## Étape 3 — Edge function `invoice-match` + Brique D

- `invoice-match` : remise grossiste (cascade override → ocr_line → profile_default → category_grid), classification éligibilité (regex + Haiku), match CNK/EAN/fuzzy, calcul économie signée, statut MediKong
- `seller-alignment` : crée request si gap ≥ 3% et cooldown OK (30j), notifie vendeur
- `gamme-demand` : si marque déjà chez nous (≥3 vendeurs), target = net − 5%, notifie vendeurs de la marque
- `wholesaler-onboarding` : upsert `pharmacist_wholesaler_settings`

## Étape 4 — UI pharmacien

- Wizard `WholesalerOnboardingWizard` (modal full-screen 1er login, 3 étapes)
- Page `/compte/grossistes` (édition réglages)
- Page `/factures` (liste avec économie signée colorée)
- Page `/factures/:id` (aperçu + en-tête + lignes avec colonnes Remise/Prix net + rapport)
- Composants `InvoiceUploader` (drag-drop simple) et `LineMatchEditor`
- KPIs avec libellés corrects v2 ("2/4 éligibles — 1 hors scope (Rx)", pas "2/5")
- Tuile économie signée (rouge si négative)

## Étape 5 — UI vendeur

- `/espace-vendeur/demandes-alignement` : table + actions accept/decline
- `/espace-vendeur/demandes-gamme` : signaux de gamme

## Étape 6 — Crons + tests d'acceptation

- Crons pg_cron : `expire-alignment-requests` (hourly), `expire-gamme-demand-signals` (hourly)
- Vérifs manuelles sur un cas Phoenix (remise par défaut), Febelco (RFA), CERP (grille catégorie), ligne Rx exclue, ligne hors catalogue marque connue

## Notes techniques

- **Argent en centimes** : la spec utilise `numeric(10,4)` en euros pour cohérence avec les `imported_invoices` existantes ; on s'aligne sur la spec mais on flagge l'écart avec le standard projet (cents en integer). Si tu veux qu'on bascule en cents, dis-le avant l'Étape 1.
- **Réutilisation existant** : on vérifie si `buyers`, `product_eligibility_categories` ou des tables similaires existent déjà (`buyer_subscriptions`, `wholesalers`, etc.) avant d'écrire la migration, pour éviter conflits.
- **Anthropic vs Lovable AI** : la spec dit Claude Sonnet 4.6 + Haiku. Lovable AI Gateway propose Gemini/GPT-5 mais pas Claude. **Décision à confirmer** : on garde Claude (nouvelle clé API à fournir) ou on bascule sur `google/gemini-2.5-pro` (vision) + `gemini-2.5-flash-lite` (classif) qui sont équivalents et déjà payés via `LOVABLE_API_KEY` ?
- **Pickup ReStock** : on laisse en l'état (Étapes 1+2 terminées, Étape 3 acheteur en pause). Tu pourras y revenir après.

## Question bloquante avant de démarrer

1. **Provider IA** : Claude via clé Anthropic (fidèle au spec) ou Lovable AI Gateway (Gemini, déjà connecté, pas de clé à ajouter) ?
2. **Unités monétaires** : on respecte la spec (€ en `numeric(10,4)`) ou on bascule en cents integer comme le reste du projet ?
3. **Étape 1 maintenant** : je lance la migration DB complète dès que tu réponds aux 2 questions ci-dessus ?
