CREATE OR REPLACE FUNCTION public.enforce_offer_publication_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name text;
  v_type text;
  v_auth boolean;
  v_mandate timestamptz;
  v_ref_exists boolean;
BEGIN
  IF COALESCE(NEW.is_active, false) = false THEN
    RETURN NEW;
  END IF;

  -- Les administrateurs authentifiés peuvent publier au nom d'un vendeur.
  -- La décision repose exclusivement sur l'identité serveur auth.uid().
  IF auth.uid() IS NOT NULL AND public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.is_active = true
     AND OLD.vendor_id IS NOT DISTINCT FROM NEW.vendor_id THEN
    RETURN NEW;
  END IF;

  SELECT name, type::text, is_authorized_distributor, mandate_signed_at
    INTO v_name, v_type, v_auth, v_mandate
    FROM public.vendors
   WHERE id = NEW.vendor_id;

  IF v_name = 'MediKong' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_qogita_backed, false) = true
     OR v_type IN ('qogita', 'qogita_virtual') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.vendors
       WHERE is_active = true
         AND is_authorized_distributor = true
         AND mandate_signed_at IS NOT NULL
    ) INTO v_ref_exists;

    IF v_ref_exists THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Offre non publiable : aucun vendeur de référence autorisé (distributeur autorisé + mandat de facturation signé) n''est configuré pour couvrir les ventes.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(v_auth, false) = false OR v_mandate IS NULL THEN
    RAISE EXCEPTION
      'Offre non publiable : le vendeur doit être distributeur autorisé (is_authorized_distributor) ET avoir signé le mandat de facturation (mandate_signed_at).'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;