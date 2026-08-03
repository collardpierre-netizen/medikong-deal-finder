INSERT INTO public.qogita_config (key, value, updated_at)
VALUES ('price_writes_enabled', 'false', now())
ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = now();