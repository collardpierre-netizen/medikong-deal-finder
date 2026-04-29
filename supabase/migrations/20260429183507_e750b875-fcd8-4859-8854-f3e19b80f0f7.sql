-- ============================================================
-- RPCs admin pour traiter la file product_submissions
-- ============================================================

-- 1) Détecter les doublons potentiels d'une soumission
CREATE OR REPLACE FUNCTION public.admin_find_submission_duplicates(_submission_id uuid)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_slug text,
  brand_name text,
  manufacturer_name text,
  match_reason text,
  similarity numeric,
  is_active boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
  v_cnk text;
  v_gtin text;
  v_name text;
  v_brand text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  SELECT proposed_payload INTO v_payload
  FROM public.product_submissions WHERE id = _submission_id;

  IF v_payload IS NULL THEN RETURN; END IF;

  v_cnk := NULLIF(BTRIM(COALESCE(v_payload->>'cnk_code', v_payload->>'cnk', v_payload->'product'->>'cnk')), '');
  v_gtin := NULLIF(BTRIM(COALESCE(v_payload->>'gtin', v_payload->'product'->>'gtin', v_payload->>'ean')), '');
  v_name := NULLIF(BTRIM(COALESCE(v_payload->>'product_name', v_payload->>'name', v_payload->'product'->>'name')), '');
  v_brand := NULLIF(BTRIM(COALESCE(v_payload->>'brand_name', v_payload->'brand'->>'name')), '');

  RETURN QUERY
  WITH cnk_match AS (
    SELECT p.id, 'CNK exact' AS reason, 1.0::numeric AS sim
    FROM public.products p
    WHERE v_cnk IS NOT NULL AND p.cnk_code = v_cnk
      AND (p.submission_status IS NULL OR p.submission_status::text = 'approved')
    LIMIT 5
  ),
  gtin_match AS (
    SELECT p.id, 'GTIN exact' AS reason, 1.0::numeric AS sim
    FROM public.products p
    WHERE v_gtin IS NOT NULL AND p.gtin = v_gtin
      AND (p.submission_status IS NULL OR p.submission_status::text = 'approved')
    LIMIT 5
  ),
  name_match AS (
    SELECT p.id,
           'Nom similaire' || COALESCE(' (marque ' || b.name || ')', '') AS reason,
           similarity(LOWER(p.name), LOWER(v_name))::numeric AS sim
    FROM public.products p
    LEFT JOIN public.brands b ON b.id = p.brand_id
    WHERE v_name IS NOT NULL
      AND (p.submission_status IS NULL OR p.submission_status::text = 'approved')
      AND similarity(LOWER(p.name), LOWER(v_name)) >= 0.6
    ORDER BY similarity(LOWER(p.name), LOWER(v_name)) DESC
    LIMIT 5
  ),
  combined AS (
    SELECT * FROM cnk_match
    UNION ALL SELECT * FROM gtin_match
    UNION ALL SELECT * FROM name_match
  ),
  ranked AS (
    SELECT id, reason, sim,
           ROW_NUMBER() OVER (PARTITION BY id ORDER BY sim DESC) AS rn
    FROM combined
  )
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.slug AS product_slug,
    b.name AS brand_name,
    m.name AS manufacturer_name,
    r.reason AS match_reason,
    ROUND(r.sim, 3) AS similarity,
    p.is_active
  FROM ranked r
  JOIN public.products p ON p.id = r.id
  LEFT JOIN public.brands b ON b.id = p.brand_id
  LEFT JOIN public.manufacturers m ON m.id = p.manufacturer_id
  WHERE r.rn = 1
  ORDER BY r.sim DESC, p.is_active DESC;
END;
$$;

