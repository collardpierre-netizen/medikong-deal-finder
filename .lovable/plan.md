## Contexte

Aujourd'hui le formatage monétaire est dispersé en 3 helpers (`src/lib/price-format.ts`, `src/lib/pricing.ts`, `src/lib/formatCount.ts`) **et** dupliqué en local dans ~30 fichiers via des `(cents/100).toLocaleString("fr-BE", { style: "currency", currency: "EUR" })`. Tout est figé sur `fr-BE` / `EUR`, donc un utilisateur en EN/NL/DE voit toujours `12,34 €` (virgule, espace insécable) au lieu d'un format adapté à sa locale.

Aucun hook ni contexte de devise/locale dynamique n'existe encore.

## Ambiguïtés à lever AVANT implémentation

Vu l'ampleur (~100 occurrences `fr-BE`, ~80 fichiers), et la règle « do EXACTLY what the prompt asks », j'ai besoin de tes décisions :

### 1. Source de la locale d'affichage
- **Option A** — `i18n.language` (fr / en / nl / de) → mapping `fr→fr-BE`, `en→en-GB`, `nl→nl-BE`, `de→de-DE`. Cohérent avec le switcher de langue déjà en place.
- **Option B** — Pays utilisateur (`useUserCountry` BE/FR/LU/NL) → `BE→fr-BE`, `FR→fr-FR`, `LU→fr-LU`, `NL→nl-NL`. Indépendant de la langue UI.
- **Option C** — Hybride : langue pour le format des nombres, pays pour la devise (utile si EUR un jour cohabite avec d'autres devises RFQ — la mémoire mentionne `rfqs.currency_code`).

### 2. Périmètre exact de « tous les composants »
- **Strict (recommandé)** : uniquement les helpers monétaires (`formatEur`, `formatPriceEur`, `formatAmount`, `formatPriceRaw`) + les ~30 montants inline `toLocaleString("fr-BE", { style: "currency"|undefined, ... })` qui formatent un montant en €.
- **Étendu** : inclure aussi les `toLocaleString("fr-BE")` sur quantités (`rfq.quantity.toLocaleString`, `brand.count.toLocaleString`) → ces nombres entiers bénéficient aussi d'une locale dynamique mais ce n'est pas du « monétaire ».
- **Hors scope quoi qu'il arrive** : les `toLocaleDateString("fr-BE")` / `toLocaleTimeString("fr-BE")` (~40 occurrences) — c'est du formatage de dates, pas de la monnaie. Tu as déjà des helpers `formatUpdatedAt` / `formatUpdatedAtFull` mémorisés pour les dates.

### 3. Contextes admin / vendeur
Certains écrans vendeur/admin (`VendorMarketIntel`, `AdminVendeurDetail`, `RestockAdminCampaigns`, `VendorDashboard`…) sont **toujours en FR** côté UI, indépendamment de la langue utilisateur acheteur. Faut-il :
- **A** — Forcer `fr-BE` sur ces écrans (laisser les `fr-BE` en dur dans `src/pages/admin/**` et `src/pages/vendor/**`) ?
- **B** — Passer ces écrans aussi sur le formatter dynamique (cohérent si l'admin/vendeur change de langue) ?

## Plan d'implémentation (sous réserve des réponses ci-dessus)

Hypothèse de travail si tu valides : **Option 1.A + 2.Strict + 3.B** (le plus simple et cohérent avec ton infra i18next existante).

### Étape 1 — Créer `src/lib/money-format.ts` + hook `useMoneyFormat`
- Fonction pure `formatMoney(amountEur, { locale, currency = "EUR", withSymbol = true, fractionDigits = 2 })`.
- Fonction pure `formatMoneyFromCents(cents, opts)` (raccourci ÷ 100).
- Fonction pure `formatDelta(deltaEur, opts)` qui ajoute un signe `+` / `−` explicite et préserve la couleur via classe (laissée au composant).
- Hook `useMoneyFormat()` retourne `{ formatMoney, formatMoneyFromCents, formatDelta, formatBasisLabel, locale, currency }` en lisant `i18n.language` via `useTranslation` (mapping interne).
- Conserve la signature et la sortie 1:1 quand `locale = fr-BE` pour ne pas casser les snapshots / styles existants.

### Étape 2 — Migrer les 3 helpers historiques
- `formatEur` / `formatAmount` (`price-format.ts`) → délèguent à `formatMoney` avec un fallback `fr-BE` (pour les contextes serveur / SSR / tests sans React).
- `formatPriceEur` / `formatPriceRaw` (`pricing.ts`) → idem, marqués `@deprecated, prefer useMoneyFormat()`.
- `formatBasisLabel` reste textuel mais bascule via t() si tu valides — sinon on le garde tel quel.

### Étape 3 — Migrer les composants prix / deltas / badges
Cibles confirmées (montants en €) :

```
src/pages/RfqCreditsPage.tsx                  (formatEur local)
src/pages/MesRfqPage.tsx                       (formatEur local + 1 quantity)
src/pages/PharmacieAbonnementPage.tsx         (Intl local)
src/pages/vendor/VendorDashboard.tsx           (eurFormatter local)
src/pages/vendor/VendorRfqInbox.tsx            (formatEur local + 2 quantity)
src/pages/restock/RestockAdminCampaigns.tsx    (toLocaleString FR-BE 2 décimales)
src/pages/admin/AdminVendorMarketIntelPage.tsx (Intl local)
src/pages/EconomiesPage.tsx                    (Intl local)
src/pages/InvestPage.tsx                       (5 lignes "€" inline)
src/pages/ConfirmationPage.tsx                 (montants si présents — à re-scanner)
+ tous les composants de Cards/Badges qui affichent un prix : `MarginBreakdownDetails`, `PvpEconomyBadge`, `PriceDeltaShowcase`, `SearchTrivagoCard`, `BuyerComparator`, `OfferSuggestedRetailPriceEditor`, `AdjustPriceModal`…
```

Pour chaque fichier : remplacer le formatter local par `const { formatMoneyFromCents } = useMoneyFormat()` (composants React) ou `formatMoney(eur, { locale })` (utilitaires non-React).

### Étape 4 — Garde-fou
- Ajout d'une règle `eslint-plugin-no-restricted-syntax` qui interdit `toLocaleString("fr-BE"` et `Intl.NumberFormat("fr-BE"` dans `src/**` (sauf le helper `money-format.ts` lui-même, et les utilitaires de date).
- Échec en CI si quelqu'un réintroduit un format monétaire en dur.

### Étape 5 — Vérifications
- Build TS (`bunx tsc --noEmit`).
- Test manuel rapide : changer la langue UI → vérifier qu'un prix sur `/catalogue`, `/produit/:slug`, `/panier`, `/vendor/dashboard` change de format (point décimal en EN/DE, virgule en FR/NL).
- Snapshot d'un prix en chaque locale fourni en réponse.

### Hors scope explicite (ne sera PAS modifié sans validation)
- Les ~40 `toLocaleDateString("fr-BE")` / `toLocaleTimeString("fr-BE")`.
- Le helper `formatCount.ts` (compteurs marketing — pas de monnaie).
- La logique TVA / pricing.ts `applyMargin` (pas de format).
- Les exports CSV (`AccountPage`, `MesRfqPage` ligne 431, `RfqCreditsPage`) qui utilisent `fr-BE` pour rester compatibles avec Excel FR — cas particulier à confirmer.

## Volume estimé
- 1 nouveau fichier (`money-format.ts` + hook).
- ~30-40 fichiers modifiés.
- 0 migration DB.

## Question(s) bloquantes

Réponds-moi sur **1.A/B/C, 2.Strict/Étendu, 3.A/B**, et confirme le hors-scope « dates et exports CSV ». Je lance ensuite la migration en un seul passage.
