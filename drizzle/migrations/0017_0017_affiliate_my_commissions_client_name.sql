DROP FUNCTION IF EXISTS public.affiliate_my_commissions(uuid);

CREATE OR REPLACE FUNCTION public.affiliate_my_commissions(_affiliate_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, order_id uuid, order_number text, order_date timestamp with time zone, pseudo text, client_name text, order_total_ht_cents integer, commission_cents integer, margin_guard_hit boolean, status text, validate_after timestamp with time zone, calc_details jsonb, invoice_number text, adjustment_of_id uuid, cancelled_reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_aff uuid;
BEGIN
  v_aff := public.affiliate_target_id(_affiliate_id);
  RETURN QUERY
  SELECT c.id, c.order_id, o.order_number, o.created_at,
         'Client #' || upper(substr(md5(r.user_id::text || r.affiliate_id::text), 1, 4)),
         public._affiliate_client_display_name(r.user_id),
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