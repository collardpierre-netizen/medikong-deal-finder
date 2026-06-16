CREATE OR REPLACE FUNCTION public._account_hash_token(_token text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT encode(extensions.digest(_token, 'sha256'), 'hex');
$$;