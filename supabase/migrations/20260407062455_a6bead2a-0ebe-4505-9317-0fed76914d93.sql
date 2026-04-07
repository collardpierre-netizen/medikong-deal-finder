
-- Add 'forwarded' to fulfillment_status enum
ALTER TYPE public.fulfillment_status ADD VALUE IF NOT EXISTS 'forwarded' AFTER 'processing';
