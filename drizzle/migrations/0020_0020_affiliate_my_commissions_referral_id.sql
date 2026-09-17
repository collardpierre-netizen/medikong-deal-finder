-- Expose referral_id pour ouvrir la fiche client depuis l'écran commissions apporteur
drop function if exists public.affiliate_my_commissions(uuid);

create or replace function public.affiliate_my_commissions(_affiliate_id uuid default null::uuid)
returns table(id uuid, order_id uuid, order_number text, order_date timestamp with time zone, pseudo text, client_name text, referral_id uuid, order_total_ht_cents integer, commission_cents integer, margin_guard_hit boolean, status text, validate_after timestamp with time zone, calc_details jsonb, invoice_number text, adjustment_of_id uuid, cancelled_reason text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
DECLARE v_aff uuid;
BEGIN
  v_aff := public.affiliate_target_id(_affiliate_id);
  RETURN QUERY
  SELECT c.id, c.order_id, o.order_number, o.created_at,
         'Client #' || upper(substr(md5(r.user_id::text || r.affiliate_id::text), 1, 4)),
         public._affiliate_client_display_name(r.user_id),
         r.id,
         c.order_total_ht_cents, c.commission_cents, c.margin_guard_hit,
         c.status, c.validate_after, c.calc_details, pi.invoice_number,
         c.adjustment_of_id, c.cancelled_reason
  FROM public.affiliate_commissions c
  JOIN public.affiliate_referrals r ON r.id = c.referral_id
  LEFT JOIN public.orders o ON o.id = c.order_id
  LEFT JOIN public.affiliate_payout_invoices pi ON pi.id = c.payout_invoice_id
  WHERE c.affiliate_id = v_aff
  ORDER BY o.created_at DESC NULLS LAST;
END;
$function$;