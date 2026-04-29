DO $$
DECLARE
  v_merges jsonb := '[
    {"keep":"fba9be45-7aac-4a13-b37a-7be172428df7","drop":"bb5e8e40-b9fd-44a0-86d8-46ad1d4d4cbd","label":"Apot.Care"},
    {"keep":"b3744118-906e-4260-93ca-07bcbd3fa1bd","drop":"0757c89a-d3c7-4484-9fae-bef57ea22c7d","label":"L''Occitane"},
    {"keep":"83583996-440f-4452-9cf0-5740a7dd7e39","drop":"268873d1-7be3-47f6-8b2d-29e2383e5e99","label":"Phyt''s"}
  ]'::jsonb;
  m jsonb;
  v_keep uuid;
  v_drop uuid;
  v_label text;
  v_moved int;
BEGIN
  FOR m IN SELECT * FROM jsonb_array_elements(v_merges) LOOP
    v_keep  := (m->>'keep')::uuid;
    v_drop  := (m->>'drop')::uuid;
    v_label := m->>'label';

    UPDATE public.products SET brand_id = v_keep WHERE brand_id = v_drop;
    GET DIAGNOSTICS v_moved = ROW_COUNT;

    UPDATE public.products
       SET brand_name = (SELECT name FROM public.brands WHERE id = v_keep)
     WHERE brand_id = v_keep
       AND brand_name IS DISTINCT FROM (SELECT name FROM public.brands WHERE id = v_keep);

    INSERT INTO public.audit_logs (action, module, detail)
    VALUES (
      'brand_merge',
      'brands',
      format(
        'Fusion marque "%s" : %s produits réassignés de %s vers %s',
        v_label, v_moved, v_drop, v_keep
      )
    );

    DELETE FROM public.brands WHERE id = v_drop;
  END LOOP;
END $$;

UPDATE public.manufacturers
   SET is_active = false,
       updated_at = now()
 WHERE id = 'd1dd4d36-5a36-41d3-919a-341036700d20'
   AND NOT EXISTS (
     SELECT 1 FROM public.brands WHERE manufacturer_id = 'd1dd4d36-5a36-41d3-919a-341036700d20'
   );

INSERT INTO public.audit_logs (action, module, detail)
SELECT
  'manufacturer_deprecated',
  'brands',
  'Fabricant "Fresubin (déprécié)" désactivé — la marque Fresubin pointe désormais vers Fresenius Kabi.'
WHERE EXISTS (
  SELECT 1 FROM public.manufacturers
  WHERE id = 'd1dd4d36-5a36-41d3-919a-341036700d20' AND is_active = false
);

SELECT public.resolve_product_brands();
