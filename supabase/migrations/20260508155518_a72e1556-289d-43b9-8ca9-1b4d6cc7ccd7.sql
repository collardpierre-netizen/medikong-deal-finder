-- 1. Purge le panier de seed
delete from cart_items where customer_id = '9d916bbb-d199-489f-9221-3142caf8b889';

-- 2. Recréer la vue matérialisée avec colonnes additionnelles
drop materialized view if exists public.public_marketplace_metrics cascade;

create materialized view public.public_marketplace_metrics as
select 1 as singleton,
  ( select count(distinct v.id)
      from vendors v join offers o on o.vendor_id = v.id
     where v.is_verified = true
       and v.validation_status = any (array['accepted'::vendor_validation_status,'approved'::vendor_validation_status])
       and o.is_active = true ) as suppliers_count,
  ( select count(distinct b.id)
      from brands b join products p on p.brand_id = b.id join offers o on o.product_id = p.id
     where b.is_active = true and p.is_active = true and o.is_active = true ) as brands_count,
  ( select count(distinct p.id)
      from products p join offers o on o.product_id = p.id
     where p.is_active = true and o.is_active = true ) as products_count,
  ( select count(*) from offers where is_active = true ) as offers_count,
  ( select count(distinct fd.product_id)
      from flash_deals fd
     where fd.is_active = true and fd.starts_at <= now() and fd.ends_at >= now() ) as products_on_promo,
  ( select round(avg(sub.offer_count), 1)
      from ( select product_id, count(*) as offer_count
               from offers where is_active = true group by product_id ) sub ) as avg_offers_per_product,
  ( select coalesce(max(sub.offer_count), 0)
      from ( select product_id, count(*) as offer_count
               from offers where is_active = true group by product_id ) sub ) as max_offers_per_product,
  ( select count(*)
      from ( select product_id from offers where is_active = true
              group by product_id having count(*) >= 2 ) sub ) as multi_vendor_products_count,
  ( select coalesce(round(avg(sub.offer_count), 1), 0)
      from ( select product_id, count(*) as offer_count
               from offers where is_active = true group by product_id having count(*) >= 2 ) sub ) as avg_offers_per_multi_product,
  ( select coalesce(round((percentile_cont(0.5) within group (order by sub.offer_count))::numeric, 0), 0)
      from ( select product_id, count(*) as offer_count
               from offers where is_active = true group by product_id having count(*) >= 2 ) sub ) as median_offers_per_multi_product,
  now() as refreshed_at;

create unique index on public.public_marketplace_metrics (singleton);

-- Lecture publique (matview = pas de RLS, on grant)
grant select on public.public_marketplace_metrics to anon, authenticated;

-- Refresh immédiat
refresh materialized view public.public_marketplace_metrics;