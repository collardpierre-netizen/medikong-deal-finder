-- Acquisition strictement atomique : seul l'INSERT réussi détient le verrou.
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
  _got boolean;
BEGIN
  DELETE FROM public.idempotency_locks WHERE lock_key = _key AND expires_at <= now();

  WITH ins AS (
    INSERT INTO public.idempotency_locks (lock_key, holder, acquired_at, expires_at)
    VALUES (_key, _holder, now(), now() + make_interval(secs => GREATEST(_ttl_seconds, 5)))
    ON CONFLICT (lock_key) DO NOTHING
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM ins) INTO _got;

  RETURN _got;
END;
$$;