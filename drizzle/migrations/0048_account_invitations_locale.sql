ALTER TABLE public.account_invitations
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'fr'
  CONSTRAINT account_invitations_locale_chk CHECK (locale IN ('fr','nl','de','en'));

CREATE OR REPLACE FUNCTION public.account_set_invitation_locale(_invitation_id uuid, _locale text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF _locale NOT IN ('fr','nl','de','en') THEN RAISE EXCEPTION 'invalid locale'; END IF;
  SELECT account_kind, account_id INTO r FROM account_invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found'; END IF;
  IF NOT (public.is_admin() OR public.is_account_admin(r.account_kind, r.account_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE account_invitations SET locale = _locale WHERE id = _invitation_id;
END $$;

REVOKE ALL ON FUNCTION public.account_set_invitation_locale(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_set_invitation_locale(uuid, text) TO authenticated;