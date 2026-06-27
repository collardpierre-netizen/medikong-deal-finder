-- Extend customer_type enum with full typology (grossiste, médecin, MR/MRS, retail)
ALTER TYPE public.customer_type ADD VALUE IF NOT EXISTS 'wholesaler';
ALTER TYPE public.customer_type ADD VALUE IF NOT EXISTS 'doctor';
ALTER TYPE public.customer_type ADD VALUE IF NOT EXISTS 'nursing_home';
ALTER TYPE public.customer_type ADD VALUE IF NOT EXISTS 'retail';
ALTER TYPE public.customer_type ADD VALUE IF NOT EXISTS 'dentist';
ALTER TYPE public.customer_type ADD VALUE IF NOT EXISTS 'veterinary';