## Périmètre exact (option C+2)

Tout `/vendor/*` + `src/components/vendor/**` + emails vendeur (`vendor-*.tsx`). FR câblé via `t(...)`, NL/DE/EN générés automatiquement par `translate-and-cache`.

- **35 pages** sous `src/pages/vendor/`
- **~35 composants top-level** sous `src/components/vendor/` + sous-dossiers `catalog/`, `contract/`, `dashboard/`, `ui/`
- **12 templates email** `vendor-*.tsx` (FR par défaut, fallback FR si recipient inconnu)

## Méthode (2) : FR câblé + traduction auto

Pour chaque fichier :
1. Repérer toutes les chaînes FR hardcodées (texte JSX, `placeholder`, `aria-label`, `title`, `toast.success/error`, `confirm`, libellés `<Button>`).
2. Remplacer par `t('vendor.<page>.<key>')` (namespace stable par fichier).
3. Ajouter les clés à `src/i18n/locales/fr.json` sous `vendor.*`.
4. **Pas** de pluralisation complexe ni d'ICU : on garde `{{var}}` simple (interpolation i18next native).

Pour les emails : ajouter une prop `locale` (fallback `'fr'`) + table `COPY[locale]` comme le template `vendor-account-created` créé hier. Le `locale` se déduit de `vendors.preferred_language` côté trigger (best-effort, fallback `fr`).

## Lots indépendants (chaque lot est mergeable et testable seul)

### Lot 0 — Infrastructure (1 PR)
- Ajouter le namespace `vendor` dans `src/i18n/index.ts` si pas déjà présent.
- Créer le script `scripts/translate-vendor-i18n.ts` qui :
  - Lit `src/i18n/locales/fr.json` → branche `vendor.*`
  - Pour chaque langue cible (nl, de, en) : compare avec le JSON existant, n'envoie à `translate-and-cache` que les clés manquantes ou modifiées (hash sha256 par valeur stocké à part dans `scripts/.i18n-vendor-hashes.json`).
  - Écrit le résultat dans `src/i18n/locales/{nl,de,en}.json` sous `vendor.*`.
  - Idempotent + relançable.

### Lot 1 — Layout & navigation vendeur (forte visibilité, peu de strings)
`VendorLayout.tsx`, `VendorSidebar.tsx`, `VendorTopBar.tsx`, `VendorAdminStatusBadge.tsx`, `ContractSignatureBanner.tsx`, `NotificationsBell.tsx`, `VendorMarketIntelGate.tsx`.

### Lot 2 — Pages "core opérationnelles"
`VendorDashboard.tsx`, `VendorOffers.tsx` (+ `EditOfferPopup.tsx`, `AdjustPriceModal.tsx`, `ProfilePricesEditor.tsx`, `ResolvedProfilePricesPreview.tsx`, `OfferSuggestedRetailPriceEditor.tsx`, `OfferCommissionOverrideDialog.tsx`, `VendorCommissionOverrideDialog.tsx`, `MarginBreakdownDetails.tsx`, `MarginInsightCard.tsx`), `VendorOrders.tsx` (+ `OrderDetailPopup.tsx`), `VendorCatalog.tsx` (+ sous-dossier `catalog/`), `VendorNotifications.tsx`.

### Lot 3 — RFQ & opportunités vendeur
`VendorRfqInbox.tsx`, `VendorTenders.tsx`, `VendorOpportunities.tsx`, `VendorRfqResponseForm.tsx`, `VendorProductSubmissionPage.tsx`.

### Lot 4 — Veille marché & alertes
`VendorMarketIntel.tsx`, `VendorMarketIntelHub.tsx`, `VendorPositioning.tsx`, `VendorAlerts.tsx`, `VendorCompetitorAlerts.tsx`, `VendorPriceAlerts.tsx`, `VendorPriceAlertRulesPage.tsx`, `AlertHistoryChart.tsx`, `VendorTopBrands.tsx`.

### Lot 5 — Réglages & onboarding vendeur
`VendorSettings.tsx`, `VendorOnboardingWizard.tsx`, `VendorCommercialSettings.tsx`, `VendorCommissionTab.tsx`, `VendorBrandingTab.tsx`, `VendorShippingSettings.tsx`, `VendorProfileDefaults.tsx`, `VendorTeamTab.tsx`, `VendorDelegateCompact.tsx`, `VendorDelegateDetailDialog.tsx`, `VendorDelegatesPublic.tsx`, `VendorKycStepper.tsx`.

### Lot 6 — Logistique, finance, contrats, divers
`VendorLogistics.tsx`, `VendorShipments.tsx`, `VendorShipmentDetail.tsx`, `VendorNewShipment.tsx`, `VendorBilling.tsx`, `VendorFinance.tsx`, `VendorInvoices`-related (`InvoicePreview.tsx`), `VendorContractPage.tsx`, `VendorContractChangelogPage.tsx` (+ sous-dossier `contract/`, `ContractHistoryTable.tsx`), `VendorDocuments.tsx`, `VendorAcademy.tsx`, `VendorMessages.tsx`, `VendorHealth.tsx`, `VendorAnalytics.tsx`, `VendorLoginPage.tsx`, `VendorStripeOnboardingPage.tsx`, `VendorStripeRefreshPage.tsx`, `VendorStripeSuccessPage.tsx`, `VendorProductQuickView.tsx`, `PrixRefDetailPopup.tsx`, `CategoryTreeSelector.tsx`, sous-dossier `dashboard/`, sous-dossier `ui/`.

### Lot 7 — Emails vendeur (12 templates)
Convertir `vendor-application`, `vendor-approved`, `vendor-rejected`, `vendor-contract-*` (4), `vendor-new-order`, `vendor-invoices`, `vendor-price-challenge`, `rfq-vendor-invitation`, `admin-vendor-market-intel-notification` au pattern `COPY[locale]` (fr/nl/de/en) avec prop `locale`. Côté trigger : lire `vendors.preferred_language` quand connu, fallback `'fr'`. Sujet → fonction `(data) => COPY[locale].subject`.

### Lot 8 — Run final du script de traduction
Une fois TOUS les lots 1-7 mergés et `fr.json` complet, lancer `bun run scripts/translate-vendor-i18n.ts` qui remplit `nl.json`, `de.json`, `en.json`.

## Garde-fous

- Chaque lot livré seul ne casse rien : si `t('vendor.x.y')` n'existe pas encore en NL, i18next renvoie la valeur FR par défaut (fallback déjà configuré).
- Aucun changement de logique métier, aucun changement de schéma DB, aucune migration.
- Pas de touche aux pages acheteur, admin, restock, légales, marketing — strictement vendeur + emails vendeur.

## Question avant de démarrer

Vu le volume (~92 fichiers), je propose de **livrer lot par lot** dans des messages séparés et que tu valides "OK lot suivant" entre chaque, pour éviter qu'un seul mega-changeset soit ingérable à relire.

Dis-moi :
- **(a)** OK, fais-le lot par lot avec validation entre chaque (recommandé), OU
- **(b)** Enchaîne tout en autonomie, je relirai à la fin, OU
- **(c)** Réduis le périmètre (ex : juste lots 1+2+5+7, le reste plus tard).
