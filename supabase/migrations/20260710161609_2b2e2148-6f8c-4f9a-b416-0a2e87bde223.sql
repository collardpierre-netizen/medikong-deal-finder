ALTER PUBLICATION supabase_realtime ADD TABLE public.order_invoices;
ALTER TABLE public.order_invoices REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_lines REPLICA IDENTITY FULL;