-- Index unique case-insensitive sur vendors.email pour empêcher
-- la création concurrente de deux vendeurs avec le même email.
-- Ignorer les NULL et les chaînes vides (vendeurs virtuels sans email).
CREATE UNIQUE INDEX IF NOT EXISTS vendors_email_unique_ci
  ON public.vendors (lower(email))
  WHERE email IS NOT NULL AND email <> '';