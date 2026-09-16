-- Verrous d'idempotence courts (émission de factures, envoi Peppol).
CREATE TABLE IF NOT EXISTS public.idempotency_locks (
  lock_key text PRIMARY KEY,
  holder text,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

GRANT ALL ON public.idempotency_locks TO service_role;

ALTER TABLE public.idempotency_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read idempotency locks"
ON public.idempotency_locks
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Acquiert le verrou si libre ou expiré. Retourne false si déjà détenu.
CREATE OR REPLACE FUNCTION public.try_acquire_idempotency_lock(
  _key text,
  _ttl_seconds integer DEFAULT 300,
  _holder text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  DELETE FROM public.idempotency_locks WHERE lock_key = _key AND expires_at <= now();

  INSERT INTO public.idempotency_locks (lock_key, holder, acquired_at, expires_at)
  VALUES (_key, _holder, now(), now() + make_interval(secs => GREATEST(_ttl_seconds, 5)))
  ON CONFLICT (lock_key) DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM public.idempotency_locks
    WHERE lock_key = _key AND acquired_at >= now() - interval '2 seconds'
  ) INTO _ok;

  RETURN _ok;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_idempotency_lock(_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.idempotency_locks WHERE lock_key = _key;
$$;

REVOKE ALL ON FUNCTION public.try_acquire_idempotency_lock(text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_idempotency_lock(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_acquire_idempotency_lock(text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_idempotency_lock(text) TO service_role;