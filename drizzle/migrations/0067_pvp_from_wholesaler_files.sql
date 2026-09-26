CREATE OR REPLACE FUNCTION public.resolve_product_pvp(_product_id uuid, _country_code text DEFAULT 'BE')
RETURNS TABLE(pvp_ttc_cents integer, source pvp_source_enum, source_label text, vendor_id uuid, vendor_name text, updated_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH official AS (
    SELECT p.pvp_ttc_cents AS c, p.pvp_source AS s,
      CASE p.pvp_source
        WHEN 'apb' THEN 'Prix public APB'
        WHEN 'pmr' THEN 'Prix public PMR'
        WHEN 'manufacturer' THEN 'Prix public fabricant'
        WHEN 'distributor' THEN 'Prix public distributeur'
        ELSE 'Prix public conseillé'
      END AS l,
      NULL::uuid AS vid, NULL::text AS vn, p.pvp_updated_at AS u, 1 AS prio
    FROM public.products p
    WHERE p.id = _product_id AND p.pvp_ttc_cents IS NOT NULL
      AND COALESCE(p.pvp_country_code, 'BE') = _country_code
  ),
  vendor AS (
    SELECT o.suggested_retail_price_cents, o.suggested_retail_price_source,
      CASE o.suggested_retail_price_source
        WHEN 'manufacturer' THEN 'PVP suggéré fabricant : ' || COALESCE(v.company_name, v.name, '—')
        WHEN 'distributor' THEN 'PVP suggéré distributeur : ' || COALESCE(v.company_name, v.name, '—')
        ELSE 'PVP suggéré : ' || COALESCE(v.company_name, v.name, '—')
      END,
      o.vendor_id, COALESCE(v.company_name, v.name, '—'), o.updated_at, 2
    FROM public.offers o JOIN public.vendors v ON v.id = o.vendor_id
    WHERE o.product_id = _product_id AND o.country_code = _country_code AND o.is_active = true
      AND o.suggested_retail_price_cents IS NOT NULL
      AND public.can_vendor_set_suggested_price(o.vendor_id, _product_id)
    ORDER BY o.suggested_retail_price_cents ASC LIMIT 1
  ),
  wholesaler_file AS (
    -- Prix public des fichiers grossistes Febelco / CERP : étape b (conseillé), jamais officiel.
    SELECT round(mp.prix_public * 100)::integer, 'distributor'::pvp_source_enum,
      'Prix public conseillé · grossiste · ' || to_char(mp.imported_at AT TIME ZONE 'Europe/Brussels', 'DD/MM'),
      NULL::uuid, NULL::text, mp.imported_at, 3
    FROM public.market_prices mp JOIN public.market_price_sources ms ON ms.id = mp.source_id
    WHERE mp.product_id = _product_id AND mp.prix_public > 0 AND COALESCE(ms.is_test, false) = false
      AND _country_code = 'BE'
      AND (ms.name ILIKE 'febelco%' OR ms.name ILIKE 'cerp%')
    ORDER BY mp.imported_at DESC, (ms.name ILIKE 'febelco%') DESC LIMIT 1
  )
  SELECT x.c, x.s, x.l, x.vid, x.vn, x.u FROM (
    SELECT * FROM official
    UNION ALL SELECT * FROM vendor
    UNION ALL SELECT * FROM wholesaler_file
  ) x ORDER BY x.prio LIMIT 1;
$$;