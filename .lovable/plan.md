# Option A — Catalogue privé vendeur→vendeur

Objectif : permettre à un vendeur de publier des offres avec prix HTVA confidentiels, visibles uniquement par les acheteurs portant le profil `revendeur_pro`, sans duplication d'offre.

## 1. Migration DB

**a) Nouveau profil acheteur**
- INSERT dans `buyer_profiles` : `id='revendeur_pro'`, `label='Revendeur professionnel'`, `display_order=5`, `description='Accès au catalogue B2B inter-vendeurs et aux prix revendeur'`.

**b) Rattacher un acheteur au profil**
- Ajouter colonne `customers.buyer_profile_id text NULL REFERENCES public.buyer_profiles(id)` + index.
- Le profil reste assignable uniquement par un admin (RLS existante sur `customers`).

**c) RPC `current_buyer_profile_id()`**
- SECURITY DEFINER, retourne `customers.buyer_profile_id` pour `auth.uid()`, NULL si absent. Utilisée par le front pour le gating `/pro` et par la résolution serveur des prix.

**d) RPC `list_reseller_offers(_country text, _limit int, _offset int)`**
- SECURITY DEFINER, gate strict : si `current_buyer_profile_id() <> 'revendeur_pro'` → renvoie zéro ligne.
- Sélectionne les offres ayant une `vendor_exclusivities` active `mode='hide'` + `'revendeur_pro' = ANY(buyer_profile_ids)`.
- Applique `resolve_offer_price_for_profile(offer_id, 'revendeur_pro')` pour le prix affiché + source.
- Retourne `offer_id, product_id, vendor_id, price_excl_vat, price_source, moq, mov_amount, stock_quantity, country_code`.

**e) Bonus serveur (cohérence)** : extension légère de la policy de lecture publique sur `offers` — si l'offre cible une exclusivité `mode='hide'` avec `buyer_profile_ids` non vide ET que `current_buyer_profile_id()` n'est pas dans cette liste → masquée du SELECT public. Évite que `useProducts` / `useSearchProducts` remontent l'offre côté grand public.

## 2. Front — page `/pro`

**a) Hook `useCurrentBuyerProfile()`**
- `src/hooks/useCurrentBuyerProfile.ts` — appelle la RPC, cache react-query 5 min.

**b) Page `/pro` (`src/pages/ProPage.tsx`)**
- Garde : si pas de session OU profil ≠ `revendeur_pro` → carte "Accès réservé aux revendeurs vérifiés" + CTA contact.
- Si OK : grille produits (réutilise `CatalogProductCard`) alimentée par `list_reseller_offers`, filtres pays/marque/recherche basique.
- Badge "Prix revendeur" sur les cards (composant `ResellerPriceBadge` minimal).

**c) Route** : ajout dans `src/App.tsx` (`<Route path="/pro" element={<ProPage />} />`, lazy import).

**d) Lien navigation** : entrée discrète "Espace revendeur" dans `Navbar` visible uniquement si `useCurrentBuyerProfile()` matche.

## 3. Côté vendeur (zéro changement UI cette itération)

L'UI vendeur existante (`vendor_exclusivities`, `offer_buyer_profile_prices`, `vendor_profile_defaults`) couvre déjà la saisie : le vendeur crée une exclusivité `hide` ciblant `revendeur_pro` + un prix par profil sur ses offres concernées. Aucun nouveau formulaire ce coup-ci — ce sera un Lot 2 si tu veux une expérience guidée.

## 4. Hors scope (à valider séparément)
- UI d'assignation `revendeur_pro` côté admin (peut se faire ensuite ; pour l'instant assignation SQL/admin manuelle).
- Onboarding dédié revendeur.
- Notifications "nouvelle offre revendeur" pour les comptes pro.

## Détails techniques

Tables touchées (création/altération) : `buyer_profiles` (INSERT), `customers` (ADD COLUMN). Tables lues : `vendor_exclusivities`, `offer_buyer_profile_prices`, `vendor_profile_defaults`, `offers`, `products`.

Fichiers front créés : `src/hooks/useCurrentBuyerProfile.ts`, `src/pages/ProPage.tsx`, `src/components/pro/ResellerPriceBadge.tsx`.
Fichiers front modifiés : `src/App.tsx` (route), `src/components/layout/Navbar.tsx` (entrée conditionnelle).

Sécurité : toute la résolution prix/visibilité passe par RPC SECURITY DEFINER + policy RLS sur `offers` ; aucun prix revendeur ne fuite côté client si le profil n'est pas accordé.
