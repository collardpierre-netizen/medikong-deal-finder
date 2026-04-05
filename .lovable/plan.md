
# Plan : Déploiement i18n complet sur MediKong

## 1. Produits — Noms FR en base de données
- Ajouter colonnes `name_fr` et `description_fr` sur la table `products` (migration)
- Modifier les hooks (`useProducts`, `useCatalog`) pour retourner `name_fr` quand la langue = FR
- Mettre à jour les composants produit (`ProductCard`, `CatalogProductCard`, `SearchTrivagoCard`) pour afficher le nom traduit

## 2. Catégories — Utiliser `name_fr` partout
- La colonne `name_fr` existe déjà sur `categories`
- Modifier `CatalogSidebar`, `UniversePills`, `Breadcrumbs`, `CategoriesPage`, `CategoryPage` pour afficher `name_fr` quand langue = FR
- Modifier le menu de navigation et le footer

## 3. UI statique — Remplacer les textes en dur par `t()`
- Intégrer `useTranslation()` (i18next) dans les composants principaux :
  - `Navbar`, `Footer`, `SubNav`, `AnnouncementBar`, `TrustBar`
  - `CatalogToolbar`, `CatalogSidebar` (labels filtres)
  - `ProductPage` (onglets, boutons)
  - `CartDrawer`, `CheckoutPage`
  - `HomePage` (sections)
- Les clés existent déjà dans `fr.json` — il faut juste connecter les composants

## 4. Mécanisme de sélection de langue
- Le `LanguageSelector` existe déjà et utilise i18next
- S'assurer que le changement de langue propage bien à tous les composants (produits DB + UI statique)
- Stocker la préférence en localStorage

## Approche
- Modifier les hooks de données pour accepter un paramètre `lang` et retourner les champs traduits
- Créer un helper `getLocalizedName(item, lang)` réutilisable
- Travailler fichier par fichier, section par section
