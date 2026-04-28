# Sprint 1 — Fondations i18n anglaises

Objectif : faire de l'anglais une **langue de 1ère classe** dans toute l'infrastructure (DB, helpers, contextes, sélecteur), sans encore traduire le contenu UI ni le catalogue. À la fin du sprint, basculer en EN affichera l'UI core en anglais et le catalogue en fallback (anglais d'origine Qogita ou FR si pas de traduction).

## Périmètre IN
1. **Base de données** : ajouter colonnes `_en` partout où existent déjà `_fr/_nl/_de`, étendre l'auto-translate.
2. **Code i18n** : unifier sur `i18next`, supprimer le legacy `I18nContext`, ajouter `en` partout.
3. **Sélecteur de langue** : exposer EN dans le `LanguageSelector`.
4. **SEO de base** : ajouter `hreflang="en"` dans la home et les pages catalogue (sitemap multilingue minimal).
5. **Compléter `en.json`** des chaînes UI core (navigation, boutons, formulaires) — pas les pages contenu.

## Périmètre OUT (Sprints 2 & 3)
- Traduction des pages contenu (legal, trust, segment, entreprise, ReStock landing)
- Templates emails React-Email en EN
- Batch d'auto-traduction de tout le catalogue
- Revue juridique CGV/mentions EN
- Traduction des FAQ ReStock & articles d'aide

---

## Détail technique

### 1. Migration DB
Ajouter colonnes (toutes nullable, pas de défaut) :
- `products` : `name_en`, `description_en`, `short_description_en`
- `categories` : `name_en`, `description_en`
- `brands` : `description_en` (le `name` reste neutre)
- `manufacturers` : `description_en`
- `cms_hero_banners` : `title_en`, `subtitle_en`, `cta_label_en`
- `cms_sections` : `title_en`, `body_en`
- `restock_faq_items` : `question_en`, `answer_en`

Snapshot `*_backup_20260428_en` des 3 plus grosses tables (products, categories, brands) **avant** l'`ALTER TABLE`, conformément à notre process de backup ciblé.

### 2. Edge function `auto-translate-catalog`
- Étendre l'array de langues cibles : `['fr','nl','de']` → `['fr','nl','de','en']`
- Source = `name` (anglais d'origine Qogita) → si `lang === 'en'` et `name_en` vide, copie directe `name_en = name` (pas d'appel AI nécessaire pour Qogita)
- Pour les produits non-Qogita, appel `google/gemini-2.5-flash-lite` via Lovable AI Gateway

### 3. Helpers de localisation
**`src/lib/localization.ts`** :
```ts
if (currentLang === "en" && item.name_en) return item.name_en;
// fallback existant inchangé
```
Idem `getLocalizedDescription`.

### 4. Contexte i18n unifié
- **Supprimer** `src/contexts/I18nContext.tsx` (legacy, ne supporte que fr/nl/de) → faire grep des usages, remplacer par `useTranslation()` de `react-i18next`
- Migrer le dictionnaire interne du legacy vers `src/i18n/locales/{fr,nl,de,en}.json` (clés admin sidebar/topbar principalement)
- `LANGUAGE_CONFIG` : `en` est déjà déclaré, vérifier le rendu du flag/label

### 5. Sélecteur de langue
`src/components/LanguageSelector.tsx` : confirmer que les 4 langues sont listées (déjà OK selon `SUPPORTED_LANGUAGES`).

### 6. `translation-mappings.ts`
Ajouter `EN_TO_EN` (identité, ou mieux : court-circuit dans `autoTranslate` si `locale === 'en'`).

### 7. Compléter `src/i18n/locales/en.json`
Couvrir uniquement les **clés UI core** déjà présentes en FR :
- Navigation principale + sidebars (admin, vendeur, ReStock)
- Boutons globaux (save/cancel/delete/etc.)
- Labels formulaires onboarding
- Messages toast système
Pas les pages contenu (legal, trust, etc. → Sprint 2).

### 8. SEO minimal
- Ajouter balises `<link rel="alternate" hreflang="en" href="..."/>` sur `HomePage`, `CataloguePage`, `BrandDetailPage`
- Étendre l'edge function sitemap pour inclure `<xhtml:link rel="alternate" hreflang="en" .../>` par URL

---

## Livrables
- 1 migration DB (colonnes `_en` + snapshot backup)
- 1 edge function modifiée (`auto-translate-catalog`)
- ~5-8 fichiers code édités (helpers, contextes, sélecteur, sitemap)
- `en.json` complété sur ~150-200 clés UI core
- Note mémoire `mem://tech/i18n-catalog-schema` mise à jour pour ajouter EN

## Tests / QA
- Bascule manuelle FR→EN→NL→DE dans le sélecteur sans crash
- Vérification visuelle : header, sidebar admin, sidebar vendeur, footer en EN
- Vérification fallback : un produit sans `name_en` affiche bien `name` (anglais Qogita) ou `name_fr`
- Test `audit_backup_tables_rls()` après création du snapshot pour confirmer RLS OK

## Coûts (ordre de grandeur)
- **Crédits Lovable** : sprint **moyen** (1 migration, 1 edge function, ~10 fichiers code, dictionnaire à compléter). Pas de génération de contenu en masse.
- **Lovable AI Gateway** : ~0 (la traduction du catalogue est repoussée au Sprint 3).

## Hors-périmètre confirmé pour ce sprint
Pas de Sprint 2 (contenu) ni Sprint 3 (catalogue + SEO complet) — on valide d'abord les fondations en production avant d'engager le reste.