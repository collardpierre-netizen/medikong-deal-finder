---
name: Home Showcase Analytics
description: Tracking impressions/clics/CTR de l'encart "Comparaison live" de la home (PriceDeltaShowcase) avec table dédiée et KPIs admin.
type: feature
---
- Table `home_showcase_events` (kind=impression|click, product_id, variant=ok|fallback|no_offers|single_offer|not_found, locale, country_code, session_id, delta_pct, offer_count). RLS: INSERT public (anon+authenticated), SELECT admin via `is_admin(auth.uid())`.
- Helper `src/lib/home-showcase-tracking.ts` : `trackShowcaseImpression` (dédoublonné par session via `sessionStorage` clé `mk:hs:imp:<productId>:<variant>`) + `trackShowcaseClick`. Push aussi dans `dataLayer` GTM (events `home_price_delta_impression` / `home_price_delta_click`). Insertion DB best-effort, ne bloque jamais l'UI.
- Câblé dans `PriceDeltaShowcase` : useEffect impression à l'apparition (variant calculée à partir de l'état du hook), onClick des liens "Voir la comparaison" / "Voir la fiche produit".
- RPC `admin_home_showcase_kpis(_days int)` SECURITY DEFINER (gardée par `is_admin`) → impressions/clics/CTR par produit×variant + last_seen, GRANT EXECUTE authenticated.
- UI admin `/admin/cms/home/comparaison` : section "Analytics" avec toggle 7/30/90j, 3 KPI cards (totaux), table par produit/variant.
