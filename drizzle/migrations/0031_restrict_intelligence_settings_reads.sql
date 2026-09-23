DROP POLICY IF EXISTS "intel settings read authenticated" ON public.intelligence_module_settings;
DROP POLICY IF EXISTS "intel tab flags read authenticated" ON public.intelligence_module_tab_flags;
DROP POLICY IF EXISTS "intel bundle read authenticated" ON public.intelligence_bundle_settings;

CREATE OR REPLACE FUNCTION public.get_intelligence_module_public(_module public.intelligence_module)
RETURNS TABLE(module public.intelligence_module, is_enabled boolean, default_trial_days integer, metric_kind text, label text, description text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT module, is_enabled, default_trial_days, metric_kind, label, description
  FROM public.intelligence_module_settings WHERE module = _module AND auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.get_intelligence_tab_flags_public(_module public.intelligence_module)
RETURNS TABLE(id uuid, module public.intelligence_module, tab_key text, label text, is_free boolean, sort_order integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, module, tab_key, label, is_free, sort_order
  FROM public.intelligence_module_tab_flags WHERE module = _module AND auth.uid() IS NOT NULL
  ORDER BY sort_order
$$;

REVOKE ALL ON FUNCTION public.get_intelligence_module_public(public.intelligence_module) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_intelligence_tab_flags_public(public.intelligence_module) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_intelligence_module_public(public.intelligence_module) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_intelligence_tab_flags_public(public.intelligence_module) TO authenticated;