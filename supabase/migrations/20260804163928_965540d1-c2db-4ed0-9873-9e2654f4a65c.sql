-- ============ LOT 3 : catégories, top produits, tendances, création manuelle admin ============

-- 1. Colonnes analyses
ALTER TABLE public.savings_simulations
  ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'public_tunnel',
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_trend_ref_analysis_id uuid REFERENCES public.savings_simulations(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.savings_simulations
    ADD CONSTRAINT savings_simulations_created_via_check
    CHECK (created_via IN ('public_tunnel','admin_manual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.savings_simulations DROP CONSTRAINT IF EXISTS savings_simulations_status_check;
ALTER TABLE public.savings_simulations
  ADD CONSTRAINT savings_simulations_status_check
  CHECK (status IN ('processing','done','failed','no_match','ready_to_send','sent'));

-- 2. Catégorie sur les lignes
ALTER TABLE public.savings_simulation_lines
  ADD COLUMN IF NOT EXISTS product_category text
    REFERENCES public.product_eligibility_categories(code) ON DELETE SET NULL;

-- 3. Référentiel CNK -> catégorie (chargeable une fois, pas recalculé)
CREATE TABLE IF NOT EXISTS public.cnk_category_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnk_code text,
  cnk_prefix text,
  category text NOT NULL REFERENCES public.product_eligibility_categories(code) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cnk_category_mapping_key_chk CHECK (cnk_code IS NOT NULL OR cnk_prefix IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS cnk_category_mapping_code_uk ON public.cnk_category_mapping (cnk_code) WHERE cnk_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cnk_category_mapping_prefix_uk ON public.cnk_category_mapping (cnk_prefix) WHERE cnk_prefix IS NOT NULL;

GRANT SELECT ON public.cnk_category_mapping TO anon, authenticated;
GRANT ALL ON public.cnk_category_mapping TO service_role;
ALTER TABLE public.cnk_category_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cnk_category_mapping public read" ON public.cnk_category_mapping;
CREATE POLICY "cnk_category_mapping public read" ON public.cnk_category_mapping
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "cnk_category_mapping admin write" ON public.cnk_category_mapping;
CREATE POLICY "cnk_category_mapping admin write" ON public.cnk_category_mapping
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_cnk_category_mapping_updated_at
  BEFORE UPDATE ON public.cnk_category_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Résolution de catégorie : CNK exact > préfixe CNK > heuristique libellé > non classé
CREATE OR REPLACE FUNCTION public.resolve_savings_line_category(_cnk text, _name text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cnk text := nullif(regexp_replace(coalesce(_cnk,''), '\D', '', 'g'), '');
  v_name text := lower(coalesce(_name, ''));
  v_cat text;
BEGIN
  IF v_cnk IS NOT NULL THEN
    SELECT category INTO v_cat FROM public.cnk_category_mapping
      WHERE cnk_code = v_cnk LIMIT 1;
    IF v_cat IS NOT NULL THEN RETURN v_cat; END IF;

    SELECT category INTO v_cat FROM public.cnk_category_mapping
      WHERE cnk_prefix IS NOT NULL AND v_cnk LIKE cnk_prefix || '%'
      ORDER BY length(cnk_prefix) DESC LIMIT 1;
    IF v_cat IS NOT NULL THEN RETURN v_cat; END IF;
  END IF;

  IF v_name = '' THEN RETURN 'unknown_needs_review'; END IF;

  IF v_name ~ '(fresubin|nutridrink|nutrison|renutryl|fortimel|delical|resource|nutricia|sonde nutri)' THEN
    RETURN 'eligible_nutrition';
  END IF;
  IF v_name ~ '(vitamin|vitamine|magnes|omega|probio|zinc|calcium|fer |ferro|complement|supradyn|bion 3|d-cure|omnibionta|gummies|collagen)' THEN
    RETURN 'eligible_supplement';
  END IF;
  IF v_name ~ '(compeed|pansement|bandage|seringue|aiguille|thermomet|tensiomet|masque|gant |gants|comprese|compresse|coton|sparadrap|attelle|bas de contention|test antig|autotest|lancette|glucomet|canule|cathet|sonde|urin|stomie|inhalateur|nebulis)' THEN
    RETURN 'eligible_device_low_class';
  END IF;
  IF v_name ~ '(avene|aveene|ducray|eucerin|la roche|roche-posay|bioderma|cerave|nuxe|mustela|vichy|svr |a-derma|aderma|uriage|caudalie|filorga|klorane|lierac|topicrem|weleda|dermalex|creme|crème|shampo|shampoo|gel douche|deodorant|solaire|spf|lipikar|cicaplast|effaclar|xeracalm|trixera|dentifrice|parodontax|elmex|sensodyne)' THEN
    RETURN 'eligible_cosmetic';
  END IF;
  IF v_name ~ '(dafalgan|paraceta|ibupro|nurofen|perdolan|aspirin|voltaren|strepsil|lysopaine|imodium|motilium|dulcolax|nasal|rhino|toux|sirop|pastille|maalox|gaviscon|zyrtec|cetiriz|loratad|otrivine|physiomer|sterimar|bepanthen|hansaplast|arnica|homeo|smecta|movicol|forlax|microlax|laxat)' THEN
    RETURN 'eligible_otc';
  END IF;

  RETURN 'unknown_needs_review';
END;
$$;

-- 5. Trigger d'affectation à l'insertion / mise à jour du CNK ou du libellé
CREATE OR REPLACE FUNCTION public._savings_line_set_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.product_category IS NULL THEN
    NEW.product_category := public.resolve_savings_line_category(NEW.detected_cnk, coalesce(NEW.detected_name, NEW.raw_text));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_savings_line_set_category ON public.savings_simulation_lines;
CREATE TRIGGER trg_savings_line_set_category
  BEFORE INSERT ON public.savings_simulation_lines
  FOR EACH ROW EXECUTE FUNCTION public._savings_line_set_category();

-- Backfill existant
UPDATE public.savings_simulation_lines
SET product_category = public.resolve_savings_line_category(detected_cnk, coalesce(detected_name, raw_text))
WHERE product_category IS NULL;

-- 6. Libellé de regroupement rapport
CREATE OR REPLACE FUNCTION public.savings_category_group_label(_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _code IN ('excluded_rx','excluded_narcotic') THEN 'Médicaments sur ordonnance (Rx)'
    WHEN _code = 'eligible_otc' THEN 'OTC'
    WHEN _code IN ('eligible_device_low_class','excluded_device_high_class') THEN 'Dispositifs médicaux'
    WHEN _code = 'eligible_cosmetic' THEN 'Parapharmacie / Cosmétique'
    WHEN _code IN ('eligible_supplement','eligible_nutrition') THEN 'Nutrition / Compléments'
    ELSE 'Autre / Non classé'
  END;
$$;

-- 7. Contrôle d'accès à une analyse
CREATE OR REPLACE FUNCTION public.savings_can_access(_simulation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.savings_simulations s
    WHERE s.id = _simulation_id
      AND (
        public.is_admin(auth.uid())
        OR (s.user_id IS NOT NULL AND s.user_id = auth.uid())
        OR (s.email IS NOT NULL AND lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      )
  );
$$;

-- 8. Ventilation par catégorie d'une analyse (100% des lignes lues)
CREATE OR REPLACE FUNCTION public.savings_category_breakdown(_simulation_id uuid)
RETURNS TABLE (
  group_label text,
  lines_count integer,
  total_amount numeric,
  pct_of_basket numeric,
  matched_lines integer,
  catalog_match_rate numeric,
  total_savings numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH l AS (
    SELECT
      public.savings_category_group_label(product_category) AS grp,
      coalesce(detected_unit_price_excl_vat, 0) * coalesce(detected_quantity, 1) AS amount,
      (medikong_min_price_excl_vat IS NOT NULL) AS is_matched,
      coalesce(line_savings, 0) AS savings
    FROM public.savings_simulation_lines
    WHERE simulation_id = _simulation_id
      AND public.savings_can_access(_simulation_id)
  ), tot AS (SELECT sum(amount) AS t FROM l)
  SELECT
    l.grp,
    count(*)::int,
    round(sum(l.amount)::numeric, 2),
    CASE WHEN (SELECT t FROM tot) > 0 THEN round((sum(l.amount) / (SELECT t FROM tot) * 100)::numeric, 1) ELSE 0 END,
    count(*) FILTER (WHERE l.is_matched)::int,
    round((count(*) FILTER (WHERE l.is_matched)::numeric / count(*)::numeric * 100), 1),
    round(sum(l.savings)::numeric, 2)
  FROM l
  GROUP BY l.grp
  ORDER BY sum(l.amount) DESC;
$$;

-- 9. Clé de regroupement pharmacie (même logique que admin_savings_by_pharmacy)
CREATE OR REPLACE FUNCTION public.savings_group_key(_pharmacy_name text, _email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(nullif(btrim(_pharmacy_name), ''), lower(coalesce(_email, 'inconnu')));
$$;

-- 10. Ventilation par catégorie d'une pharmacie (toutes ses analyses)
CREATE OR REPLACE FUNCTION public.savings_pharmacy_category_breakdown(_group_key text DEFAULT NULL)
RETURNS TABLE (
  group_label text,
  lines_count integer,
  total_amount numeric,
  pct_of_basket numeric,
  matched_lines integer,
  catalog_match_rate numeric,
  total_savings numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sims AS (
    SELECT s.id
    FROM public.savings_simulations s
    WHERE (
        public.is_admin(auth.uid())
        OR (s.user_id IS NOT NULL AND s.user_id = auth.uid())
        OR (s.email IS NOT NULL AND lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      )
      AND (_group_key IS NULL OR public.savings_group_key(s.pharmacy_name, s.email) = _group_key)
  ), l AS (
    SELECT
      public.savings_category_group_label(sl.product_category) AS grp,
      coalesce(sl.detected_unit_price_excl_vat, 0) * coalesce(sl.detected_quantity, 1) AS amount,
      (sl.medikong_min_price_excl_vat IS NOT NULL) AS is_matched,
      coalesce(sl.line_savings, 0) AS savings
    FROM public.savings_simulation_lines sl
    JOIN sims ON sims.id = sl.simulation_id
  ), tot AS (SELECT sum(amount) AS t FROM l)
  SELECT
    l.grp,
    count(*)::int,
    round(sum(l.amount)::numeric, 2),
    CASE WHEN (SELECT t FROM tot) > 0 THEN round((sum(l.amount) / (SELECT t FROM tot) * 100)::numeric, 1) ELSE 0 END,
    count(*) FILTER (WHERE l.is_matched)::int,
    round((count(*) FILTER (WHERE l.is_matched)::numeric / count(*)::numeric * 100), 1),
    round(sum(l.savings)::numeric, 2)
  FROM l
  GROUP BY l.grp
  ORDER BY sum(l.amount) DESC;
$$;

-- 11. Top produits agrégés + tendance de prix
CREATE OR REPLACE FUNCTION public.savings_top_products(_group_key text DEFAULT NULL, _limit integer DEFAULT 50)
RETURNS TABLE (
  cnk text,
  product_name text,
  group_label text,
  total_quantity numeric,
  analyses_count integer,
  total_amount numeric,
  total_savings numeric,
  first_price numeric,
  last_price numeric,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  price_trend_pct numeric,
  price_trend text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sims AS (
    SELECT s.id, s.created_at
    FROM public.savings_simulations s
    WHERE (
        public.is_admin(auth.uid())
        OR (s.user_id IS NOT NULL AND s.user_id = auth.uid())
        OR (s.email IS NOT NULL AND lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      )
      AND (_group_key IS NULL OR public.savings_group_key(s.pharmacy_name, s.email) = _group_key)
  ), l AS (
    SELECT
      coalesce(nullif(regexp_replace(coalesce(sl.detected_cnk,''), '\D', '', 'g'), ''),
               'name:' || lower(coalesce(sl.detected_name, sl.raw_text, 'inconnu'))) AS key,
      nullif(regexp_replace(coalesce(sl.detected_cnk,''), '\D', '', 'g'), '') AS cnk,
      coalesce(sl.detected_name, sl.raw_text) AS nm,
      public.savings_category_group_label(sl.product_category) AS grp,
      coalesce(sl.detected_quantity, 1)::numeric AS qty,
      coalesce(sl.detected_unit_price_excl_vat, 0) AS unit_price,
      coalesce(sl.detected_unit_price_excl_vat, 0) * coalesce(sl.detected_quantity, 1) AS amount,
      coalesce(sl.line_savings, 0) AS savings,
      sims.created_at AS at,
      sims.id AS sim_id
    FROM public.savings_simulation_lines sl
    JOIN sims ON sims.id = sl.simulation_id
  )
  SELECT
    (array_agg(l.cnk ORDER BY l.at DESC))[1],
    (array_agg(l.nm ORDER BY l.at DESC))[1],
    (array_agg(l.grp ORDER BY l.at DESC))[1],
    sum(l.qty),
    count(DISTINCT l.sim_id)::int,
    round(sum(l.amount)::numeric, 2),
    round(sum(l.savings)::numeric, 2),
    round(((array_agg(l.unit_price ORDER BY l.at ASC))[1])::numeric, 4),
    round(((array_agg(l.unit_price ORDER BY l.at DESC))[1])::numeric, 4),
    min(l.at),
    max(l.at),
    CASE
      WHEN count(DISTINCT l.sim_id) < 2 OR (array_agg(l.unit_price ORDER BY l.at ASC))[1] <= 0 THEN NULL
      ELSE round(((((array_agg(l.unit_price ORDER BY l.at DESC))[1] - (array_agg(l.unit_price ORDER BY l.at ASC))[1])
            / (array_agg(l.unit_price ORDER BY l.at ASC))[1]) * 100)::numeric, 1)
    END,
    CASE
      WHEN count(DISTINCT l.sim_id) < 2 OR (array_agg(l.unit_price ORDER BY l.at ASC))[1] <= 0 THEN NULL
      WHEN abs((((array_agg(l.unit_price ORDER BY l.at DESC))[1] - (array_agg(l.unit_price ORDER BY l.at ASC))[1])
            / (array_agg(l.unit_price ORDER BY l.at ASC))[1]) * 100) <= 2 THEN 'stable'
      WHEN (array_agg(l.unit_price ORDER BY l.at DESC))[1] > (array_agg(l.unit_price ORDER BY l.at ASC))[1] THEN 'up'
      ELSE 'down'
    END
  FROM l
  GROUP BY l.key
  ORDER BY sum(l.amount) DESC
  LIMIT greatest(1, least(coalesce(_limit, 50), 500));
$$;

-- 12. Marquage envoi au client (admin)
CREATE OR REPLACE FUNCTION public.admin_savings_mark_sent(_simulation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.savings_simulations
  SET status = 'sent', sent_at = now(), updated_at = now()
  WHERE id = _simulation_id
    AND status IN ('done','ready_to_send','sent');
END;
$$;
