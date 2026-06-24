## Objectif

Permettre aux KPIs et graphiques (admin + vendeur + exports) d'agréger les commandes prévisionnelles **de façon persistante**, même si la commande est ensuite annulée, modifiée ou convertie en commande réelle.

## Modèle de données (1 migration)

Sur `public.orders` :
- `was_forecast boolean NOT NULL DEFAULT false` — flag immuable, vrai dès qu'une commande a été créée en prévisionnel (utilisé pour l'historique).
- `forecast_created_at timestamptz` — date d'origine prévisionnelle.
- `forecast_converted_at timestamptz` — date de conversion en réel (si applicable).
- `forecast_snapshot jsonb` — snapshot figé `{total_incl_vat, subtotal_excl_vat, vat_amount, customer_id, vendor_ids[], lines:[{product_id, qty, unit_price_incl_vat, vendor_id}], created_at}` pris à la création prévisionnelle ; ne bouge plus jamais, même si la commande est modifiée ou annulée.

Triggers / RPC :
- `BEFORE INSERT OR UPDATE` : si `is_forecast=true` et `was_forecast=false`, set `was_forecast=true` + `forecast_created_at=now()` + remplit `forecast_snapshot` (si null). Le flag `was_forecast` ne peut jamais redevenir false (garde-fou).
- Nouvelle RPC `admin_convert_forecast_to_real(_order_id uuid, _notes text)` (SECURITY DEFINER, admin only) :
  - exige `is_forecast=true`
  - set `is_forecast=false`, `forecast_converted_at=now()`, `status='confirmed'` (configurable plus tard), `admin_notes` annoté
  - audit_log
  - retourne la commande mise à jour
- `admin_create_manual_order` (existant) : déjà tient compte de `is_forecast` ; ajout : alimenter `forecast_snapshot` à la création via le trigger.

## Backend (vues + sécurité)

Vue helper `admin_orders_with_forecast_v` (security_invoker) projetant pour chaque commande :
- `effective_total_incl_vat` = `total_incl_vat` (réel) **ou** `forecast_snapshot.total_incl_vat` (si annulé/modifié alors qu'elle était prévisionnelle)
- `forecast_total_incl_vat` = montant pris dans le snapshot (toujours)
- `is_forecast`, `was_forecast`, `forecast_status` ('active' | 'converted' | 'cancelled')
- exposée à `authenticated`, RLS via `is_admin()`.

## Frontend

**1. Formulaire `/admin/commandes/nouvelle`** — déjà prêt (toggle existant). Aucun changement fonctionnel hormis aide texte qui précise que la prévisionnelle nourrit les graphiques.

**2. Fiche commande (`AdminCommandes` + drawer / page détail)**
- Badge "Prévisionnel" (déjà là), badge supplémentaire "Convertie le …" si `forecast_converted_at`.
- Bouton **"Convertir en commande réelle"** sur les commandes `is_forecast=true` → appelle `admin_convert_forecast_to_real`, refresh React Query.

**3. Dashboard admin global (`AdminDashboard` + `useDashboardStats`)**
- Ajout d'un toggle global `includeForecast` (state local de la page, propagé en props à `GmvEvolutionChart` et lu par les KPIs).
- KPIs GMV / Commandes : lisent `was_forecast OR is_forecast` pour la part prévisionnelle. Quand le toggle est OFF, on exclut comme aujourd'hui. Quand ON, on additionne sur `effective_total_incl_vat`.
- `GmvEvolutionChart` : 
  - ajout d'une **série « Prévisionnel »** distincte (`Line` violet `#7C3AED` pointillée) en plus de la GMV réelle.
  - se base sur `was_forecast` (donc inclus aussi les converties/annulées qui étaient prévisionnelles) et utilise `forecast_snapshot.total_incl_vat` pour la valeur figée.
  - le toggle « Inclure prévisionnel » contrôle uniquement l'ajout au total GMV cumulé et à la série principale, la série « Prévisionnel » reste visible en permanence.

**4. Dashboard vendeur (`VendorDashboard` + `useVendorDashboardKpis`)**
- Hook : requête additionnelle sur `orders` joinées à `order_lines` (filtre `vendor_id=current vendor`, `was_forecast=true OR is_forecast=true`) → calcule `forecastRevenueCents` & `forecastOrders` du mois en cours.
- UI : nouvelle `VStat` "CA prévisionnel" (icône `CalendarClock`, couleur `#7C3AED`) sub "ce mois + converti".

**5. Exports (`AdminCommandes` export XLSX + rapports financiers)**
- Ajout colonnes : `Prévisionnel?`, `Snapshot prévisionnel HT`, `Snapshot prévisionnel TTC`, `Converti le`, `Statut prévisionnel`.

## Périmètre hors scope

- Pas de touche au workflow de paiement, à la facturation, ni à l'envoi de notifications vendeur.
- Pas d'edition libre du flag is_forecast après création (seul le bouton "Convertir" sert).
- Conversion réelle → réelle ou rollback : non géré (one-way, comme demandé).

## Détails techniques

| Élément | Type | Détail |
|---|---|---|
| `orders.was_forecast` | colonne | bool, index partiel `WHERE was_forecast = true` |
| `orders.forecast_snapshot` | jsonb | rempli par trigger `BEFORE INSERT OR UPDATE` |
| `admin_convert_forecast_to_real` | RPC | SECURITY DEFINER, gated `is_admin()`, audit_log |
| `admin_orders_with_forecast_v` | view | security_invoker = true |
| `useOrders` | hook | `select` étendu pour ramener `was_forecast`, `forecast_snapshot`, `forecast_converted_at` |
| `GmvEvolutionChart` | component | nouvelle prop `data` agrège réel + snapshot, série Prévisionnel toujours visible |
| `useVendorDashboardKpis` | hook | requête supplémentaire `orders → order_lines.vendor_id` filtrée mois courant |
| Export XLSX | `AdminCommandes` | ajout colonnes prévisionnel |

## Validation

- `bunx tsgo --noEmit`
- Migration ; conversion via bouton + vérif que l'ordre apparait toujours dans le graphique « Prévisionnel » après conversion ou annulation manuelle.

## Fichiers touchés

- `supabase/migrations/<ts>_forecast_history.sql` (nouveau)
- `src/hooks/useAdminData.ts` (useOrders select + useDashboardStats)
- `src/hooks/useVendorDashboardKpis.ts`
- `src/components/admin/GmvEvolutionChart.tsx`
- `src/pages/admin/AdminDashboard.tsx` (toggle global)
- `src/pages/admin/AdminCommandes.tsx` (badge converti + bouton convertir + colonnes export)
- `src/pages/vendor/VendorDashboard.tsx` (VStat CA prévisionnel)
- `src/integrations/supabase/types.ts` (auto)
