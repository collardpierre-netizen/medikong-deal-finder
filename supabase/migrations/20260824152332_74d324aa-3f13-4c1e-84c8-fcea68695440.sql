CREATE OR REPLACE FUNCTION public.admin_check_vendor_payout_coherence(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_result jsonb;
  v_vendors jsonb;
  v_global jsonb;
  v_total_ca numeric := 0;
  v_total_vat numeric := 0;
  v_total_com numeric := 0;
  v_total_net numeric := 0;
  v_mismatch_count int := 0;
  v_ok_count int := 0;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH lines AS (
    SELECT
      ol.vendor_id,
      COALESCE(ol.quantity, 0)::numeric AS qty,
      COALESCE(ol.unit_price_excl_vat, 0)::numeric AS pu_ht,
      COALESCE(ol.vat_rate, 0)::numeric AS vat_rate,
      ol.commission_rate,
      ol.commission_amount,
      ol.commission_basis,
      ol.cost_price AS unit_cost_excl_vat
    FROM public.order_lines ol
    WHERE ol.order_id = _order_id
      AND ol.vendor_id IS NOT NULL
  ),
  computed AS (
    SELECT
      vendor_id,
      ROUND(SUM(qty * pu_ht)::numeric, 2) AS ca_ht,
      ROUND(SUM(qty * pu_ht * (vat_rate/100.0))::numeric, 2) AS vat,
      ROUND(SUM(
        CASE
          -- commission_amount est un TOTAL de ligne (déjà calculé à la création)
          WHEN commission_amount IS NOT NULL AND commission_amount >= 0
            THEN commission_amount
          WHEN commission_rate IS NOT NULL AND commission_rate > 0 THEN
            CASE
              WHEN commission_basis = 'margin' AND unit_cost_excl_vat IS NOT NULL
                THEN GREATEST(qty * (pu_ht - unit_cost_excl_vat), 0) * commission_rate / 100.0
              ELSE qty * pu_ht * commission_rate / 100.0
            END
          ELSE 0
        END
      )::numeric, 2) AS commission,
      COUNT(*) AS line_count
    FROM lines
    GROUP BY vendor_id
  ),
  joined AS (
    SELECT
      c.vendor_id,
      v.company_name,
      v.name AS vendor_name,
      c.ca_ht,
      c.vat,
      c.commission,
      ROUND(c.ca_ht - c.commission, 2) AS net_ht,
      ROUND(c.ca_ht + c.vat, 2) AS ttc,
      c.line_count,
      so.id AS sub_order_id,
      so.subtotal_incl_vat AS sub_ttc,
      so.commission_amount_override AS sub_com,
      so.commission_rate_override AS sub_rate
    FROM computed c
    LEFT JOIN public.vendors v ON v.id = c.vendor_id
    LEFT JOIN public.sub_orders so ON so.order_id = _order_id AND so.vendor_id = c.vendor_id
  )
  SELECT
    jsonb_agg(jsonb_build_object(
      'vendor_id', vendor_id,
      'vendor_label', COALESCE(company_name, vendor_name, 'Fournisseur'),
      'line_count', line_count,
      'ca_ht', ca_ht,
      'vat', vat,
      'ttc', ttc,
      'commission', commission,
      'net_ht', net_ht,
      'sub_order_id', sub_order_id,
      'sub_ttc', sub_ttc,
      'sub_commission', sub_com,
      'sub_commission_rate', sub_rate,
      'delta_ttc', CASE WHEN sub_ttc IS NULL THEN NULL ELSE ROUND(ttc - sub_ttc, 2) END,
      'delta_commission', CASE WHEN sub_com IS NULL THEN NULL ELSE ROUND(commission - sub_com, 2) END,
      'status', CASE
        WHEN sub_order_id IS NULL THEN 'no_sub_order'
        WHEN ABS(COALESCE(ttc - sub_ttc, 0)) <= 0.01
         AND ABS(COALESCE(commission - sub_com, 0)) <= 0.01 THEN 'ok'
        ELSE 'mismatch'
      END
    ) ORDER BY company_name NULLS LAST),
    COALESCE(SUM(ca_ht), 0),
    COALESCE(SUM(vat), 0),
    COALESCE(SUM(commission), 0),
    COALESCE(SUM(ca_ht - commission), 0),
    COUNT(*) FILTER (WHERE sub_order_id IS NOT NULL AND (
      ABS(COALESCE(ttc - sub_ttc, 0)) > 0.01 OR ABS(COALESCE(commission - sub_com, 0)) > 0.01
    )),
    COUNT(*) FILTER (WHERE sub_order_id IS NOT NULL AND
      ABS(COALESCE(ttc - sub_ttc, 0)) <= 0.01 AND ABS(COALESCE(commission - sub_com, 0)) <= 0.01
    )
  INTO v_vendors, v_total_ca, v_total_vat, v_total_com, v_total_net, v_mismatch_count, v_ok_count
  FROM joined;

  v_global := jsonb_build_object(
    'order_id', _order_id,
    'vendor_count', COALESCE(jsonb_array_length(v_vendors), 0),
    'ok_count', v_ok_count,
    'mismatch_count', v_mismatch_count,
    'total_ca_ht', v_total_ca,
    'total_vat', v_total_vat,
    'total_ttc', ROUND(v_total_ca + v_total_vat, 2),
    'total_commission', v_total_com,
    'total_net_ht', v_total_net,
    'overall_status', CASE
      WHEN v_vendors IS NULL THEN 'empty'
      WHEN v_mismatch_count > 0 THEN 'mismatch'
      ELSE 'ok'
    END,
    'checked_at', now()
  );

  RETURN jsonb_build_object('global', v_global, 'vendors', COALESCE(v_vendors, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_check_vendor_payout_coherence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_check_vendor_payout_coherence(uuid) TO authenticated, service_role;