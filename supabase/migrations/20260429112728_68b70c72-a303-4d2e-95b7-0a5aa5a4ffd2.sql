-- 1) Backfill mots-clés FR + NL
WITH classified AS (
  SELECT
    id,
    CASE
      WHEN lower(coalesce(name,'')) ~ '(nutrition|alimentation|alimentaire|aliment|nourriture|repas|boisson|prot[eé]in|complement[s]? alimentaire|compl[eé]ment[s]? alimentaire|m[eé]dicament|medicijn|geneesmiddel|voeding|drink|sondage|enteral|parent[eé]ral|fortimel|ensure|nutricia|resource|nestl[eé]|biscuit|farine|c[eé]r[eé]ale|eau min[eé]rale|tisane|allaitement|lait infantile|lait b[eé]b[eé]|formule b[eé]b[eé]|baby food|infant)' THEN 6
      ELSE 21
    END AS new_rate
  FROM public.categories
  WHERE vat_rate IS NULL
)
UPDATE public.categories c
SET vat_rate = cl.new_rate
FROM classified cl
WHERE c.id = cl.id;

-- 2) Trigger auto-default 21%
CREATE OR REPLACE FUNCTION public.ensure_category_vat_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vat_rate IS NULL THEN
    NEW.vat_rate := 21;
    BEGIN
      INSERT INTO public.audit_logs (action, module, detail)
      VALUES (
        'category_vat_rate_auto_default',
        'categories',
        'Catégorie ' || coalesce(NEW.name, '?') || ' (id=' || NEW.id::text || ') : vat_rate manquant → 21% (BE standard) appliqué automatiquement.'
      );
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_category_vat_rate ON public.categories;
CREATE TRIGGER trg_ensure_category_vat_rate
BEFORE INSERT OR UPDATE OF vat_rate ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.ensure_category_vat_rate();

-- 3) Vue d'audit admin
CREATE OR REPLACE VIEW public.admin_category_vat_audit
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.name,
  c.slug,
  c.vat_rate,
  c.parent_id,
  COALESCE(pcs.product_count, 0) AS product_count,
  EXISTS (
    SELECT 1 FROM public.audit_logs al
    WHERE al.action = 'category_vat_rate_auto_default'
      AND al.detail LIKE '%id=' || c.id::text || '%'
  ) AS was_auto_defaulted
FROM public.categories c
LEFT JOIN (
  SELECT category_id, COUNT(*)::int AS product_count
  FROM public.products
  WHERE is_active = true AND category_id IS NOT NULL
  GROUP BY category_id
) pcs ON pcs.category_id = c.id;

GRANT SELECT ON public.admin_category_vat_audit TO authenticated;