-- Fix default filter_mode to 'all' so categories are visible by default
ALTER TABLE public.profiles ALTER COLUMN filter_mode SET DEFAULT 'all';

-- Update existing profiles that have 'filtered' but no profession_type_id (= no real filter configured)
UPDATE public.profiles SET filter_mode = 'all' WHERE filter_mode = 'filtered' AND profession_type_id IS NULL;