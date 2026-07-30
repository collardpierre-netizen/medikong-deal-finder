CREATE OR REPLACE FUNCTION public.admin_review_product_submission(
  _submission_id uuid,
  _decision text,
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
  v_product_created boolean := false;
  v_gtin text;
  v_cnk text;
  v_brand_name text;
  v_manufacturer_name text;
  v_base_slug text;
  v_slug text;
  v_i int := 0;
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

  v_product_id := v_sub.resulting_product_id;
  v_brand_id := v_sub.resulting_brand_id;
  v_manufacturer_id := v_sub.resulting_manufacturer_id;

  IF _decision = 'approve' THEN
    -- Création automatique du produit si la soumission n'est liée à aucune fiche
    IF v_product_id IS NULL THEN
      v_gtin := NULLIF(regexp_replace(COALESCE(v_payload->>'gtin', ''), '\D', '', 'g'), '');
      v_cnk := NULLIF(regexp_replace(COALESCE(v_payload->>'cnk_code', ''), '\D', '', 'g'), '');
      v_brand_name := NULLIF(btrim(COALESCE(v_payload->>'brand_name', v_payload->>'brand', '')), '');
      v_manufacturer_name := NULLIF(btrim(COALESCE(v_payload->>'manufacturer_name', v_payload->>'manufacturer', '')), '');

      -- Rattachement à un produit existant portant le même code
      IF v_gtin IS NOT NULL THEN
        SELECT id INTO v_product_id FROM public.products
        WHERE regexp_replace(COALESCE(gtin,''), '\D', '', 'g') = v_gtin
        ORDER BY created_at LIMIT 1;
      END IF;
      IF v_product_id IS NULL AND v_cnk IS NOT NULL THEN
        SELECT id INTO v_product_id FROM public.products
        WHERE regexp_replace(COALESCE(cnk_code,''), '\D', '', 'g') = v_cnk
        ORDER BY created_at LIMIT 1;
      END IF;

      IF v_product_id IS NULL THEN
        -- Marque : réutilisation ou création
        IF v_brand_id IS NULL AND v_brand_name IS NOT NULL THEN
          SELECT id INTO v_brand_id FROM public.brands
          WHERE lower(btrim(name)) = lower(v_brand_name)
          ORDER BY created_at LIMIT 1;

          IF v_brand_id IS NULL THEN
            v_base_slug := NULLIF(regexp_replace(lower(v_brand_name), '[^a-z0-9]+', '-', 'g'), '');
            v_base_slug := btrim(COALESCE(v_base_slug, 'marque'), '-');
            v_slug := v_base_slug;
            v_i := 0;
            WHILE EXISTS (SELECT 1 FROM public.brands WHERE slug = v_slug) LOOP
              v_i := v_i + 1;
              v_slug := v_base_slug || '-' || v_i::text;
            END LOOP;

            INSERT INTO public.brands (name, slug, is_active, proposed_by_vendor_id)
            VALUES (v_brand_name, v_slug, true, v_sub.vendor_id)
            RETURNING id INTO v_brand_id;
          END IF;
        END IF;

        -- Fabricant : réutilisation ou création
        IF v_manufacturer_id IS NULL AND v_manufacturer_name IS NOT NULL THEN
          SELECT id INTO v_manufacturer_id FROM public.manufacturers
          WHERE lower(btrim(name)) = lower(v_manufacturer_name)
          ORDER BY created_at LIMIT 1;

          IF v_manufacturer_id IS NULL THEN
            v_base_slug := NULLIF(regexp_replace(lower(v_manufacturer_name), '[^a-z0-9]+', '-', 'g'), '');
            v_base_slug := btrim(COALESCE(v_base_slug, 'fabricant'), '-');
            v_slug := v_base_slug;
            v_i := 0;
            WHILE EXISTS (SELECT 1 FROM public.manufacturers WHERE slug = v_slug) LOOP
              v_i := v_i + 1;
              v_slug := v_base_slug || '-' || v_i::text;
            END LOOP;

            INSERT INTO public.manufacturers (name, slug, is_active, proposed_by_vendor_id)
            VALUES (v_manufacturer_name, v_slug, true, v_sub.vendor_id)
            RETURNING id INTO v_manufacturer_id;
          END IF;
        END IF;

        -- Slug produit unique
        v_base_slug := NULLIF(regexp_replace(lower(v_product_name), '[^a-z0-9]+', '-', 'g'), '');
        v_base_slug := btrim(COALESCE(v_base_slug, 'produit'), '-');
        IF v_gtin IS NOT NULL THEN
          v_base_slug := v_base_slug || '-' || v_gtin;
        ELSIF v_cnk IS NOT NULL THEN
          v_base_slug := v_base_slug || '-' || v_cnk;
        END IF;
        v_slug := v_base_slug;
        v_i := 0;
        WHILE EXISTS (SELECT 1 FROM public.products WHERE slug = v_slug) LOOP
          v_i := v_i + 1;
          v_slug := v_base_slug || '-' || v_i::text;
        END LOOP;

        INSERT INTO public.products (
          name, slug, gtin, cnk_code, brand_id, brand_name, manufacturer_id,
          source, is_active, proposed_by_vendor_id
        )
        VALUES (
          v_product_name, v_slug, v_gtin, v_cnk, v_brand_id, v_brand_name, v_manufacturer_id,
          'vendor'::public.product_source, true, v_sub.vendor_id
        )
        RETURNING id INTO v_product_id;

        v_product_created := true;
      END IF;
    END IF;

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
        resulting_product_id = COALESCE(resulting_product_id, v_product_id),
        resulting_brand_id = COALESCE(resulting_brand_id, v_brand_id),
        resulting_manufacturer_id = COALESCE(resulting_manufacturer_id, v_manufacturer_id),
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

    IF v_product_id IS NOT NULL AND v_product_id <> _merge_into_product_id THEN
      UPDATE public.offers
      SET product_id = _merge_into_product_id,
          updated_at = now()
      WHERE product_id = v_product_id;
      GET DIAGNOSTICS v_offers_rerouted = ROW_COUNT;

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
      'decision', _decision,
      'product_created', v_product_created
    ),
    v_notif_cta
  );

  RETURN jsonb_build_object(
    'submission_id', _submission_id,
    'decision', _decision,
    'offers_rerouted', v_offers_rerouted,
    'product_created', v_product_created,
    'resulting_product_id', COALESCE(_merge_into_product_id, v_product_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_review_product_submission(uuid, text, text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_review_product_submission(uuid, text, text, uuid) TO authenticated;