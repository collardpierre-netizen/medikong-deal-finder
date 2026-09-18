-- LOT 0029 — Suivi des livraisons dans le portail apporteur
-- Ajoute, pour chaque commande d'un client attribué, la liste de ses bons de livraison :
-- statut, transporteur, n° de suivi, date d'expédition et date de réception signée.
-- Aucune donnée fournisseur (identité vendeur, coût, commission, marge) n'est exposée.

CREATE OR REPLACE FUNCTION public.affiliate_my_client(_referral_id uuid, _affiliate_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_aff uuid;
  v_ref record;
  v_result jsonb;
begin
  v_aff := public.affiliate_target_id(_affiliate_id);

  select r.* into v_ref
  from public.affiliate_referrals r
  where r.id = _referral_id and r.affiliate_id = v_aff;

  if v_ref.id is null then
    raise exception 'Acces refuse';
  end if;

  select jsonb_build_object(
    'referral_id', v_ref.id,
    'pseudo', 'Client #' || upper(substr(md5(v_ref.user_id::text || v_ref.affiliate_id::text), 1, 4)),
    'status', v_ref.status,
    'attributed_at', v_ref.attributed_at,
    'first_order_at', v_ref.first_order_at,
    'window_expires_at', v_ref.window_expires_at,
    'client_name', coalesce(public._affiliate_client_display_name(v_ref.user_id), cu.company_name),
    'contact_name', p.full_name,
    'email', coalesce(cu.email, au.email),
    'phone', coalesce(cu.phone, p.phone),
    'customer_type', cu.customer_type::text,
    'vat_number', coalesce(cu.vat_number, p.vat_number),
    'address_line1', cu.address_line1,
    'address_line2', cu.address_line2,
    'postal_code', cu.postal_code,
    'city', cu.city,
    'country', coalesce(cu.country_code, p.country),
    'preferred_language', p.preferred_language,
    'is_verified', cu.is_verified,
    'orders', coalesce(o.orders, '[]'::jsonb),
    'stats', jsonb_build_object(
      'orders_count', coalesce(o.n, 0),
      'revenue_ht_cents', coalesce(o.ht, 0),
      'last_order_at', o.last_order_at
    )
  )
  into v_result
  from (select 1) dummy
  left join public.customers cu on cu.auth_user_id = v_ref.user_id
  left join public.profiles p on p.user_id = v_ref.user_id
  left join auth.users au on au.id = v_ref.user_id
  left join lateral (
    select count(*)::int as n,
           coalesce(sum(c.order_total_ht_cents), 0)::bigint as ht,
           max(ord.created_at) as last_order_at,
           jsonb_agg(jsonb_build_object(
             'order_id', ord.id,
             'order_number', ord.order_number,
             'created_at', ord.created_at,
             'status', ord.status,
             'payment_status', ord.payment_status,
             'total_ht_cents', c.order_total_ht_cents,
             'deliveries', coalesce(d.deliveries, '[]'::jsonb),
             'delivery_summary', jsonb_build_object(
               'notes_count', coalesce(d.notes_count, 0),
               'received_count', coalesce(d.received_count, 0),
               'last_received_at', d.last_received_at,
               'last_shipped_at', d.last_shipped_at
             )
           ) order by ord.created_at desc) as orders
    from public.affiliate_commissions c
    join public.orders ord on ord.id = c.order_id
    left join lateral (
      select count(*)::int as notes_count,
             count(*) filter (where dn.confirmed_at is not null)::int as received_count,
             max(dn.confirmed_at) as last_received_at,
             max(dn.issued_at) as last_shipped_at,
             jsonb_agg(jsonb_build_object(
               'delivery_note_id', dn.id,
               'document_number', dn.document_number,
               'status', dn.status,
               'carrier', dn.carrier,
               'tracking_number', dn.tracking_number,
               'shipped_at', dn.issued_at,
               'received_at', dn.confirmed_at,
               'received_by', dn.confirmed_by_name,
               'client_remarks', dn.client_remarks,
               'units', (
                 select coalesce(sum(dnl.quantity), 0)::int
                 from public.delivery_note_lines dnl
                 where dnl.delivery_note_id = dn.id
               )
             ) order by dn.issued_at desc) as deliveries
      from public.delivery_notes dn
      where dn.order_id = ord.id
    ) d on true
    where c.referral_id = v_ref.id
      and c.adjustment_of_id is null
      and c.status <> 'cancelled'
  ) o on true;

  return v_result;
end;
$function$;

REVOKE ALL ON FUNCTION public.affiliate_my_client(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_my_client(uuid, uuid) TO authenticated, service_role;