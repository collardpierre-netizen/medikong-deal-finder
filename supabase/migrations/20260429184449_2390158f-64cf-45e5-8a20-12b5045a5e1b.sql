-- Trigger d'auto-notification vendeurs sur activation marque/produit
-- Crée des vendor_notifications quand brands.is_active ou products.is_active passe false → true
-- ou à la création directe avec is_active=true.
-- Idempotent via vendor_notification_dispatch_log (uniq vendor_id, source_type, source_id).

------------------------------------------------------------
-- 1) BRANDS : notifications "nouvelle marque dispo"
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_brand_activation_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_dispatch boolean := false;
BEGIN
  -- INSERT actif
  IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
    v_should_dispatch := true;
  END IF;

  -- UPDATE : transition vers actif
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.is_active, false) = false
     AND NEW.is_active = true THEN
    v_should_dispatch := true;
  END IF;

  IF NOT v_should_dispatch THEN
    RETURN NEW;
  END IF;

  -- Pour chaque vendeur intéressé (par marque, ou par fabricant lié)
  -- ET non encore notifié pour cette source.
  WITH candidates AS (
    SELECT DISTINCT ON (vci.vendor_id)
      vci.vendor_id,
      vci.id AS interest_id
    FROM public.vendor_catalog_interests vci
    JOIN public.vendors v ON v.id = vci.vendor_id AND COALESCE(v.is_active, true) = true
    WHERE vci.notify_new_brand = true
      AND (
        vci.brand_id = NEW.id
        OR (
          vci.manufacturer_id IS NOT NULL
          AND NEW.manufacturer_id IS NOT NULL
          AND vci.manufacturer_id = NEW.manufacturer_id
        )
      )
    ORDER BY vci.vendor_id, vci.created_at ASC
  ),
  inserted_notifs AS (
    INSERT INTO public.vendor_notifications (vendor_id, type, title, body, payload, cta_url)
    SELECT
      c.vendor_id,
      'catalog_brand_activated',
      'Nouvelle marque disponible : ' || NEW.name,
      'Une marque qui vous intéresse vient d''être activée sur MediKong. Vous pouvez créer vos premières offres.',
      jsonb_build_object(
        'brand_id', NEW.id,
        'brand_slug', NEW.slug,
        'brand_name', NEW.name,
        'manufacturer_id', NEW.manufacturer_id,
        'interest_id', c.interest_id
      ),
      '/vendor/offers?action=create&brand=' || NEW.id
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.vendor_notification_dispatch_log d
      WHERE d.vendor_id = c.vendor_id
        AND d.source_type = 'brand_activation'
        AND d.source_id = NEW.id
    )
    RETURNING id, vendor_id
  )
  INSERT INTO public.vendor_notification_dispatch_log
    (vendor_id, source_type, source_id, interest_id, notification_id)
  SELECT
    i.vendor_id,
    'brand_activation',
    NEW.id,
    c.interest_id,
    i.id
  FROM inserted_notifs i
  JOIN candidates c ON c.vendor_id = i.vendor_id
  ON CONFLICT (vendor_id, source_type, source_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_brand_activation_notifications ON public.brands;
CREATE TRIGGER trg_dispatch_brand_activation_notifications
AFTER INSERT OR UPDATE OF is_active ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_brand_activation_notifications();


------------------------------------------------------------
-- 2) PRODUCTS : notifications "nouveau produit dispo"
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_product_activation_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_dispatch boolean := false;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
    v_should_dispatch := true;
  END IF;

  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.is_active, false) = false
     AND NEW.is_active = true THEN
    v_should_dispatch := true;
  END IF;

  IF NOT v_should_dispatch THEN
    RETURN NEW;
  END IF;

  -- Vendeurs intéressés par : la marque, le fabricant OU la catégorie
  WITH candidates AS (
    SELECT DISTINCT ON (vci.vendor_id)
      vci.vendor_id,
      vci.id AS interest_id
    FROM public.vendor_catalog_interests vci
    JOIN public.vendors v ON v.id = vci.vendor_id AND COALESCE(v.is_active, true) = true
    WHERE vci.notify_new_product = true
      AND (
        (vci.brand_id IS NOT NULL AND NEW.brand_id IS NOT NULL AND vci.brand_id = NEW.brand_id)
        OR (vci.manufacturer_id IS NOT NULL AND NEW.manufacturer_id IS NOT NULL AND vci.manufacturer_id = NEW.manufacturer_id)
        OR (vci.category_id IS NOT NULL AND NEW.category_id IS NOT NULL AND vci.category_id = NEW.category_id)
      )
    ORDER BY vci.vendor_id, vci.created_at ASC
  ),
  inserted_notifs AS (
    INSERT INTO public.vendor_notifications (vendor_id, type, title, body, payload, cta_url)
    SELECT
      c.vendor_id,
      'catalog_product_activated',
      'Nouveau produit dans votre veille : ' || NEW.name,
      'Un produit qui correspond à vos centres d''intérêt vient d''être activé. Créez votre offre pour vous positionner.',
      jsonb_build_object(
        'product_id', NEW.id,
        'product_slug', NEW.slug,
        'product_name', NEW.name,
        'brand_id', NEW.brand_id,
        'manufacturer_id', NEW.manufacturer_id,
        'category_id', NEW.category_id,
        'gtin', NEW.gtin,
        'cnk_code', NEW.cnk_code,
        'interest_id', c.interest_id
      ),
      '/vendor/offers?action=create&product=' || NEW.id
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.vendor_notification_dispatch_log d
      WHERE d.vendor_id = c.vendor_id
        AND d.source_type = 'product_activation'
        AND d.source_id = NEW.id
    )
    RETURNING id, vendor_id
  )
  INSERT INTO public.vendor_notification_dispatch_log
    (vendor_id, source_type, source_id, interest_id, notification_id)
  SELECT
    i.vendor_id,
    'product_activation',
    NEW.id,
    c.interest_id,
    i.id
  FROM inserted_notifs i
  JOIN candidates c ON c.vendor_id = i.vendor_id
  ON CONFLICT (vendor_id, source_type, source_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_product_activation_notifications ON public.products;
CREATE TRIGGER trg_dispatch_product_activation_notifications
AFTER INSERT OR UPDATE OF is_active ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_product_activation_notifications();