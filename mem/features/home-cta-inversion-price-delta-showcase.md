---
name: Home CTA inversion + Price Delta Showcase
description: Hero & final CTA inversés (primaire = "Voir un exemple de comparaison" → /produit/<slug>, secondaire = créer compte) + composant PriceDeltaShowcase alimenté par la vue publique public_top_price_deltas
type: feature
---
- Vue DB `public_top_price_deltas` (security_invoker=true, GRANT anon+authenticated) : agrège offers actives non-admin_hidden, ≥3 vendeurs, écart 15-80%, top 30 par delta_pct desc.
- Hook `useTopPriceDeltas(limit)` (src/hooks/useTopPriceDeltas.ts) — staleTime 30 min.
- Composant `<PriceDeltaShowcase />` (src/components/home/PriceDeltaShowcase.tsx) inséré dans le hero juste avant les stats. Lien vers `/produit/<slug>` (singulier — la route plurielle n'existe pas, c'est un bug pré-existant côté curated products).
- HomePage : 2 CTAs côte-à-côte (sm:flex-row) en hero ET dans le bloc final ; primaire bleu plein si demoSlug, sinon fallback navy plein. Tracking GTM `home_cta_clicked` (type=see_demo|create_account, location=hero|final_cta) + `home_price_delta_viewed`.
- i18n : clés `hero.ctaSeeDemo` / `hero.ctaCreateAccount` dans fr/nl/en/de.
- Hors scope : pas touché à ProductPage ni au gating verified buyer (prix HTVA déjà publics côté offers RLS).
