CREATE OR REPLACE FUNCTION public.admin_list_orders(_status text DEFAULT 'all'::text, _date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, _date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, _vendor_ids uuid[] DEFAULT NULL::uuid[], _search text DEFAULT NULL::text, _only_with_commission boolean DEFAULT false, _forecast_filter text DEFAULT 'all'::text, _hide_test boolean DEFAULT true, _hide_deleted boolean DEFAULT true, _limit integer DEFAULT 50, _offset integer DEFAULT 0, _buyer_type text DEFAULT 'all'::text, _payment_status text DEFAULT 'all'::text, _billing_status text DEFAULT 'all'::text, _sort_by text DEFAULT 'date'::text, _sort_dir text DEFAULT 'desc'::text, _billing_updated_from timestamp with time zone DEFAULT NULL::timestamp with time zone, _billing_updated_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _orig text; _new text; BEGIN
  SELECT pg_get_functiondef(oid) INTO _orig FROM pg_proc WHERE proname='admin_list_orders' AND pronamespace='public'::regnamespace LIMIT 1;
  -- placeholder: real replacement is below via separate statement
  RETURN NULL;
END $function$;