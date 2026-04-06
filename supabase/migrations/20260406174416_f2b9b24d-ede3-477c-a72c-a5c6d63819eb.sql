
-- Fix qogita_config: remove anon write, add admin/service
DROP POLICY IF EXISTS "Allow anon insert qogita_config" ON public.qogita_config;
DROP POLICY IF EXISTS "Allow anon update qogita_config" ON public.qogita_config;

CREATE POLICY "Admins manage qogita_config"
  ON public.qogita_config FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Service role manages qogita_config"
  ON public.qogita_config FOR ALL TO public
  USING (auth.role() = 'service_role');
