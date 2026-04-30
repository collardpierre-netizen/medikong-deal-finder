---
name: RFQ Credit Ledger Admin Screen
description: Page admin /admin/rfq-ledger qui liste rfq_credit_ledger filtrable par buyer (recherche profile.full_name/company_name/email), plan (rfq_plans.id), kind (consume/grant_admin/purchase_pack/subscribe_plan/monthly_reset/refund/expire_plan) et plage de dates ; export CSV ; raccourci depuis /admin/rfq-credits
type: feature
---
Page `src/pages/admin/AdminRfqLedgerPage.tsx` route `/admin/rfq-ledger` :
- Filtres : recherche acheteur (résolution profiles → user_ids puis `.in`), plan, kind, période from/to, limite (50/100/250/500/1000)
- KPIs : nb lignes, consos, Σ quota attribué (>0), Σ crédits attribués (>0)
- Table : date, acheteur (nom + email), badge kind, deltas colorés (vert/rouge), plan, RFQ id court, raison
- Export CSV (BOM UTF-8) avec libellé plan résolu
- RLS : `rfq_ledger_admin_all` autorise déjà la lecture admin
- Raccourci bouton "Historique crédits →" depuis `/admin/rfq-credits`
