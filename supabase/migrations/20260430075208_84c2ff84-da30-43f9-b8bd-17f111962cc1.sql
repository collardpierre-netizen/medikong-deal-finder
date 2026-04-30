-- Table de référence pays limitrophes pour le routage RFQ
CREATE TABLE IF NOT EXISTS public.country_neighbors (
  country_code text NOT NULL,
  neighbor_code text NOT NULL,
  PRIMARY KEY (country_code, neighbor_code)
);

ALTER TABLE public.country_neighbors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "country_neighbors readable by all" ON public.country_neighbors;
CREATE POLICY "country_neighbors readable by all"
  ON public.country_neighbors FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "country_neighbors admin manage" ON public.country_neighbors;
CREATE POLICY "country_neighbors admin manage"
  ON public.country_neighbors FOR ALL
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

INSERT INTO public.country_neighbors (country_code, neighbor_code) VALUES
  ('BE','FR'),('BE','LU'),('BE','NL'),('BE','DE'),
  ('FR','BE'),('FR','LU'),('FR','DE'),('FR','IT'),('FR','ES'),('FR','CH'),
  ('LU','BE'),('LU','FR'),('LU','DE'),
  ('NL','BE'),('NL','DE'),
  ('DE','BE'),('DE','LU'),('DE','NL'),('DE','FR'),('DE','AT'),('DE','CH')
ON CONFLICT DO NOTHING;

-- Helper : pays éligibles pour un pays acheteur (pays + limitrophes)
CREATE OR REPLACE FUNCTION public.rfq_eligible_vendor_countries(_buyer_country text)
RETURNS TABLE(country_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _buyer_country
  UNION
  SELECT cn.neighbor_code FROM public.country_neighbors cn WHERE cn.country_code = _buyer_country
$$;

-- Mise à jour du moteur de routage : ajout filtre pays + catégorie produit
CREATE OR REPLACE FUNCTION public.rfq_resolve_target_vendors(_rfq_id uuid)
RETURNS TABLE(vendor_id uuid, reason rfq_target_reason)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rfq record;
  _category_id uuid;
BEGIN
  SELECT id, product_id, brand_id, destination_country_code
  INTO _rfq
  FROM public.rfqs
  WHERE id = _rfq_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Catégorie du produit (utilisée pour ciblage par intérêt catégorie si dispo)
  SELECT p.category_id INTO _category_id
  FROM public.products p
  WHERE p.id = _rfq.product_id;

  RETURN QUERY
  WITH eligible_countries AS (
    SELECT country_code FROM public.rfq_eligible_vendor_countries(COALESCE(_rfq.destination_country_code, 'BE'))
  ),
  brand_id_resolved AS (
    SELECT COALESCE(_rfq.brand_id, p.brand_id) AS brand_id, p.manufacturer_id
    FROM public.products p WHERE p.id = _rfq.product_id
    UNION ALL
    SELECT _rfq.brand_id, NULL::uuid
    WHERE _rfq.product_id IS NULL AND _rfq.brand_id IS NOT NULL
  ),
  product_vendors AS (
    SELECT DISTINCT o.vendor_id, 'product_offer'::public.rfq_target_reason AS reason
    FROM public.offers o
    WHERE _rfq.product_id IS NOT NULL AND o.product_id = _rfq.product_id AND o.is_active = true
  ),
  brand_interests AS (
    SELECT DISTINCT vci.vendor_id, 'brand_interest'::public.rfq_target_reason AS reason
    FROM public.vendor_catalog_interests vci
    JOIN brand_id_resolved b ON b.brand_id IS NOT NULL AND vci.brand_id = b.brand_id
    WHERE vci.brand_id IS NOT NULL
  ),
  manufacturer_interests AS (
    SELECT DISTINCT vci.vendor_id, 'manufacturer_interest'::public.rfq_target_reason AS reason
    FROM public.vendor_catalog_interests vci
    JOIN brand_id_resolved b ON b.manufacturer_id IS NOT NULL AND vci.manufacturer_id = b.manufacturer_id
    WHERE vci.manufacturer_id IS NOT NULL
  ),
  product_interests AS (
    SELECT DISTINCT vci.vendor_id, 'product_interest'::public.rfq_target_reason AS reason
    FROM public.vendor_catalog_interests vci
    WHERE _rfq.product_id IS NOT NULL AND vci.product_id = _rfq.product_id
  ),
  category_interests AS (
    SELECT DISTINCT vci.vendor_id, 'category_interest'::public.rfq_target_reason AS reason
    FROM public.vendor_catalog_interests vci
    WHERE _category_id IS NOT NULL AND vci.category_id = _category_id
  ),
  unioned AS (
    SELECT * FROM product_vendors
    UNION ALL SELECT * FROM brand_interests
    UNION ALL SELECT * FROM manufacturer_interests
    UNION ALL SELECT * FROM product_interests
    UNION ALL SELECT * FROM category_interests
  ),
  ranked AS (
    SELECT u.vendor_id, u.reason,
      ROW_NUMBER() OVER (
        PARTITION BY u.vendor_id
        ORDER BY CASE u.reason
          WHEN 'product_offer' THEN 1
          WHEN 'product_interest' THEN 2
          WHEN 'brand_interest' THEN 3
          WHEN 'manufacturer_interest' THEN 4
          WHEN 'category_interest' THEN 5
          ELSE 6 END
      ) AS rn
    FROM unioned u
    JOIN public.vendors v ON v.id = u.vendor_id
    WHERE COALESCE(v.is_active, true) = true
      -- Filtre pays : vendeur dans pays acheteur ou pays limitrophe (si country_code défini)
      AND (
        v.country_code IS NULL
        OR v.country_code IN (SELECT country_code FROM eligible_countries)
      )
  )
  SELECT r.vendor_id, r.reason FROM ranked r WHERE r.rn = 1;
END;
$$;

-- Vérifier que l'enum a bien 'category_interest'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.rfq_target_reason'::regtype AND enumlabel = 'category_interest') THEN
    ALTER TYPE public.rfq_target_reason ADD VALUE IF NOT EXISTS 'category_interest';
  END IF;
