DROP POLICY IF EXISTS "Service role writes import logs" ON public.external_offers_import_logs;

CREATE POLICY "Service role writes import logs"
ON public.external_offers_import_logs
FOR INSERT
TO service_role
WITH CHECK (true);