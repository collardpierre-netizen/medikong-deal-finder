UPDATE public.qogita_config SET value = 'true', updated_at = now() WHERE key = 'price_writes_enabled';
INSERT INTO public.qogita_config (key, value)
SELECT 'price_writes_enabled', 'true'
WHERE NOT EXISTS (SELECT 1 FROM public.qogita_config WHERE key = 'price_writes_enabled');