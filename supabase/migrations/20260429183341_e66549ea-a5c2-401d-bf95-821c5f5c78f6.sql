-- ============================================================
-- Trigger auto-notif catalogue : brands.is_active / products.is_active → vendor_notifications
-- Idempotent via vendor_notification_dispatch_log (UNIQUE vendor_id+source_type+source_id)
-- ============================================================

-- Fonction de dispatch pour une nouvelle marque devenue active
CREATE OR REPLACE FUNCTION public.dispatch_brand_activation_notifications(_brand_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand RECORD;
  v_manufacturer_name text;
  v_inserted int := 0;
  r RECORD;
  v_notif_id uuid;
BEGIN
  SELECT b.id, b.name, b.slug, b.manufacturer_id, b.proposed_by_vendor_id
  INTO v_brand
  FROM public.brands b
  WHERE b.id = _brand_id;

  IF v_brand IS NULL THEN RETURN 0; END IF;

  SELECT m.name INTO v_manufacturer_name
  FROM public.manufacturers m
  WHERE m.id = v_brand.manufacturer_id;

  -- Cible : vendeurs intéressés par CE fabricant ou par CETTE marque
  --        + heuristique : vendeurs ayant déjà au moins une offre active sur le même fabricant
  --        - exclure le vendeur qui a proposé la marque
  --        - exclure ceux déjà notifiés (dédup via dispatch_log)
  FOR r IN
    WITH explicit_interests AS (
      SELECT DISTINCT vci.vendor_id, vci.id AS interest_id
      FROM public.vendor_catalog_interests vci
      WHERE vci.notify_new_brand = true
        AND (
          (vci.brand_id = v_brand.id)
          OR (vci.manufacturer_id IS NOT NULL AND vci.manufacturer_id = v_brand.manufacturer_id)
        )
    ),
    heuristic_vendors AS (
      SELECT DISTINCT o.vendor_id, NULL::uuid AS interest_id
      FROM public.offers o
      JOIN public.products p ON p.id = o.product_id
      WHERE o.is_active = true
        AND p.manufacturer_id = v_brand.manufacturer_id
        AND v_brand.manufacturer_id IS NOT NULL
    ),
    targets AS (
      SELECT vendor_id, MAX(interest_id) AS interest_id
      FROM (
        SELECT * FROM explicit_interests
        UNION ALL
        SELECT * FROM heuristic_vendors
      ) u
      GROUP BY vendor_id
    )
    SELECT t.vendor_id, t.interest_id
    FROM targets t
    JOIN public.vendors v ON v.id = t.vendor_id
    WHERE v.is_active = true
      AND (v_brand.proposed_by_vendor_id IS NULL OR t.vendor_id <> v_brand.proposed_by_vendor_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_notification_dispatch_log d
        WHERE d.vendor_id = t.vendor_id
          AND d.source_type = 'brand_activation'
          AND d.source_id = v_brand.id
      )
  LOOP
    INSERT INTO public.vendor_notifications (vendor_id, type, title, body, payload, cta_url)
    VALUES (
      r.vendor_id,
      'catalog.new_brand',
      'Nouvelle marque sur MediKong : ' || v_brand.name,
      COALESCE(v_manufacturer_name || ' — ', '') || 'Vous la vendez ? Ajoutez-y vos tarifs en quelques clics.',
      jsonb_build_object(
        'brand_id', v_brand.id,
        'brand_slug', v_brand.slug,
        'brand_name', v_brand.name,
        'manufacturer_id', v_brand.manufacturer_id,
        'manufacturer_name', v_manufacturer_name
      ),
      '/vendor/offers?action=create&brand=' || v_brand.id::text
    )
    RETURNING id INTO v_notif_id;

    INSERT INTO public.vendor_notification_dispatch_log
      (vendor_id, source_type, source_id, interest_id, notification_id)
    VALUES (r.vendor_id, 'brand_activation', v_brand.id, r.interest_id, v_notif_id)
    ON CONFLICT (vendor_id, source_type, source_id) DO NOTHING;

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- Fonction de dispatch pour un nouveau produit actif
CREATE OR REPLACE FUNCTION public.dispatch_product_activation_notifications(_product_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_brand_name text;
  v_manufacturer_name text;
  v_inserted int := 0;
  r RECORD;
  v_notif_id uuid;
BEGIN
  SELECT p.id, p.name, p.slug, p.brand_id, p.manufacturer_id, p.category_id, p.proposed_by_vendor_id
  INTO v_product
  FROM public.products p
  WHERE p.id = _product_id;

  IF v_product IS NULL THEN RETURN 0; END IF;

  SELECT name INTO v_brand_name FROM public.brands WHERE id = v_product.brand_id;
  SELECT name INTO v_manufacturer_name FROM public.manufacturers WHERE id = v_product.manufacturer_id;

  FOR r IN
    WITH explicit_interests AS (
      SELECT DISTINCT vci.vendor_id, vci.id AS interest_id
      FROM public.vendor_catalog_interests vci
      WHERE vci.notify_new_product = true
        AND (
          (vci.brand_id IS NOT NULL AND vci.brand_id = v_product.brand_id)
          OR (vci.manufacturer_id IS NOT NULL AND vci.manufacturer_id = v_product.manufacturer_id)
          OR (vci.category_id IS NOT NULL AND vci.category_id = v_product.category_id)
        )
    ),
    heuristic_vendors AS (
      SELECT DISTINCT o.vendor_id, NULL::uuid AS interest_id
      FROM public.offers o
      JOIN public.products p ON p.id = o.product_id
      WHERE o.is_active = true
        AND v_product.manufacturer_id IS NOT NULL
        AND p.manufacturer_id = v_product.manufacturer_id
    ),
    targets AS (
      SELECT vendor_id, MAX(interest_id) AS interest_id
      FROM (
        SELECT * FROM explicit_interests
        UNION ALL
        SELECT * FROM heuristic_vendors
      ) u
      GROUP BY vendor_id
    )
    SELECT t.vendor_id, t.interest_id
    FROM targets t
    JOIN public.vendors v ON v.id = t.vendor_id
    WHERE v.is_active = true
      AND (v_product.proposed_by_vendor_id IS NULL OR t.vendor_id <> v_product.proposed_by_vendor_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_notification_dispatch_log d
        WHERE d.vendor_id = t.vendor_id
          AND d.source_type = 'product_activation'
          AND d.source_id = v_product.id
      )
  LOOP
    INSERT INTO public.vendor_notifications (vendor_id, type, title, body, payload, cta_url)
    VALUES (
      r.vendor_id,
      'catalog.new_product',
      'Nouveau produit : ' || v_product.name,
      COALESCE(v_brand_name, v_manufacturer_name, 'MediKong') || ' — Ajoutez vos tarifs pour vous positionner.',
      jsonb_build_object(
        'product_id', v_product.id,
        'product_slug', v_product.slug,
        'product_name', v_product.name,
        'brand_id', v_product.brand_id,
        'brand_name', v_brand_name,
        'manufacturer_id', v_product.manufacturer_id,
        'manufacturer_name', v_manufacturer_name
      ),
      '/vendor/offers?action=create&product=' || v_product.id::text
    )
    RETURNING id INTO v_notif_id;

    INSERT INTO public.vendor_notification_dispatch_log
      (vendor_id, source_type, source_id, interest_id, notification_id)
    VALUES (r.vendor_id, 'product_activation', v_product.id, r.interest_id, v_notif_id)
    ON CONFLICT (vendor_id, source_type, source_id) DO NOTHING;

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- Trigger sur brands : fire si transition vers is_active=true ET (submission_status NULL ou 'approved')
CREATE OR REPLACE FUNCTION public.tg_brand_activation_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_active, false) = true
     AND COALESCE(OLD.is_active, false) = false
     AND (NEW.submission_status IS NULL OR NEW.submission_status::text = 'approved')
  THEN
    PERFORM public.dispatch_brand_activation_notifications(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brand_activation_notify ON public.brands;
CREATE TRIGGER trg_brand_activation_notify
  AFTER UPDATE OF is_active, submission_status ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_brand_activation_notify();

-- Trigger sur products : fire si transition vers is_active=true ET (submission_status NULL ou 'approved')
CREATE OR REPLACE FUNCTION public.tg_product_activation_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_active, false) = true
     AND COALESCE(OLD.is_active, false) = false
     AND (NEW.submission_status IS NULL OR NEW.submission_status::text = 'approved')
  THEN
    PERFORM public.dispatch_product_activation_notifications(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_activation_notify ON public.products;
CREATE TRIGGER trg_product_activation_notify
  AFTER UPDATE OF is_active, submission_status ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_product_activation_notify();

-- RPC admin pour rejouer manuellement une notif (utile en cas de besoin de re-dispatch)
CREATE OR REPLACE FUNCTION public.admin_redispatch_catalog_notifications(
  _source_type text,
  _source_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  IF _source_type = 'brand_activation' THEN
    -- Purge dédup pour cette source pour permettre de re-notifier
    DELETE FROM public.vendor_notification_dispatch_log
    WHERE source_type = 'brand_activation' AND source_id = _source_id;
    v_count := public.dispatch_brand_activation_notifications(_source_id);
  ELSIF _source_type = 'product_activation' THEN
    DELETE FROM public.vendor_notification_dispatch_log
    WHERE source_type = 'product_activation' AND source_id = _source_id;
    v_count := public.dispatch_product_activation_notifications(_source_id);
  ELSE
    RAISE EXCEPTION 'source_type invalide : %', _source_type USING ERRCODE = '22023';
  END IF;

  RETURN v_count;
END;
$$;