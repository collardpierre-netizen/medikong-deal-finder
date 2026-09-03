CREATE OR REPLACE FUNCTION public.affiliate_admin_tracking_by_campaign(_affiliate_id uuid)
RETURNS TABLE(
  campaign_id uuid, slug text, name text, status text,
  visits bigint, scans bigint, unique_visitors bigint,
  signups_started bigint, signups_completed bigint, first_purchases bigint,
  last_event_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN QUERY
  SELECT tc.id, tc.slug, tc.name, tc.status,
         COUNT(*) FILTER (WHERE te.event_type = 'visit')::bigint,
         COUNT(*) FILTER (WHERE te.event_type = 'scan')::bigint,
         COUNT(DISTINCT te.visitor_id)::bigint,
         COUNT(*) FILTER (WHERE te.event_type = 'signup_started')::bigint,
         COUNT(DISTINCT te.user_id) FILTER (WHERE te.event_type = 'signup_completed')::bigint,
         COUNT(DISTINCT te.user_id) FILTER (WHERE te.event_type = 'first_purchase')::bigint,
         MAX(te.created_at)
  FROM public.tracking_campaigns tc
  LEFT JOIN public.tracking_events te
         ON te.campaign_id = tc.id AND COALESCE(te.ua_family,'') <> 'bot'
  WHERE tc.owner_type = 'affiliate' AND tc.owner_id = _affiliate_id
  GROUP BY tc.id, tc.slug, tc.name, tc.status
  ORDER BY MAX(te.created_at) DESC NULLS LAST;
END;
$function$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_tracking_events(_affiliate_id uuid, _limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid, created_at timestamptz, event_type text, campaign_slug text,
  code text, visitor_id text, user_id uuid, user_email text,
  ua_family text, referrer_host text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN QUERY
  SELECT te.id, te.created_at, te.event_type::text, tc.slug,
         ac.code::text, te.visitor_id::text, te.user_id, u.email::text,
         te.ua_family::text, te.referrer_host::text
  FROM public.tracking_events te
  JOIN public.tracking_campaigns tc ON tc.id = te.campaign_id
  LEFT JOIN public.activation_codes ac ON ac.id = te.code_id
  LEFT JOIN auth.users u ON u.id = te.user_id
  WHERE tc.owner_type = 'affiliate' AND tc.owner_id = _affiliate_id
  ORDER BY te.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 100), 500));
END;
$function$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_attached_orders(_affiliate_id uuid, _limit integer DEFAULT 200)
RETURNS TABLE(
  order_id uuid, order_number text, order_date timestamptz,
  customer_name text, order_total_ht_cents bigint,
  net_margin_cents bigint, commission_cents bigint,
  commission_status text, order_status text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  RETURN QUERY
  SELECT o.id, o.order_number::text, o.created_at,
         COALESCE(cu.company_name, cu.email)::text,
         c.order_total_ht_cents::bigint, c.net_margin_cents::bigint,
         c.commission_cents::bigint, c.status::text, o.status::text
  FROM public.affiliate_commissions c
  JOIN public.orders o ON o.id = c.order_id
  LEFT JOIN public.customers cu ON cu.id = o.customer_id
  WHERE c.affiliate_id = _affiliate_id
    AND c.adjustment_of_id IS NULL
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 200), 1000));
END;
$function$;

REVOKE ALL ON FUNCTION public.affiliate_admin_tracking_by_campaign(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.affiliate_admin_tracking_events(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.affiliate_admin_attached_orders(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_tracking_by_campaign(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_tracking_events(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_attached_orders(uuid, integer) TO authenticated;