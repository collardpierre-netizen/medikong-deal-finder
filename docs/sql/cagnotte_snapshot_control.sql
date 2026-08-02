-- Requête de contrôle — cohérence des snapshots cagnotte sur order_items
--
-- Règle de vérité (Sprint 1.5) : une ligne est éligible cagnotte si et seulement si
-- l'offre portait applied_margin_percentage >= 14 (soit 12% de marge) au moment
-- de la commande. Les colonnes de snapshot sur order_items doivent donc respecter :
--   cagnotte_eligible_snapshot = (applied_margin_pct_snapshot >= 14)
--
-- À exécuter après tout backfill de order_items (offer_id + snapshots).
-- Lecture seule : aucune écriture, aucun effet de bord.

-- 1) Résumé agrégé (90 derniers jours)
with items as (
  select
    oi.id                             as order_item_id,
    oi.order_id,
    o.order_number,
    o.created_at,
    oi.offer_id,
    oi.applied_margin_pct_snapshot    as pct,
    oi.cagnotte_eligible_snapshot     as elig,
    off.applied_margin_percentage     as live_pct,
    off.cagnotte_eligible             as live_elig
  from order_items oi
  join orders o        on o.id = oi.order_id
  left join offers off on off.id = oi.offer_id
  where o.created_at > now() - interval '90 days'
)
select
  count(*)                                                                              as lignes_controlees,
  -- BLOQUANT : le snapshot se contredit lui-même (élig ≠ pct >= 14)
  count(*) filter (where pct is not null and elig is distinct from (pct >= 14))          as incoherence_snapshot_interne,
  -- BLOQUANT : ligne rattachée à une offre mais snapshot non backfillé
  count(*) filter (where offer_id is not null and pct is null)                           as snapshot_pct_manquant,
  count(*) filter (where offer_id is not null and elig is null)                          as snapshot_elig_manquant,
  -- INFORMATIF : l'offre a changé de marge depuis la commande (normal, le snapshot gèle l'état)
  count(*) filter (where live_pct is not null and pct is not null
                   and round(pct, 2) <> round(live_pct, 2))                              as pct_derive_vs_offre,
  count(*) filter (where live_elig is not null and elig is distinct from live_elig)       as elig_derive_vs_offre
from items;

-- 2) Détail des lignes en anomalie bloquante (à corriger)
with items as (
  select
    oi.id                          as order_item_id,
    o.order_number,
    o.created_at,
    oi.offer_id,
    oi.applied_margin_pct_snapshot as pct,
    oi.cagnotte_eligible_snapshot  as elig
  from order_items oi
  join orders o on o.id = oi.order_id
  where o.created_at > now() - interval '90 days'
)
select
  order_item_id,
  order_number,
  created_at,
  offer_id,
  pct,
  elig,
  case
    when pct is not null and elig is distinct from (pct >= 14) then 'incoherence_snapshot_interne'
    when offer_id is not null and pct is null                  then 'snapshot_pct_manquant'
    when offer_id is not null and elig is null                 then 'snapshot_elig_manquant'
  end as anomalie
from items
where (pct is not null and elig is distinct from (pct >= 14))
   or (offer_id is not null and pct is null)
   or (offer_id is not null and elig is null)
order by created_at desc
limit 200;
