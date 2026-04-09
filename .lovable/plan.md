
# MediKong — Plan de développement

## ✅ Fonctionnalités livrées

### Marketplace B2B
- Catalogue produits avec filtres, recherche, pagination
- Fiches produit avec offres multi-vendeurs, prix par paliers, MOV
- Panier multi-vendeurs, checkout Stripe Connect (split payments)
- Commandes, factures, bons de livraison
- Authentification acheteur/vendeur/admin avec RLS
- Système de favoris et listes

### Portail Vendeur
- Dashboard KYC + stepper de validation
- Gestion offres (CRUD, import/export XLSX avec prix d'achat + marge)
- Paramètres entreprise (profil, logo, site web, contact)
- Paramètres commerciaux (pays cibles, MOV, politique retours)
- Commission configurable (%, partage marge 50/50, fixe)
- Profil public /vendeur/:slug avec barre MOV sticky
- Santé du compte + niveaux (Bronze → Platinum)

### Administration
- Dashboard super-admin avec KPI
- Gestion vendeurs (CRUD, validation lifecycle, shadow mode/impersonation)
- Onglets par vendeur : résumé, validation, visibilité, offres & marges, portefeuille, produits, délégués, activité
- Gestion produits, catégories, marques, fabricants
- Délégués commerciaux/techniques (assignables à vendeur/marque/fabricant)
- Commandes, litiges, finances, commissions
- Import/export, sync Qogita, CMS hero images
- Alertes prix (admin + vendeur)
- Veille prix marché, vendeurs externes (comparateur Trivago-style)
- Codes marché par pays, gestion pays
- Audit log, API keys, traductions

### ReStock (marketplace déstockage)
- Landing page, listing opportunités
- Flux vendeur (création offre, contre-offres, ventes)
- Flux acheteur (dashboard, checkout, swipe mobile)
- Admin (offres, acheteurs, campagnes, FAQ, règles, prix de référence, payouts)

### Pages institutionnelles
- Entreprise (about, équipe, how it works, why MediKong)
- Trust (devenir vendeur, aide, témoignages, logistique, qualité)
- Pages légales (CGV, mentions, cookies, confidentialité)
- Pages segment (pharmacies, EHPAD, hôpitaux, etc.)
- Invest page

### Technique
- i18n FR/NL/DE, auto-traduction produits via IA
- Auth email templates personnalisées (Resend)
- Edge functions : Stripe, Sendcloud, Qogita sync, image proxy, sitemap dynamique
- Impersonation cross-tab via localStorage (corrigé + URL fallback)

---

## 🔧 Chantiers restants

### Priorité haute
1. **Sendcloud intégration** — En attente des clés API. L'edge function est prête, les webhooks aussi. À activer dès réception des secrets.
2. **Escrow auto-release** — Cron/scheduled function pour libérer automatiquement les paiements vendeur après X jours si pas de litige. La logique Stripe Connect est en place.
3. **Tests E2E ReStock** — Valider le flux complet acheteur→vendeur→livraison/enlèvement. Les pages existent, la logique de révélation d'adresse post-paiement est à vérifier.

### Priorité moyenne
4. **Notifications temps réel** — Realtime Supabase pour alertes prix, commandes, messages. Les tables existent, le canal à brancher.
5. **Analytics vendeur** — Dashboard vendeur avec vrais KPI (CA, commandes, taux buy box) basés sur les données réelles.
6. **Emails transactionnels** — Templates prêtes (confirmation commande, vendeur approuvé/refusé, inscription acheteur). Process-email-queue edge function déployée.

### Priorité basse
7. **Pages admin manquantes** — Certaines pages admin sont des stubs (AdminSync, AdminSchemasPIM). À étoffer selon besoin.
8. **Stripe Connect onboarding vendeur** — Flow complet (redirect → success → refresh). Edge functions prêtes, UI existante.
9. **Meilisearch** — Client configuré, sync edge function prête. À activer avec instance Meilisearch.

---

## Architecture clé

| Couche | Stack |
|--------|-------|
| Frontend | React 18 + Vite 5 + Tailwind + shadcn/ui |
| State | TanStack Query + React Context |
| Auth | Supabase Auth + RLS |
| DB | PostgreSQL (Supabase) |
| Payments | Stripe Connect (split) |
| Shipping | Sendcloud (prêt, en attente) |
| Search | Meilisearch (prêt, en attente) |
| Emails | Resend via edge functions |
| i18n | i18next (FR/NL/DE) |
| Impersonation | localStorage + URL param fallback |
