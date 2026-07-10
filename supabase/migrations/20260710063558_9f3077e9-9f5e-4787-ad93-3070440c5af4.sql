ALTER TABLE public.vendor_product_commissions
  ADD COLUMN IF NOT EXISTS created_via_admin_shortcut boolean NOT NULL DEFAULT false;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS commission_override_created_via_admin_shortcut boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.admin_upsert_product_commission(
  _vendor_id uuid,
  _product_id uuid,
  _commission_model text,
  _commission_rate numeric DEFAULT NULL,
  _margin_split_pct numeric DEFAULT NULL,
  _fixed_commission_amount numeric DEFAULT NULL,
  _valid_from timestamptz DEFAULT NULL,
  _valid_until timestamptz DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS public.vendor_product_commissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_out public.vendor_product_commissions;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _commission_model NOT IN ('flat_percentage','margin_split','fixed_amount') THEN
    RAISE EXCEPTION 'invalid commission_model';
  END IF;

  INSERT INTO public.vendor_product_commissions AS vpc (
    vendor_id, product_id, commission_model,
    commission_rate, margin_split_pct, fixed_commission_amount,
    valid_from, valid_until, note,
    status, approved_by, approved_at,
    created_via_admin_shortcut
  )
  VALUES (
    _vendor_id, _product_id, _commission_model,
    _commission_rate, _margin_split_pct, _fixed_commission_amount,
    _valid_from, _valid_until, _note,
    'approved'::commission_override_status, auth.uid(), now(),
    true
  )
  ON CONFLICT (vendor_id, product_id) DO UPDATE
    SET commission_model         = EXCLUDED.commission_model,
        commission_rate          = EXCLUDED.commission_rate,
        margin_split_pct         = EXCLUDED.margin_split_pct,
        fixed_commission_amount  = EXCLUDED.fixed_commission_amount,
        valid_from               = EXCLUDED.valid_from,
        valid_until              = EXCLUDED.valid_until,
        note                     = EXCLUDED.note,
        status                   = 'approved'::commission_override_status,
        approved_by              = auth.uid(),
        approved_at              = now(),
        rejected_reason          = NULL,
        updated_at               = now(),
        created_via_admin_shortcut = true
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_offer_commission(
  _offer_id uuid,
  _commission_model text,
  _commission_rate numeric DEFAULT NULL,
  _margin_split_pct numeric DEFAULT NULL,
  _fixed_commission_amount numeric DEFAULT NULL,
  _commission_valid_from timestamptz DEFAULT NULL,
  _commission_valid_until timestamptz DEFAULT NULL,
  _commission_override_reason text DEFAULT NULL
)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_out public.offers;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _commission_model NOT IN ('flat_percentage','margin_split','fixed_amount') THEN
    RAISE EXCEPTION 'invalid commission_model';
  END IF;

  UPDATE public.offers
     SET commission_model             = _commission_model,
         commission_rate              = _commission_rate,
         margin_split_pct             = _margin_split_pct,
         fixed_commission_amount      = _fixed_commission_amount,
         commission_valid_from        = _commission_valid_from,
         commission_valid_until       = _commission_valid_until,
         commission_override_reason   = _commission_override_reason,
         commission_override_status   = 'approved'::commission_override_status,
         commission_override_updated_by = auth.uid(),
         commission_override_updated_at = now(),
         commission_override_created_via_admin_shortcut = true
   WHERE id = _offer_id
   RETURNING * INTO row_out;

  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found'; END IF;
  RETURN row_out;
END;
$$;

DROP FUNCTION IF EXISTS public.resolve_effective_commission(uuid);

CREATE OR REPLACE FUNCTION public.resolve_effective_commission(_offer_id uuid)
RETURNS TABLE(
  source text,
  commission_model text,
  commission_rate numeric,
  margin_split_pct numeric,
  fixed_commission_amount numeric,
  valid_from timestamptz,
  valid_until timestamptz,
  via_admin_shortcut boolean
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  o record;
  vpc record;
  v record;
  now_ts timestamptz := now();
BEGIN
  SELECT
    offers.id                          AS o_id,
    offers.vendor_id                   AS o_vendor_id,
    offers.product_id                  AS o_product_id,
    offers.commission_model            AS o_model,
    offers.commission_rate             AS o_rate,
    offers.margin_split_pct            AS o_split,
    offers.fixed_commission_amount     AS o_fixed,
    offers.commission_override_status  AS o_status,
    offers.commission_valid_from       AS o_valid_from,
    offers.commission_valid_until      AS o_valid_until,
    offers.commission_override_created_via_admin_shortcut AS o_admin_shortcut
  INTO o
  FROM public.offers WHERE offers.id = _offer_id;

  IF NOT FOUND THEN RETURN; END IF;

  IF o.o_model IS NOT NULL
     AND o.o_status = 'approved'
     AND (o.o_valid_from IS NULL OR o.o_valid_from <= now_ts)
     AND (o.o_valid_until IS NULL OR o.o_valid_until > now_ts)
  THEN
    RETURN QUERY SELECT
      'offer'::text,
      o.o_model, o.o_rate, o.o_split, o.o_fixed,
      o.o_valid_from, o.o_valid_until,
      COALESCE(o.o_admin_shortcut, false);
    RETURN;
  END IF;

  SELECT
    vpc0.commission_model         AS p_model,
    vpc0.commission_rate          AS p_rate,
    vpc0.margin_split_pct         AS p_split,
    vpc0.fixed_commission_amount  AS p_fixed,
    vpc0.valid_from               AS p_valid_from,
    vpc0.valid_until              AS p_valid_until,
    vpc0.created_via_admin_shortcut AS p_admin_shortcut
  INTO vpc
  FROM public.vendor_product_commissions vpc0
  WHERE vpc0.vendor_id  = o.o_vendor_id
    AND vpc0.product_id = o.o_product_id
    AND vpc0.status = 'approved'
    AND (vpc0.valid_from  IS NULL OR vpc0.valid_from  <= now_ts)
    AND (vpc0.valid_until IS NULL OR vpc0.valid_until >  now_ts)
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      'product'::text,
      vpc.p_model, vpc.p_rate, vpc.p_split, vpc.p_fixed,
      vpc.p_valid_from, vpc.p_valid_until,
      COALESCE(vpc.p_admin_shortcut, false);
    RETURN;
  END IF;

  SELECT
    vendors.commission_model::text     AS v_model,
    vendors.commission_rate            AS v_rate,
    vendors.margin_split_pct           AS v_split,
    vendors.fixed_commission_amount    AS v_fixed
  INTO v
  FROM public.vendors WHERE vendors.id = o.o_vendor_id;

  RETURN QUERY SELECT
    'vendor'::text,
    COALESCE(v.v_model, 'flat_percentage'),
    v.v_rate, v.v_split, v.v_fixed,
    NULL::timestamptz, NULL::timestamptz,
    false;
END;
$function$;