END $$;

-- ============================================================
-- FONCTION DE TEST DB : valide le routage RFQ sur des scénarios
-- ============================================================
CREATE OR REPLACE FUNCTION public.rfq_routing_self_test()
RETURNS TABLE(scenario text, expected int, actual int, ok boolean, details text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _buyer uuid := gen_random_uuid();
  _brand uuid;
  _mfr uuid;
  _cat uuid;
  _product uuid;
  _v_be_offer uuid;
  _v_fr_brand uuid;
  _v_lu_cat uuid;
  _v_es_brand uuid;        -- pays NON limitrophe BE → exclu
  _v_de_inactive uuid;     -- inactif → exclu
  _v_null_country uuid;    -- country NULL → toujours éligible
  _rfq_be uuid;
  _rfq_fr uuid;
  _rfq_no_country uuid;
  _count int;
  _list text;
BEGIN
  -- === Setup données de test (préfixe RFQTEST_ pour cleanup) ===
  INSERT INTO public.brands (id, name, slug, is_active)
    VALUES (gen_random_uuid(), 'RFQTEST_Brand', 'rfqtest-brand-' || _buyer::text, true)
    RETURNING id INTO _brand;

  INSERT INTO public.manufacturers (id, name, slug)
    VALUES (gen_random_uuid(), 'RFQTEST_Mfr', 'rfqtest-mfr-' || _buyer::text)
    RETURNING id INTO _mfr;

  INSERT INTO public.categories (id, name, slug, level)
    VALUES (gen_random_uuid(), 'RFQTEST_Cat', 'rfqtest-cat-' || _buyer::text, 1)
    RETURNING id INTO _cat;

  INSERT INTO public.products (id, name, slug, brand_id, manufacturer_id, category_id, is_active, source)
    VALUES (gen_random_uuid(), 'RFQTEST_Product', 'rfqtest-prod-' || _buyer::text, _brand, _mfr, _cat, true, 'medikong')
    RETURNING id INTO _product;

  -- Vendeurs : BE (offre directe), FR (intérêt marque), LU (intérêt catégorie),
  --            ES (intérêt marque, NON limitrophe BE), DE (intérêt marque, INACTIF), NULL country
  INSERT INTO public.vendors (id, name, slug, is_active, country_code, auth_user_id)
    VALUES (gen_random_uuid(), 'RFQTEST_V_BE', 'rfqtest-v-be-' || _buyer::text, true, 'BE', gen_random_uuid())
    RETURNING id INTO _v_be_offer;
  INSERT INTO public.vendors (id, name, slug, is_active, country_code, auth_user_id)
    VALUES (gen_random_uuid(), 'RFQTEST_V_FR', 'rfqtest-v-fr-' || _buyer::text, true, 'FR', gen_random_uuid())
    RETURNING id INTO _v_fr_brand;
  INSERT INTO public.vendors (id, name, slug, is_active, country_code, auth_user_id)
    VALUES (gen_random_uuid(), 'RFQTEST_V_LU', 'rfqtest-v-lu-' || _buyer::text, true, 'LU', gen_random_uuid())
    RETURNING id INTO _v_lu_cat;
  INSERT INTO public.vendors (id, name, slug, is_active, country_code, auth_user_id)
    VALUES (gen_random_uuid(), 'RFQTEST_V_ES', 'rfqtest-v-es-' || _buyer::text, true, 'ES', gen_random_uuid())
    RETURNING id INTO _v_es_brand;
  INSERT INTO public.vendors (id, name, slug, is_active, country_code, auth_user_id)
    VALUES (gen_random_uuid(), 'RFQTEST_V_DE', 'rfqtest-v-de-' || _buyer::text, false, 'DE', gen_random_uuid())
    RETURNING id INTO _v_de_inactive;
  INSERT INTO public.vendors (id, name, slug, is_active, country_code, auth_user_id)
    VALUES (gen_random_uuid(), 'RFQTEST_V_NULL', 'rfqtest-v-null-' || _buyer::text, true, NULL, gen_random_uuid())
    RETURNING id INTO _v_null_country;

  -- Offre directe BE
  INSERT INTO public.offers (vendor_id, product_id, price_excl_vat_cents, is_active)
    VALUES (_v_be_offer, _product, 1000, true);

  -- Intérêts catalogue
  INSERT INTO public.vendor_catalog_interests (vendor_id, brand_id) VALUES (_v_fr_brand, _brand);
  INSERT INTO public.vendor_catalog_interests (vendor_id, brand_id) VALUES (_v_es_brand, _brand);
  INSERT INTO public.vendor_catalog_interests (vendor_id, brand_id) VALUES (_v_de_inactive, _brand);
  INSERT INTO public.vendor_catalog_interests (vendor_id, brand_id) VALUES (_v_null_country, _brand);
  INSERT INTO public.vendor_catalog_interests (vendor_id, category_id) VALUES (_v_lu_cat, _cat);

  -- === Création RFQs de test ===
  INSERT INTO public.rfqs (id, buyer_user_id, product_id, target_scope, quantity, destination_country_code, status)
    VALUES (gen_random_uuid(), _buyer, _product, 'product', 100, 'BE', 'draft')
    RETURNING id INTO _rfq_be;

  INSERT INTO public.rfqs (id, buyer_user_id, product_id, target_scope, quantity, destination_country_code, status)
    VALUES (gen_random_uuid(), _buyer, _product, 'product', 100, 'FR', 'draft')
    RETURNING id INTO _rfq_fr;

  INSERT INTO public.rfqs (id, buyer_user_id, product_id, target_scope, quantity, destination_country_code, status)
    VALUES (gen_random_uuid(), _buyer, _product, 'product', 100, 'BE', 'draft')
    RETURNING id INTO _rfq_no_country;

  -- === Scénario 1 : Acheteur BE → BE+FR+LU+NULL (4), exclut ES (non limitrophe) et DE (inactif) ===
  SELECT count(*), string_agg(v.name, ',' ORDER BY v.name)
  INTO _count, _list
  FROM public.rfq_resolve_target_vendors(_rfq_be) t
  JOIN public.vendors v ON v.id = t.vendor_id;

  scenario := 'BE buyer: include BE/FR/LU/NULL, exclude ES (not adjacent) and DE (inactive)';
  expected := 4; actual := _count; ok := (_count = 4); details := _list;
  RETURN NEXT;

  -- === Scénario 2 : Acheteur FR → BE/LU adjacents, ES adjacent à FR (inclut), exclut DE inactif ===
  SELECT count(*), string_agg(v.name, ',' ORDER BY v.name)
  INTO _count, _list
  FROM public.rfq_resolve_target_vendors(_rfq_fr) t
  JOIN public.vendors v ON v.id = t.vendor_id;

  scenario := 'FR buyer: include BE/FR/LU/ES (ES is adjacent to FR) + NULL country';
  expected := 5; actual := _count; ok := (_count = 5); details := _list;
  RETURN NEXT;

  -- === Scénario 3 : Vendeur avec offre directe a la raison product_offer (priorité) ===
  SELECT t.reason::text INTO _list
  FROM public.rfq_resolve_target_vendors(_rfq_be) t
  WHERE t.vendor_id = _v_be_offer;

  scenario := 'Vendor with direct offer must have reason=product_offer';
  expected := 1; actual := CASE WHEN _list = 'product_offer' THEN 1 ELSE 0 END;
  ok := (_list = 'product_offer'); details := COALESCE(_list, 'NULL');
  RETURN NEXT;

  -- === Scénario 4 : Vendeur sur intérêt catégorie est bien sélectionné ===
  SELECT count(*) INTO _count
  FROM public.rfq_resolve_target_vendors(_rfq_be) t
  WHERE t.vendor_id = _v_lu_cat AND t.reason = 'category_interest';

  scenario := 'Vendor with category interest is selected with reason=category_interest';
  expected := 1; actual := _count; ok := (_count = 1); details := 'LU vendor matched on category';
  RETURN NEXT;

  -- === Scénario 5 : Vendeur ES (non adjacent BE) bien EXCLU pour acheteur BE ===
  SELECT count(*) INTO _count
  FROM public.rfq_resolve_target_vendors(_rfq_be) t
  WHERE t.vendor_id = _v_es_brand;

  scenario := 'ES vendor (not adjacent to BE) is excluded for BE buyer';
  expected := 0; actual := _count; ok := (_count = 0); details := 'ES vendor must not appear';
  RETURN NEXT;

  -- === Scénario 6 : Vendeur ES (adjacent FR) bien INCLUS pour acheteur FR ===
  SELECT count(*) INTO _count
  FROM public.rfq_resolve_target_vendors(_rfq_fr) t
  WHERE t.vendor_id = _v_es_brand;

  scenario := 'ES vendor (adjacent to FR) is included for FR buyer';
  expected := 1; actual := _count; ok := (_count = 1); details := 'ES vendor must appear';
  RETURN NEXT;

  -- === Scénario 7 : Vendeur DE inactif est TOUJOURS exclu ===
  SELECT count(*) INTO _count
  FROM public.rfq_resolve_target_vendors(_rfq_be) t
  WHERE t.vendor_id = _v_de_inactive;

  scenario := 'Inactive vendor is always excluded';
  expected := 0; actual := _count; ok := (_count = 0); details := 'DE inactive vendor';
  RETURN NEXT;

  -- === Scénario 8 : Vendeur sans country_code est inclus partout ===
  SELECT count(*) INTO _count
  FROM public.rfq_resolve_target_vendors(_rfq_be) t
  WHERE t.vendor_id = _v_null_country;

  scenario := 'Vendor with NULL country_code is always eligible';
  expected := 1; actual := _count; ok := (_count = 1); details := 'NULL-country vendor';
  RETURN NEXT;

  -- === Cleanup ===
  DELETE FROM public.rfqs WHERE id IN (_rfq_be, _rfq_fr, _rfq_no_country);
  DELETE FROM public.vendor_catalog_interests
    WHERE vendor_id IN (_v_be_offer, _v_fr_brand, _v_lu_cat, _v_es_brand, _v_de_inactive, _v_null_country);
  DELETE FROM public.offers WHERE vendor_id = _v_be_offer AND product_id = _product;
  DELETE FROM public.products WHERE id = _product;
  DELETE FROM public.categories WHERE id = _cat;
  DELETE FROM public.manufacturers WHERE id = _mfr;
  DELETE FROM public.brands WHERE id = _brand;
  DELETE FROM public.vendors WHERE id IN (_v_be_offer, _v_fr_brand, _v_lu_cat, _v_es_brand, _v_de_inactive, _v_null_country);
END;
$$;

REVOKE ALL ON FUNCTION public.rfq_routing_self_test() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rfq_routing_self_test() TO service_role;