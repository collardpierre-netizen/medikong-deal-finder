-- RPC sécurisé pour soumettre un avis marque (initials, ville, orders_count calculés côté serveur)
CREATE OR REPLACE FUNCTION public.submit_brand_review(
  _brand_id uuid,
  _rating_quality integer,
  _rating_delivery integer,
  _rating_support integer,
  _rating_documentation integer,
  _rating_margin integer,
  _comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_brand_slug text;
  v_full_name text;
  v_initials text;
  v_city text;
  v_orders_count integer := 0;
  v_review_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté pour donner un avis.' USING ERRCODE = '42501';
  END IF;

  -- Validation bornes 1..5
  IF _rating_quality NOT BETWEEN 1 AND 5
     OR _rating_delivery NOT BETWEEN 1 AND 5
     OR _rating_support NOT BETWEEN 1 AND 5
     OR _rating_documentation NOT BETWEEN 1 AND 5
     OR _rating_margin NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Toutes les notes doivent être comprises entre 1 et 5.' USING ERRCODE = '22023';
  END IF;

  -- Validation commentaire (optionnel mais borné)
  IF _comment IS NOT NULL AND length(btrim(_comment)) > 1000 THEN
    RAISE EXCEPTION 'Commentaire trop long (1000 caractères max).' USING ERRCODE = '22023';
  END IF;

  -- Vérifie marque existe + slug
  SELECT slug INTO v_brand_slug FROM public.brands WHERE id = _brand_id;
  IF v_brand_slug IS NULL THEN
    RAISE EXCEPTION 'Marque introuvable.' USING ERRCODE = '22023';
  END IF;

  -- Vérifie acheteur vérifié ayant commandé cette marque
  IF NOT public.user_has_ordered_brand(v_user, _brand_id) THEN
    RAISE EXCEPTION 'Seuls les acheteurs ayant déjà commandé cette marque peuvent laisser un avis.' USING ERRCODE = '42501';
  END IF;

  -- Calcul initials depuis profile (fallback "—")
  SELECT COALESCE(NULLIF(btrim(full_name), ''), '')
  INTO v_full_name
  FROM public.profiles
  WHERE user_id = v_user;

  IF v_full_name IS NULL OR v_full_name = '' THEN
    v_initials := '—';
  ELSE
    v_initials := upper(
      substr(split_part(v_full_name, ' ', 1), 1, 1) ||
      COALESCE(NULLIF(substr(split_part(v_full_name, ' ', 2), 1, 1), ''), '')
    );
    IF v_initials = '' THEN v_initials := '—'; END IF;
  END IF;

  -- Ville depuis customers (best effort)
  BEGIN
    SELECT NULLIF(btrim(c.city), '')
    INTO v_city
    FROM public.customers c
    WHERE c.auth_user_id = v_user
    ORDER BY c.created_at DESC
    LIMIT 1;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    v_city := NULL;
  END;

  -- Compte de commandes pour la marque (best effort, ne bloque pas)
  BEGIN
    SELECT COUNT(DISTINCT o.id)
    INTO v_orders_count
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.customers c ON c.id = o.customer_id
    WHERE c.auth_user_id = v_user
      AND p.brand_id = _brand_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    v_orders_count := 1;
  END;

  -- Upsert : un seul avis par (brand, user)
  INSERT INTO public.brand_reviews (
    brand_id, brand_slug, reviewer_user_id, reviewer_initials, reviewer_city,
    verified_buyer_orders_count,
    rating_quality, rating_delivery, rating_support, rating_documentation, rating_margin,
    comment, is_published
  ) VALUES (
    _brand_id, v_brand_slug, v_user, v_initials, v_city,
    GREATEST(v_orders_count, 1),
    _rating_quality, _rating_delivery, _rating_support, _rating_documentation, _rating_margin,
    NULLIF(btrim(_comment), ''),
    true
  )
  ON CONFLICT (brand_id, reviewer_user_id)
  DO UPDATE SET
    rating_quality = EXCLUDED.rating_quality,
    rating_delivery = EXCLUDED.rating_delivery,
    rating_support = EXCLUDED.rating_support,
    rating_documentation = EXCLUDED.rating_documentation,
    rating_margin = EXCLUDED.rating_margin,
    comment = EXCLUDED.comment,
    reviewer_initials = EXCLUDED.reviewer_initials,
    reviewer_city = EXCLUDED.reviewer_city,
    verified_buyer_orders_count = EXCLUDED.verified_buyer_orders_count,
    updated_at = now()
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_brand_review(uuid,integer,integer,integer,integer,integer,text) TO authenticated;