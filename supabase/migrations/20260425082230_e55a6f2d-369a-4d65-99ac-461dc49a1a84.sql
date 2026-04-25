-- Ajout du statut de disponibilité pour les délégués vendeurs
DO $$ BEGIN
  CREATE TYPE public.delegate_availability AS ENUM (
    'available',     -- Disponible
    'busy',          -- Occupé (réponse possible mais différée)
    'in_meeting',    -- En rendez-vous
    'on_leave',      -- En congé / absent
    'unavailable'    -- Indisponible (urgence uniquement)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.vendor_delegates
  ADD COLUMN IF NOT EXISTS availability_status public.delegate_availability NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS availability_message text,
  ADD COLUMN IF NOT EXISTS availability_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_vendor_delegates_availability
  ON public.vendor_delegates (vendor_id, availability_status)
  WHERE is_active = true;