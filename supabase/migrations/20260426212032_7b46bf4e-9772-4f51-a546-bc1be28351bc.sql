ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_price_alert_events;
ALTER TABLE public.vendor_price_alert_events REPLICA IDENTITY FULL;