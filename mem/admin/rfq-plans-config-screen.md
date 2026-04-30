---
name: RFQ Plans Config Screen
description: Page admin /admin/rfq-plans pour CRUD des plans de monétisation RFQ (3 modes paywall/crédits/forfait)
type: feature
---

Écran admin `/admin/rfq-plans` (`AdminRfqPlansPage`) permet le CRUD complet sur la table `rfq_plans` (RLS `rfq_plans_admin_all`). Couvre les 3 modes du Monetization Engine :
- **Paywall** = `free_quota` (quota mensuel offert, bloque ensuite via trigger DB)
- **Crédits par demande** = `credit_pack` (pack à vie X crédits / Y €)
- **Forfait mensuel** = `monthly_plan` (quota mensuel) ou `unlimited_plan` (illimité)

Le formulaire ajuste dynamiquement les champs visibles selon `plan_type` et applique des coercitions métier (credits_included = 0 hors pack, monthly_quota = 0 hors quota/monthly, duration_days = null hors forfait, is_unlimited forcé à true pour `unlimited_plan`).

Raccourci "Configurer les plans →" depuis `/admin/rfq-credits` (haut droite). La sidebar admin n'expose pas encore ces pages — accès via URL directe.
