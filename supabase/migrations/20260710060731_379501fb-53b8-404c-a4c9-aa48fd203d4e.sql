
-- Admin shortcut RPCs to create commission overrides directly (auto-approved).

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
    status, approved_by, approved_at
  )
  VALUES (
    _vendor_id, _product_id, _commission_model,
    _commission_rate, _margin_split_pct, _fixed_commission_amount,
    _valid_from, _valid_until, _note,
    'approved'::commission_override_status, auth.uid(), now()
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
        updated_at               = now()
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_product_commission(uuid, uuid, text, numeric, numeric, numeric, timestamptz, timestamptz, text) TO authenticated;

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
         commission_override_updated_at = now()
   WHERE id = _offer_id
   RETURNING * INTO row_out;

  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found'; END IF;
  RETURN row_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_offer_commission(uuid, text, numeric, numeric, numeric, timestamptz, timestamptz, text) TO authenticated;
