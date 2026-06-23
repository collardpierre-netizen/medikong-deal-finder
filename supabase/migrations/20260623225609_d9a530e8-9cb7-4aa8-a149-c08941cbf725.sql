CREATE OR REPLACE FUNCTION public.admin_notifications_get(_id uuid)
RETURNS TABLE(
  id uuid, type text, severity text, title text, body text, cta_url text,
  payload jsonb, source_type text, source_id uuid,
  created_at timestamptz, read_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT n.id, n.type, n.severity, n.title, n.body, n.cta_url, n.payload,
         n.source_type, n.source_id, n.created_at, r.read_at
  FROM public.admin_notifications n
  LEFT JOIN public.admin_notification_reads r
    ON r.notification_id = n.id AND r.admin_user_id = auth.uid()
  WHERE n.id = _id
    AND EXISTS (SELECT 1 FROM public.admin_users
                WHERE user_id = auth.uid() AND is_active = true)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.admin_notifications_get(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_notifications_get(uuid) TO authenticated;