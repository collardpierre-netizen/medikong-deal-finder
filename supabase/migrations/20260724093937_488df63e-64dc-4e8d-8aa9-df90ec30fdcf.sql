
-- 1) Rename the system vendor
UPDATE public.vendors
SET name = 'MediKong',
    company_name = CASE WHEN company_name = 'Balooh' THEN 'MediKong' ELSE company_name END,
    updated_at = now()
WHERE name = 'Balooh';

-- 2) Update SQL functions that filtered on v.name = 'Balooh'

CREATE OR REPLACE FUNCTION public.qogita_backed_vendor_ids()
 RETURNS TABLE(vendor_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT v.id
  FROM public.vendors v
  WHERE v.qogita_seller_alias IS NOT NULL
     OR v.name = 'MediKong'
$function$;

CREATE OR REPLACE FUNCTION public.qogita_sweep_staleness(_threshold_days integer DEFAULT 7, _country text DEFAULT NULL::text, _dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_qogita_vendor_ids uuid[];
  v_candidate_offers uuid[];
  v_candidate_products uuid[];
  v_candidate_vendors uuid[];
  v_total_offers int;
  v_total_products int;
  v_total_vendors int;
  v_cutoff timestamptz;
BEGIN
  IF _threshold_days IS NULL OR _threshold_days < 1 THEN
    RAISE EXCEPTION '_threshold_days must be >= 1';
  END IF;
  v_cutoff := now() - (_threshold_days || ' days')::interval;

  SELECT array_agg(vendor_id) INTO v_qogita_vendor_ids FROM public.qogita_backed_vendor_ids();
  IF v_qogita_vendor_ids IS NULL OR array_length(v_qogita_vendor_ids, 1) = 0 THEN
    RETURN jsonb_build_object('status', 'noop', 'reason', 'no_qogita_vendors');
  END IF;

  SELECT array_agg(o.id) INTO v_candidate_offers
  FROM public.offers o
  WHERE o.vendor_id = ANY(v_qogita_vendor_ids)
    AND o.is_active = true
    AND (o.synced_at IS NULL OR o.synced_at < v_cutoff);

  SELECT array_agg(p.id) INTO v_candidate_products
  FROM public.products p
  WHERE p.source = 'qogita'
    AND p.is_active = true
    AND (p.synced_at IS NULL OR p.synced_at < v_cutoff)
    AND NOT EXISTS (
      SELECT 1 FROM public.offers o2
       WHERE o2.product_id = p.id AND o2.is_active = true
         AND NOT (o2.vendor_id = ANY(v_qogita_vendor_ids)
                  AND (o2.synced_at IS NULL OR o2.synced_at < v_cutoff))
    );

  SELECT array_agg(v.id) INTO v_candidate_vendors
  FROM public.vendors v
  WHERE v.id = ANY(v_qogita_vendor_ids)
    AND v.is_active = true
    AND v.name <> 'MediKong'
    AND NOT EXISTS (
      SELECT 1 FROM public.offers o3
       WHERE o3.vendor_id = v.id AND o3.is_active = true
         AND NOT (o3.synced_at IS NULL OR o3.synced_at < v_cutoff)
    );

  SELECT count(*) INTO v_total_offers FROM public.offers WHERE vendor_id = ANY(v_qogita_vendor_ids) AND is_active = true;
  SELECT count(*) INTO v_total_products FROM public.products WHERE source = 'qogita' AND is_active = true;
  SELECT count(*) INTO v_total_vendors FROM public.vendors WHERE id = ANY(v_qogita_vendor_ids) AND is_active = true AND name <> 'MediKong';

  RETURN public._qogita_apply_sweep(
    'staleness', NULL, _threshold_days, _country,
    COALESCE(v_candidate_offers, ARRAY[]::uuid[]),
    COALESCE(v_candidate_products, ARRAY[]::uuid[]),
    COALESCE(v_candidate_vendors, ARRAY[]::uuid[]),
    v_total_offers, v_total_products, v_total_vendors,
    0, _dry_run
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.qogita_sweep_run_id(_sync_run_id uuid, _country text DEFAULT NULL::text, _dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_qogita_vendor_ids uuid[];
  v_candidate_offers uuid[];
  v_candidate_products uuid[];
  v_candidate_vendors uuid[];
  v_total_offers int;
  v_total_products int;
  v_total_vendors int;
  v_errors int := 0;
  v_processed int := 0;
  v_ratio numeric := 0;
BEGIN
  IF _sync_run_id IS NULL THEN
    RAISE EXCEPTION '_sync_run_id is required';
  END IF;

  SELECT array_agg(vendor_id) INTO v_qogita_vendor_ids FROM public.qogita_backed_vendor_ids();
  IF v_qogita_vendor_ids IS NULL OR array_length(v_qogita_vendor_ids, 1) = 0 THEN
    RETURN jsonb_build_object('status', 'noop', 'reason', 'no_qogita_vendors');
  END IF;

  SELECT array_agg(o.id) INTO v_candidate_offers
  FROM public.offers o
  WHERE o.vendor_id = ANY(v_qogita_vendor_ids)
    AND o.is_active = true
    AND (o.last_sync_run_id IS DISTINCT FROM _sync_run_id);

  SELECT array_agg(p.id) INTO v_candidate_products
  FROM public.products p
  WHERE p.source = 'qogita'
    AND p.is_active = true
    AND (p.last_sync_run_id IS DISTINCT FROM _sync_run_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.offers o2
       WHERE o2.product_id = p.id
         AND o2.is_active = true
         AND NOT (o2.vendor_id = ANY(v_qogita_vendor_ids) AND (o2.last_sync_run_id IS DISTINCT FROM _sync_run_id))
    );

  SELECT array_agg(v.id) INTO v_candidate_vendors
  FROM public.vendors v
  WHERE v.id = ANY(v_qogita_vendor_ids)
    AND v.is_active = true
    AND (v.last_sync_run_id IS DISTINCT FROM _sync_run_id)
    AND v.name <> 'MediKong'  -- never auto-deactivate MediKong (system vendor)
    AND NOT EXISTS (
      SELECT 1 FROM public.offers o3
       WHERE o3.vendor_id = v.id
         AND o3.is_active = true
         AND NOT (o3.last_sync_run_id IS DISTINCT FROM _sync_run_id)
    );

  SELECT count(*) INTO v_total_offers FROM public.offers WHERE vendor_id = ANY(v_qogita_vendor_ids) AND is_active = true;
  SELECT count(*) INTO v_total_products FROM public.products WHERE source = 'qogita' AND is_active = true;
  SELECT count(*) INTO v_total_vendors FROM public.vendors WHERE id = ANY(v_qogita_vendor_ids) AND is_active = true AND name <> 'MediKong';

  SELECT COALESCE(sum(total_errors), 0), COALESCE(sum(offers_processed), 0)
    INTO v_errors, v_processed
    FROM public.qogita_resync_logs
   WHERE sync_run_id = _sync_run_id AND sweep_type IS NULL;
  IF v_processed > 0 THEN v_ratio := v_errors::numeric / v_processed; END IF;

  RETURN public._qogita_apply_sweep(
    'run_id', _sync_run_id, NULL, _country,
    COALESCE(v_candidate_offers, ARRAY[]::uuid[]),
    COALESCE(v_candidate_products, ARRAY[]::uuid[]),
    COALESCE(v_candidate_vendors, ARRAY[]::uuid[]),
    v_total_offers, v_total_products, v_total_vendors,
    v_ratio, _dry_run
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_blocked_offers_list()
 RETURNS TABLE(offer_id uuid, vendor_id uuid, vendor_name text, vendor_display_code text, product_id uuid, product_name text, product_gtin text, brand_id uuid, brand_name text, is_active boolean, updated_at timestamp with time zone, missing_distributor boolean, missing_mandate boolean, is_authorized_distributor boolean, mandate_signed_at timestamp with time zone, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    o.id, v.id, v.name, v.display_code,
    p.id, p.name, p.gtin,
    b.id, b.name,
    o.is_active, o.updated_at,
    (COALESCE(v.is_authorized_distributor, false) = false),
    (v.mandate_signed_at IS NULL),
    COALESCE(v.is_authorized_distributor, false),
    v.mandate_signed_at,
    CASE
      WHEN COALESCE(v.is_authorized_distributor, false) = false AND v.mandate_signed_at IS NULL
        THEN 'Distributeur non autorisé + mandat non signé'
      WHEN COALESCE(v.is_authorized_distributor, false) = false
        THEN 'Vendeur non déclaré distributeur autorisé'
      WHEN v.mandate_signed_at IS NULL
        THEN 'Mandat de facturation non signé'
      ELSE 'Conforme'
    END
  FROM public.offers o
  JOIN public.vendors v ON v.id = o.vendor_id
  LEFT JOIN public.products p ON p.id = o.product_id
  LEFT JOIN public.brands b ON b.id = p.brand_id
  WHERE o.is_active = false
    AND v.name <> 'MediKong'
    AND (COALESCE(v.is_authorized_distributor, false) = false OR v.mandate_signed_at IS NULL)
  ORDER BY o.updated_at DESC NULLS LAST
  LIMIT 1000;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_offer_publication_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_auth boolean;
  v_mandate timestamptz;
BEGIN
  IF COALESCE(NEW.is_active, false) = false THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.is_active = true
     AND OLD.vendor_id IS NOT DISTINCT FROM NEW.vendor_id THEN
    RETURN NEW;
  END IF;

  SELECT name, is_authorized_distributor, mandate_signed_at
    INTO v_name, v_auth, v_mandate
    FROM public.vendors
   WHERE id = NEW.vendor_id;

  IF v_name = 'MediKong' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_auth, false) = false OR v_mandate IS NULL THEN
    RAISE EXCEPTION
      'Offre non publiable : le vendeur doit être distributeur autorisé (is_authorized_distributor) ET avoir signé le mandat de facturation (mandate_signed_at).'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_recheck_offer_publication(_offer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vendor_id uuid;
  v_auth boolean;
  v_mandate timestamptz;
  v_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT o.vendor_id INTO v_vendor_id
    FROM public.offers o WHERE o.id = _offer_id;

  IF v_vendor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Offre introuvable');
  END IF;

  SELECT name, COALESCE(is_authorized_distributor, false), mandate_signed_at
    INTO v_name, v_auth, v_mandate
    FROM public.vendors WHERE id = v_vendor_id;

  IF v_name = 'MediKong' THEN
    UPDATE public.offers SET is_active = true, updated_at = now() WHERE id = _offer_id;
    RETURN jsonb_build_object('ok', true, 'activated', true, 'reason', 'Vendeur interne (MediKong)');
  END IF;

  IF v_auth = false OR v_mandate IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'activated', false,
      'is_authorized_distributor', v_auth,
      'billing_mandate_signed', (v_mandate IS NOT NULL),
      'reason',
      CASE
        WHEN v_auth = false AND v_mandate IS NULL THEN 'Distributeur non autorisé + mandat non signé'
        WHEN v_auth = false THEN 'Vendeur non déclaré distributeur autorisé'
        ELSE 'Mandat de facturation non signé'
      END
    );
  END IF;

  UPDATE public.offers SET is_active = true, updated_at = now() WHERE id = _offer_id;

  RETURN jsonb_build_object('ok', true, 'activated', true, 'reason', 'Offre republiée');
END;
$function$;
