CREATE OR REPLACE FUNCTION public.create_admin_notification(
  _type text,
  _severity text,
  _title text,
  _body text,
  _cta_url text,
  _source_type text,
  _source_id uuid,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.admin_notifications
    (type, severity, title, body, cta_url, source_type, source_id, payload)
  VALUES (_type, _severity, _title, _body, _cta_url, _source_type, _source_id, COALESCE(_payload, '{}'::jsonb))
  ON CONFLICT DO NOTHING;
END;
$function$;