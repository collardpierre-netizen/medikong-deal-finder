-- Suivi des notifications déjà envoyées pour éviter les doublons
CREATE TABLE IF NOT EXISTS public.vendor_notification_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  source_type text NOT NULL,        -- 'product' | 'brand' | 'manufacturer'
  source_id uuid NOT NULL,
  interest_id uuid REFERENCES public.vendor_catalog_interests(id) ON DELETE SET NULL,
  notification_id uuid REFERENCES public.vendor_notifications(id) ON DELETE SET NULL,
  dispatched_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vndl_vendor_source
  ON public.vendor_notification_dispatch_log(vendor_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_vndl_vendor ON public.vendor_notification_dispatch_log(vendor_id);

ALTER TABLE public.vendor_notification_dispatch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vndl_admin_all" ON public.vendor_notification_dispatch_log;
CREATE POLICY "vndl_admin_all"
  ON public.vendor_notification_dispatch_log FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "vndl_vendor_select_own" ON public.vendor_notification_dispatch_log;
CREATE POLICY "vndl_vendor_select_own"
  ON public.vendor_notification_dispatch_log FOR SELECT
  TO authenticated
  USING (vendor_id = public.current_vendor_id());
