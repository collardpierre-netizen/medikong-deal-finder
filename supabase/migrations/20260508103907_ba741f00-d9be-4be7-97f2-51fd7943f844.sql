CREATE TABLE IF NOT EXISTS public.category_llm_mapping_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qogita_category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  qogita_name text NOT NULL,
  products_count integer NOT NULL DEFAULT 0,
  suggested_mk_slug text,
  suggested_mk_category_id uuid REFERENCES public.categories(id),
  confidence numeric(4,3),
  reason text,
  raw_response jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied')),
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash-lite',
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  applied_by uuid REFERENCES auth.users(id),
  UNIQUE (qogita_category_id)
);

CREATE INDEX IF NOT EXISTS idx_clmp_status ON public.category_llm_mapping_proposals(status);
CREATE INDEX IF NOT EXISTS idx_clmp_confidence ON public.category_llm_mapping_proposals(confidence DESC);

ALTER TABLE public.category_llm_mapping_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read clmp"
  ON public.category_llm_mapping_proposals FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins write clmp"
  ON public.category_llm_mapping_proposals FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_qogita_llm_mapping(_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal record;
  v_qogita_name text;
  v_updated integer := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_proposal
  FROM public.category_llm_mapping_proposals
  WHERE id = _proposal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal not found';
  END IF;

  IF v_proposal.suggested_mk_category_id IS NULL THEN
    RAISE EXCEPTION 'no suggested target';
  END IF;

  SELECT name INTO v_qogita_name FROM public.categories WHERE id = v_proposal.qogita_category_id;

  INSERT INTO public.category_source_aliases (source_path, source_locale, category_id, notes)
  VALUES (v_qogita_name, 'en', v_proposal.suggested_mk_category_id, 'auto:llm-v1')
  ON CONFLICT (source_path, source_locale) DO UPDATE
    SET category_id = EXCLUDED.category_id,
        notes = 'auto:llm-v1';

  UPDATE public.products
     SET primary_category_id = v_proposal.suggested_mk_category_id
   WHERE category_id = v_proposal.qogita_category_id
     AND (primary_category_id IS DISTINCT FROM v_proposal.suggested_mk_category_id);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE public.category_llm_mapping_proposals
     SET status = 'applied',
         applied_at = now(),
         applied_by = auth.uid()
   WHERE id = _proposal_id;

  RETURN jsonb_build_object(
    'proposal_id', _proposal_id,
    'products_updated', v_updated,
    'mk_category_id', v_proposal.suggested_mk_category_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_qogita_llm_mapping(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_qogita_llm_mapping(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_qogita_llm_mappings_bulk(_min_confidence numeric DEFAULT 0.75)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal record;
  v_total_proposals integer := 0;
  v_total_products integer := 0;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  FOR v_proposal IN
    SELECT id FROM public.category_llm_mapping_proposals
    WHERE status = 'pending'
      AND suggested_mk_category_id IS NOT NULL
      AND confidence >= _min_confidence
  LOOP
    v_result := public.apply_qogita_llm_mapping(v_proposal.id);
    v_total_proposals := v_total_proposals + 1;
    v_total_products := v_total_products + COALESCE((v_result->>'products_updated')::int, 0);
  END LOOP;

  RETURN jsonb_build_object(
    'proposals_applied', v_total_proposals,
    'products_updated', v_total_products,
    'min_confidence', _min_confidence
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_qogita_llm_mappings_bulk(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_qogita_llm_mappings_bulk(numeric) TO authenticated;