-- 2) Action principale : approve / reject / needs_changes / merge
CREATE OR REPLACE FUNCTION public.admin_review_product_submission(
  _submission_id uuid,
  _decision text,                    -- 'approve' | 'reject' | 'needs_changes' | 'merge'
  _comment text DEFAULT NULL,
  _merge_into_product_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_sub RECORD;
  v_product_id uuid;
  v_brand_id uuid;
  v_manufacturer_id uuid;
  v_payload jsonb;
  v_product_name text;
  v_notif_title text;
  v_notif_body text;
  v_notif_cta text;
  v_offers_rerouted int := 0;
BEGIN
  IF v_user IS NULL OR NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  IF _decision NOT IN ('approve','reject','needs_changes','merge') THEN
    RAISE EXCEPTION 'Décision invalide : %', _decision USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_sub FROM public.product_submissions WHERE id = _submission_id FOR UPDATE;
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Soumission introuvable' USING ERRCODE = 'P0002';
  END IF;

  IF v_sub.status::text IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Cette soumission a déjà été traitée (statut = %)', v_sub.status USING ERRCODE = '22023';
  END IF;

  v_payload := v_sub.proposed_payload;
  v_product_name := COALESCE(v_payload->>'product_name', v_payload->>'name', v_payload->'product'->>'name', 'Produit proposé');

  -- Résoudre les ids cibles : utilise resulting_*_id si déjà liés à des lignes provisoires
  v_product_id := v_sub.resulting_product_id;
  v_brand_id := v_sub.resulting_brand_id;
  v_manufacturer_id := v_sub.resulting_manufacturer_id;

  IF _decision = 'approve' THEN
    -- Activer la cascade : manufacturer → brand → product
    IF v_manufacturer_id IS NOT NULL THEN
      UPDATE public.manufacturers
      SET is_active = true,
          submission_status = 'approved'::public.submission_status_enum
      WHERE id = v_manufacturer_id;
    END IF;

    IF v_brand_id IS NOT NULL THEN
      UPDATE public.brands
      SET is_active = true,
          submission_status = 'approved'::public.submission_status_enum
      WHERE id = v_brand_id;
    END IF;

    IF v_product_id IS NOT NULL THEN
      UPDATE public.products
      SET is_active = true,
          submission_status = 'approved'::public.submission_status_enum
      WHERE id = v_product_id;
    END IF;

    UPDATE public.product_submissions
    SET status = 'approved'::product_submission_status,
        reviewed_by = v_user,
        reviewed_at = now(),
        review_comment = _comment
    WHERE id = _submission_id;

    v_notif_title := 'Votre proposition « ' || v_product_name || ' » a été validée ✅';
    v_notif_body := 'Le produit est désormais publié dans le catalogue MediKong. Vous pouvez activer vos offres.';
    v_notif_cta := COALESCE('/vendor/offers?action=create&product=' || v_product_id::text, '/vendor/catalog');

  ELSIF _decision = 'merge' THEN
    IF _merge_into_product_id IS NULL THEN
      RAISE EXCEPTION 'merge_into_product_id requis pour une fusion' USING ERRCODE = '22023';
    END IF;

    -- Réoriente toutes les offres du produit en attente vers le produit officiel
    IF v_product_id IS NOT NULL AND v_product_id <> _merge_into_product_id THEN
      UPDATE public.offers
      SET product_id = _merge_into_product_id,
          updated_at = now()
      WHERE product_id = v_product_id;
      GET DIAGNOSTICS v_offers_rerouted = ROW_COUNT;

      -- Archiver le produit doublon
      UPDATE public.products
      SET is_active = false,
          submission_status = 'rejected'::public.submission_status_enum
      WHERE id = v_product_id;
    END IF;

    UPDATE public.product_submissions
    SET status = 'approved'::product_submission_status,
        resulting_product_id = _merge_into_product_id,
        reviewed_by = v_user,
        reviewed_at = now(),
        review_comment = COALESCE(_comment, 'Fusionné avec un produit existant')
    WHERE id = _submission_id;

    v_notif_title := 'Votre proposition « ' || v_product_name || ' » a été fusionnée';
    v_notif_body := 'Nous l''avons rapprochée d''une référence existante du catalogue. Vos offres pointent maintenant vers le produit officiel.';
    v_notif_cta := '/vendor/offers';

  ELSIF _decision = 'reject' THEN
    -- Désactiver les lignes provisoires si elles existent
    IF v_product_id IS NOT NULL THEN
      UPDATE public.products
      SET is_active = false,
          submission_status = 'rejected'::public.submission_status_enum
      WHERE id = v_product_id AND submission_status::text = 'pending_review';
    END IF;
    IF v_brand_id IS NOT NULL THEN
      UPDATE public.brands
      SET is_active = false,
          submission_status = 'rejected'::public.submission_status_enum
      WHERE id = v_brand_id AND submission_status::text = 'pending_review';
    END IF;

    UPDATE public.product_submissions
    SET status = 'rejected'::product_submission_status,
        reviewed_by = v_user,
        reviewed_at = now(),
        review_comment = _comment
    WHERE id = _submission_id;

    v_notif_title := 'Votre proposition « ' || v_product_name || ' » n''a pas été retenue';
    v_notif_body := 'Motif : ' || COALESCE(_comment, 'non précisé');
    v_notif_cta := '/vendor/catalog';

  ELSIF _decision = 'needs_changes' THEN
    UPDATE public.product_submissions
    SET status = 'needs_changes'::product_submission_status,
        reviewed_by = v_user,
        reviewed_at = now(),
        review_comment = _comment
    WHERE id = _submission_id;

    v_notif_title := 'Précisions demandées sur « ' || v_product_name || ' »';
    v_notif_body := COALESCE(_comment, 'Merci de compléter votre proposition.');
    v_notif_cta := '/vendor/catalog';
  END IF;

  -- Notif au vendeur soumissionnaire
  INSERT INTO public.vendor_notifications (vendor_id, type, title, body, payload, cta_url)
  VALUES (
    v_sub.vendor_id,
    CASE _decision
      WHEN 'approve' THEN 'submission.approved'
      WHEN 'merge' THEN 'submission.approved'
      WHEN 'reject' THEN 'submission.rejected'
      WHEN 'needs_changes' THEN 'submission.needs_changes'
    END,
    v_notif_title,
    v_notif_body,
    jsonb_build_object(
      'submission_id', _submission_id,
      'product_id', COALESCE(_merge_into_product_id, v_product_id),
      'product_name', v_product_name,
      'decision', _decision
    ),
    v_notif_cta
  );

  RETURN jsonb_build_object(
    'submission_id', _submission_id,
    'decision', _decision,
    'offers_rerouted', v_offers_rerouted,
    'resulting_product_id', COALESCE(_merge_into_product_id, v_product_id)
  );
END;
$$;

-- 3) Marquer "in_review" rapidement (verrou soft pour éviter doubles traitements)
CREATE OR REPLACE FUNCTION public.admin_claim_product_submission(_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  UPDATE public.product_submissions
  SET status = 'in_review'::product_submission_status,
      reviewed_by = auth.uid()
  WHERE id = _submission_id
    AND status = 'submitted'::product_submission_status;
END;
$$;