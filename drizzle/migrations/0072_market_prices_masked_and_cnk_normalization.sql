-- 1) Normalisation CNK : « .0 »/« ,0 » retiré d'abord, puis non-chiffres, puis zéros de tête. Aucune valeur stockée n'est réécrite.
CREATE OR REPLACE FUNCTION public.normalize_cnk(_v text)
 RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO 'public'
AS $function$
  SELECT NULLIF(ltrim(regexp_replace(regexp_replace(coalesce(_v, ''), '[.,]0$', ''), '\D', '', 'g'), '0'), '')
$function$;
REINDEX INDEX public.products_cnk_normalized_expr_idx;
REINDEX INDEX public.product_market_codes_code_normalized_expr_idx;
CREATE INDEX IF NOT EXISTS market_prices_cnk_normalized_expr_idx ON public.market_prices (public.normalize_cnk(cnk));

-- 2) Prix public grossiste : aussi par CNK nettoyé si la ligne n'est pas reliée à la fiche.
CREATE OR REPLACE FUNCTION public.resolve_product_pvp(_product_id uuid, _country_code text DEFAULT 'BE'::text)
 RETURNS TABLE(pvp_ttc_cents integer, source pvp_source_enum, source_label text, vendor_id uuid, vendor_name text, updated_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH prod AS (
    SELECT p.pvp_ttc_cents AS c, p.pvp_source AS s,
      CASE p.pvp_source
        WHEN 'apb' THEN 'Prix public APB'
        WHEN 'pmr' THEN 'Prix public PMR'
        WHEN 'manufacturer' THEN 'Prix public fabricant'
        WHEN 'distributor' THEN 'Prix public distributeur'
        ELSE 'Prix public conseillé'
      END AS l,
      NULL::uuid AS vid, NULL::text AS vn, p.pvp_updated_at AS u,
      CASE WHEN p.pvp_source IN ('apb','pmr') THEN 1 ELSE 3 END AS prio
    FROM public.products p
    WHERE p.id = _product_id AND p.pvp_ttc_cents IS NOT NULL
      AND COALESCE(p.pvp_country_code, 'BE') = _country_code
  ),
  pcnk AS (SELECT public.normalize_cnk(cnk_code) AS n FROM public.products WHERE id = _product_id),
  wholesaler_file AS (
    SELECT round(mp.prix_public * 100)::integer, 'distributor'::pvp_source_enum,
      'Prix public · grossiste · ' || to_char(mp.imported_at AT TIME ZONE 'Europe/Brussels', 'DD/MM'),
      NULL::uuid, NULL::text, mp.imported_at, 2
    FROM public.market_prices mp JOIN public.market_price_sources ms ON ms.id = mp.source_id
    WHERE (mp.product_id = _product_id
           OR public.normalize_cnk(mp.cnk) = (SELECT n FROM pcnk WHERE n IS NOT NULL))
      AND mp.prix_public > 0 AND COALESCE(ms.is_test, false) = false
      AND _country_code = 'BE'
      AND (ms.name ILIKE 'febelco%' OR ms.name ILIKE 'cerp%')
    ORDER BY mp.imported_at DESC, (ms.name ILIKE 'febelco%') DESC LIMIT 1
  ),
  vendor AS (
    SELECT o.suggested_retail_price_cents, o.suggested_retail_price_source,
      CASE o.suggested_retail_price_source
        WHEN 'manufacturer' THEN 'PVP suggéré fabricant : ' || COALESCE(v.company_name, v.name, '—')
        WHEN 'distributor' THEN 'PVP suggéré distributeur : ' || COALESCE(v.company_name, v.name, '—')
        ELSE 'PVP suggéré : ' || COALESCE(v.company_name, v.name, '—')
      END,
      o.vendor_id, COALESCE(v.company_name, v.name, '—'), o.updated_at, 4
    FROM public.offers o JOIN public.vendors v ON v.id = o.vendor_id
    WHERE o.product_id = _product_id AND o.country_code = _country_code AND o.is_active = true
      AND o.suggested_retail_price_cents IS NOT NULL
      AND public.can_vendor_set_suggested_price(o.vendor_id, _product_id)
    ORDER BY o.suggested_retail_price_cents ASC LIMIT 1
  )
  SELECT x.c, x.s, x.l, x.vid, x.vn, x.u FROM (
    SELECT * FROM prod
    UNION ALL SELECT * FROM wholesaler_file
    UNION ALL SELECT * FROM vendor
  ) x ORDER BY x.prio LIMIT 1;
$function$;

-- 3) Lignes grossistes d'une fiche (par rattachement OU CNK nettoyé) — service de scan uniquement.
CREATE OR REPLACE FUNCTION public.scan_market_prices_for_product(_product_id uuid, _source_ids uuid[])
 RETURNS TABLE(source_id uuid, prix_grossiste numeric, prix_pharmacien numeric, period text, imported_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH pc AS (SELECT public.normalize_cnk(cnk_code) n FROM public.products WHERE id = _product_id)
  SELECT mp.source_id, mp.prix_grossiste, mp.prix_pharmacien, mp.period::text, mp.imported_at
  FROM public.market_prices mp
  WHERE mp.source_id = ANY(_source_ids)
    AND (mp.product_id = _product_id OR public.normalize_cnk(mp.cnk) = (SELECT n FROM pc WHERE n IS NOT NULL))
  ORDER BY mp.period DESC NULLS LAST, mp.imported_at DESC
$function$;
REVOKE ALL ON FUNCTION public.scan_market_prices_for_product(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_market_prices_for_product(uuid, uuid[]) TO service_role;

-- 4) Prix marché masqués : seul l'admin voit les vrais noms ; les vendeurs abonnés voient « Grossiste A / B ».
CREATE OR REPLACE FUNCTION public.get_market_prices_for_products(_product_ids uuid[])
 RETURNS TABLE(id uuid, product_id uuid, source_id uuid, source_name text, source_type text,
   prix_grossiste numeric, prix_pharmacien numeric, prix_public numeric, tva_rate numeric,
   product_name_source text, product_url text, imported_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _admin boolean := public.is_admin(auth.uid());
BEGIN
  IF NOT _admin AND NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.auth_user_id = auth.uid() AND v.is_active = true AND public.vendor_market_intel_access(v.id)
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH rows AS (
    SELECT mp.*, ms.name AS sname, ms.source_type::text AS stype
    FROM public.market_prices mp JOIN public.market_price_sources ms ON ms.id = mp.source_id
    WHERE mp.product_id = ANY(_product_ids) AND COALESCE(ms.is_test, false) = false
  ), letters AS (
    SELECT s.source_id, dense_rank() OVER (ORDER BY s.source_id) AS rk FROM (SELECT DISTINCT r.source_id FROM rows r) s
  )
  SELECT r.id, r.product_id, r.source_id,
    CASE WHEN _admin THEN r.sname ELSE 'Grossiste ' || chr(64 + least(l.rk, 26)::int) END,
    r.stype, r.prix_grossiste, r.prix_pharmacien, r.prix_public, r.tva_rate,
    CASE WHEN _admin THEN r.product_name_source ELSE NULL END,
    CASE WHEN _admin THEN r.product_url ELSE NULL END,
    r.imported_at
  FROM rows r JOIN letters l ON l.source_id = r.source_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_market_prices_for_products(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_market_prices_for_products(uuid[]) TO authenticated, service_role;

-- Les vendeurs ne lisent plus la table directement (admin uniquement).
DROP POLICY IF EXISTS vendors_with_intel_and_admins_read_market_prices ON public.market_prices;