-- Phase 1 — Autoriser plusieurs customers avec le même email
-- Unicité déplacée sur (lower(email), country_code, coalesce(vat_number,''))

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_email_key;

-- Index d'unicité composite (permet doublons d'email si vat_number OU country_code diffèrent)
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_country_vat_uidx
  ON public.customers (
    lower(email),
    country_code,
    coalesce(nullif(trim(vat_number), ''), '__no_vat__')
  );

-- Index utile pour lookups par email seul (non-unique)
CREATE INDEX IF NOT EXISTS customers_email_lower_idx ON public.customers (lower(email));

COMMENT ON INDEX public.customers_email_country_vat_uidx IS
  'Un même email peut coexister sur plusieurs customers si le pays OU le numéro de TVA diffère (B2B multi-sociétés). Sélection du bon compte gérée côté auth via account_memberships.';
