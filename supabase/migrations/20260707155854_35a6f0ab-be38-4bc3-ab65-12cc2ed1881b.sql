CREATE OR REPLACE FUNCTION public.admin_list_order_delivery_confirmation_test_emails(_order_id uuid)
RETURNS TABLE (
  message_id text,
  recipient_email text,
  status text,
  error_message text,
  last_event_at timestamptz,
  is_test boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (message_id)
      message_id,
      recipient_email,
      status,
      error_message,
      created_at AS last_event_at,
      (message_id LIKE 'order-delivery-confirmation-test-' || _order_id::text || '-%') AS is_test
    FROM public.email_send_log
    WHERE template_name = 'order-delivery-confirmation'
      AND message_id IS NOT NULL
      AND (
        message_id = 'order-delivery-confirmation-' || _order_id::text
        OR message_id LIKE 'order-delivery-confirmation-test-' || _order_id::text || '-%'
      )
      AND public.is_admin(auth.uid())
    ORDER BY message_id, created_at DESC
  )
  SELECT message_id, recipient_email, status, error_message, last_event_at, is_test
  FROM latest
  ORDER BY last_event_at DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_order_delivery_confirmation_test_emails(uuid) TO authenticated;