-- 0. Add enum value (must commit before being usable)
ALTER TYPE public.sync_type_enum ADD VALUE IF NOT EXISTS 'vendor_top_brands_mv';