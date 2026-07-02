## Objectif

Remplacer le barème indicatif codé en dur du dashboard vendeur par de vrais paliers de commission négociée, pilotables depuis `/admin/commissions`, et afficher au vendeur sa progression GMV en valeur et % vers le prochain palier (avec conservation/perte du taux préférentiel).

## Modèle de données

Nouvelle table `margin_rule_tiers` (paliers optionnels attachés à une règle `margin_rules`) :

- `margin_rule_id` (FK)
- `min_gmv_cents` (bigint) — seuil GMV cumulé à atteindre
- `margin_percentage` (numeric) — taux appliqué au-delà du seuil
- `label` (text, optionnel — ex. "Palier négocié 1M€")
- `sort_order` (int)

Convention : la règle parente (`margin_rules.margin_percentage`) reste le taux "base" (palier 0). Les `margin_rule_tiers` définissent les paliers supérieurs.

Deux nouveaux champs sur `margin_rules` :
- `gmv_window` enum (`calendar_year` | `rolling_12m`) — défaut `calendar_year`
- `tiers_direction` enum (`decreasing` | `increasing`) — défaut `decreasing` (plus de GMV = taux plus bas)

RPC `get_vendor_gmv_progress(_vendor_id uuid)` :
retourne `{ current_gmv_cents, current_tier_percentage, next_tier_min_gmv_cents, next_tier_percentage, progress_pct, window_start, window_end }` en s'appuyant sur `order_lines` (mêmes filtres que le dashboard) et la règle vendeur active (fallback règle globale).

RLS : lecture par admin ou par le vendeur concerné (via `current_vendor_id()`).

## Admin `/admin/commissions`

Dans l'éditeur de règle (dialog) :
- Section "Paliers négociés" repliable (visible seulement quand une règle vendeur est éditée, ou activable via un toggle sur les templates globaux).
- Tableau éditable : GMV min (€) | Taux (%) | Label.
- Sélecteurs : fenêtre GMV (année civile / 12 mois glissants), direction (dégressif / progressif).
- Aperçu : "À partir de X € de GMV, taux Y %".

Sur la table des règles vendeurs : afficher une petite pastille "N paliers" quand `margin_rule_tiers` > 0.

## Dashboard vendeur (`MediKongCommissionCard`)

- Supprimer le barème local indicatif.
- Appeler le RPC `get_vendor_gmv_progress`.
- Afficher :
  - Taux actuel (badge) + libellé du palier.
  - GMV cumulé (€) sur la fenêtre.
  - Prochain palier : "Encore X € pour passer à Y %" (ou "Palier max atteint").
  - Barre de progression (% vers prochain palier).
  - Note conditionnelle si la règle est `decreasing` : "Sous ce seuil, le taux repasse à Z %".

Si le vendeur n'a aucun palier configuré : afficher juste le taux fixe actuel (aucune barre, aucun barème indicatif).

## Décisions par défaut appliquées

- **GMV = HTVA** (`line_total_excl_vat`) — cohérent avec la négociation commerciale. Bascule TTC possible plus tard si tu veux.
- **Fenêtre par défaut = année civile** (reset au 1er janvier), configurable par règle.
- **Commission** : le taux résolu s'applique aux **commandes suivantes** après franchissement du palier (pas de rétroactif). Le RPC calcule uniquement l'affichage ; l'application effective aux `order_lines.commission_amount` reste sur le trigger existant (à faire évoluer dans un second temps si tu valides ce comportement).

## Questions bloquantes avant migration

1. **Application au calcul réel des commissions** : je limite ce lot à **l'affichage dashboard + config admin** (le taux effectif dans `order_lines.commission_amount` continue d'utiliser `margin_rules.margin_percentage` "base"). OK ou tu veux aussi que le trigger de commission consulte les paliers dès maintenant ?
2. **HTVA confirmé** pour la GMV ?
3. **Fenêtre par défaut = année civile** OK ?
