-- LOT 0031 — Portail apporteur : parcours complet par client
-- Etend public.affiliate_my_client pour renvoyer, par commande attribuee :
--   devis -> bon de commande -> bon de livraison -> signature -> deblocage paiement
-- N'expose AUCUN cout vendeur, aucune commission MediKong, aucune marge,
-- aucune identite/coordonnee vendeur, et aucun montant de paiement fournisseur
-- (uniquement la decision de deblocage et sa date).
-- Aucune donnee modifiee : remplacement de fonction uniquement.

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
             -- Etape 1 : devis
             'quote', q.quote,
             -- Etapes 3/4/5 : bons de livraison, signature, deblocage paiement
             'delivery_notes', coalesce(dn.notes, '[]'::jsonb),
             'journey', jsonb_build_object(
               'has_quote', (q.quote is not null),
               'quote_accepted', (q.quote ->> 'accepted_at') is not null,
               'has_order', true,
               'delivery_notes_count', coalesce(dn.cnt, 0),
               'signed_count', coalesce(dn.signed_cnt, 0),
               'payment_released_count', coalesce(dn.released_cnt, 0)
             )
           ) order by ord.created_at desc) as orders
    from public.affiliate_commissions c
    join public.orders ord on ord.id = c.order_id
    left join lateral (
      select jsonb_build_object(
               'quote_id', qt.id,
               'quote_number', qt.quote_number,
               'status', qt.status,
               'created_at', qt.created_at,
               'sent_at', qt.sent_at,
               'viewed_at', qt.viewed_at,
               'accepted_at', qt.accepted_at,
               'declined_at', qt.declined_at,
               'converted_at', qt.converted_at,
               'total_ht_cents', qt.total_ht_cents,
               'total_ttc_cents', qt.total_ttc_cents
             ) as quote
      from public.quotes qt
      where qt.order_id = ord.id
      order by qt.created_at desc
      limit 1
    ) q on true
    left join lateral (
      select count(*)::int as cnt,
             count(*) filter (where d.confirmed_at is not null)::int as signed_cnt,
             count(*) filter (where rel.decision is not null)::int as released_cnt,
             jsonb_agg(jsonb_build_object(
               'delivery_note_id', d.id,
               'document_number', d.document_number,
               'status', d.status,
               'carrier', d.carrier,
               'tracking_number', d.tracking_number,
               'issued_at', d.issued_at,
               'cancelled_at', d.cancelled_at,
               'confirmation_sent_at', d.confirmation_sent_at,
               'confirmed_at', d.confirmed_at,
               'confirmed_by_name', d.confirmed_by_name,
               'client_remarks', d.client_remarks,
               'has_signature', (d.signature_storage_path is not null),
               'payment_release', case
                 when rel.decision is null then null
                 else jsonb_build_object('decision', rel.decision, 'decided_at', rel.decided_at)
               end
             ) order by d.created_at desc) as notes
      from public.delivery_notes d
      left join lateral (
        select r2.decision::text as decision, r2.decided_at
        from public.delivery_payment_releases r2
        where r2.delivery_note_id = d.id
        order by r2.decided_at desc nulls last, r2.created_at desc
        limit 1
      ) rel on true
      where d.order_id = ord.id
    ) dn on true
    where c.referral_id = v_ref.id
      and c.adjustment_of_id is null
      and c.status <> 'cancelled'
  ) o on true;

  return v_result;
end;
$function$;
