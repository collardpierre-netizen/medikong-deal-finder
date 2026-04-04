
-- Create vendor validation status enum
CREATE TYPE public.vendor_validation_status AS ENUM ('pending_review', 'under_review', 'approved', 'rejected');

-- Add new columns to vendors
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS validation_status public.vendor_validation_status DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS validation_notes text,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_by uuid;

-- Set existing vendors as approved
UPDATE public.vendors SET validation_status = 'approved' WHERE is_active = true;
UPDATE public.vendors SET validation_status = 'pending_review' WHERE is_active = false AND validation_status IS NULL;
