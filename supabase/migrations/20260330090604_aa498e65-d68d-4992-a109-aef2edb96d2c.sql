ALTER TABLE public.qogita_config 
ADD COLUMN IF NOT EXISTS qogita_email text,
ADD COLUMN IF NOT EXISTS qogita_password text;