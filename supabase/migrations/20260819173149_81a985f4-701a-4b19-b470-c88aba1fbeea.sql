DO $do$
DECLARE
  r record;
  v_def text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) ~ '\mol\.commission_amount\M'
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_def := regexp_replace(
      v_def,
      '\mol\.commission_amount\M',
      'COALESCE(ol.commission_computed, ol.commission_amount)',
      'g'
    );
    EXECUTE v_def;
  END LOOP;
END
$do$;