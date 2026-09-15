-- =====================================================================
-- MediKong Care — surface acheteur (care_*), ajouts §2.2, numérotation INV-R
-- =====================================================================

-- ------------------------------------------------ PIN & appareils (care_*)
CREATE TABLE IF NOT EXISTS public.care_staff_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  pin_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, nursing_home_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_staff_pins TO authenticated;
GRANT ALL ON public.care_staff_pins TO service_role;
ALTER TABLE public.care_staff_pins ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.care_pin_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  requested_ip text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.care_pin_reset_tokens TO service_role;
ALTER TABLE public.care_pin_reset_tokens ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------- Paniers en cours (care_*)
CREATE TABLE IF NOT EXISTS public.care_draft_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_draft_carts TO authenticated;
GRANT ALL ON public.care_draft_carts TO service_role;
ALTER TABLE public.care_draft_carts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.care_draft_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.care_draft_carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_code text NOT NULL DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  product_subtitle text,
  image_url text,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  billing_type text NOT NULL DEFAULT 'FACILITY',
  resident_id uuid REFERENCES public.nh_residents(id) ON DELETE SET NULL,
  resident_name text,
  vat_rate numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_draft_cart_items TO authenticated;
GRANT ALL ON public.care_draft_cart_items TO service_role;
ALTER TABLE public.care_draft_cart_items ENABLE ROW LEVEL SECURITY;

-- ------------------------------------- Raccourcis catégories & recherche (care_*)
CREATE TABLE IF NOT EXISTS public.care_category_shortcuts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nursing_home_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_category_shortcuts TO authenticated;
GRANT ALL ON public.care_category_shortcuts TO service_role;
ALTER TABLE public.care_category_shortcuts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.care_search_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nursing_home_id uuid REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  search_query text NOT NULL,
  results_count integer,
  clicked_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.care_search_analytics TO authenticated;
GRANT ALL ON public.care_search_analytics TO service_role;
ALTER TABLE public.care_search_analytics ENABLE ROW LEVEL SECURITY;

-- ===================================================== §2.2.1 « Ma liste »
CREATE TABLE IF NOT EXISTS public.nh_order_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  unit_label text,
  name text NOT NULL,
  billing_target text NOT NULL DEFAULT 'facility'
    CHECK (billing_target IN ('facility','resident','both')),
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_order_templates TO authenticated;
GRANT ALL ON public.nh_order_templates TO service_role;
ALTER TABLE public.nh_order_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_order_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.nh_order_templates(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  default_qty integer NOT NULL DEFAULT 1 CHECK (default_qty > 0),
  position integer NOT NULL DEFAULT 0,
  UNIQUE (template_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_order_template_items TO authenticated;
GRANT ALL ON public.nh_order_template_items TO service_role;
ALTER TABLE public.nh_order_template_items ENABLE ROW LEVEL SECURITY;

-- ============================================ §2.2.2 Enrôlement d'appareil
CREATE TABLE IF NOT EXISTS public.nh_device_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  label text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  consumed_at timestamptz,
  consumed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  device_hint text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.nh_device_enrollments TO authenticated;
GRANT ALL ON public.nh_device_enrollments TO service_role;
ALTER TABLE public.nh_device_enrollments ENABLE ROW LEVEL SECURITY;

-- ===================================================== §2.2.3 Push web
CREATE TABLE IF NOT EXISTS public.nh_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, endpoint)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_push_subscriptions TO authenticated;
GRANT ALL ON public.nh_push_subscriptions TO service_role;
ALTER TABLE public.nh_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================== §2.2.4 Idempotence file d'envoi hors-ligne
ALTER TABLE public.nh_orders ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS nh_orders_client_request_id_key
  ON public.nh_orders(client_request_id) WHERE client_request_id IS NOT NULL;

-- ------------------------------------------------------------- TRIGGERS
DROP TRIGGER IF EXISTS trg_care_staff_pins_updated ON public.care_staff_pins;
CREATE TRIGGER trg_care_staff_pins_updated BEFORE UPDATE ON public.care_staff_pins
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_care_draft_carts_updated ON public.care_draft_carts;
CREATE TRIGGER trg_care_draft_carts_updated BEFORE UPDATE ON public.care_draft_carts
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nh_order_templates_updated ON public.nh_order_templates;
CREATE TRIGGER trg_nh_order_templates_updated BEFORE UPDATE ON public.nh_order_templates
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

-- =====================================================================
-- POLICIES
-- =====================================================================
-- PIN : l'utilisateur ne voit que sa propre ligne ; Admin MR gère celles de sa résidence
CREATE POLICY "Users manage their own PIN" ON public.care_staff_pins
FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "NH admins manage PINs of their NH" ON public.care_staff_pins
FOR ALL TO authenticated
USING (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'))
WITH CHECK (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'));

CREATE POLICY "Super admins manage all PINs" ON public.care_staff_pins
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

-- Jetons de reset PIN : service_role uniquement (aucune policy authenticated)
CREATE POLICY "Super admins can view PIN reset tokens" ON public.care_pin_reset_tokens
FOR SELECT TO authenticated USING (public.is_nh_super_admin(auth.uid()));

-- Paniers en cours
CREATE POLICY "NH users view draft carts" ON public.care_draft_carts
FOR SELECT TO authenticated USING (public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "NH users manage draft carts" ON public.care_draft_carts
FOR ALL TO authenticated
USING (public.has_any_nh_role(auth.uid(), nursing_home_id))
WITH CHECK (public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "Super admins manage all draft carts" ON public.care_draft_carts
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH users view draft cart items" ON public.care_draft_cart_items
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.care_draft_carts c
               WHERE c.id = cart_id AND public.has_any_nh_role(auth.uid(), c.nursing_home_id)));

CREATE POLICY "NH users manage draft cart items" ON public.care_draft_cart_items
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.care_draft_carts c
               WHERE c.id = cart_id AND public.has_any_nh_role(auth.uid(), c.nursing_home_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.care_draft_carts c
               WHERE c.id = cart_id AND public.has_any_nh_role(auth.uid(), c.nursing_home_id)));

CREATE POLICY "Super admins manage all draft cart items" ON public.care_draft_cart_items
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

-- Raccourcis catégories : propres à l'utilisateur
CREATE POLICY "Users manage their category shortcuts" ON public.care_category_shortcuts
FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins manage all category shortcuts" ON public.care_category_shortcuts
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

-- Analytics recherche : insertion par l'utilisateur, lecture SUPERADMIN
CREATE POLICY "Users insert their search analytics" ON public.care_search_analytics
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Super admins view search analytics" ON public.care_search_analytics
FOR SELECT TO authenticated USING (public.is_nh_super_admin(auth.uid()));

-- « Ma liste » : lecture + écriture pour tout rôle actif de la résidence,
-- lecture pour l'Admin Groupe (via has_any_nh_role), tout pour SUPERADMIN
CREATE POLICY "NH users view order templates" ON public.nh_order_templates
FOR SELECT TO authenticated USING (public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "NH users manage order templates" ON public.nh_order_templates
FOR ALL TO authenticated
USING (public.has_nh_role(auth.uid(), nursing_home_id, 'soignant')
       OR public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr')
       OR public.has_nh_role(auth.uid(), nursing_home_id, 'comptabilite'))
WITH CHECK (public.has_nh_role(auth.uid(), nursing_home_id, 'soignant')
       OR public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr')
       OR public.has_nh_role(auth.uid(), nursing_home_id, 'comptabilite'));

CREATE POLICY "Super admins manage all order templates" ON public.nh_order_templates
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH users view order template items" ON public.nh_order_template_items
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_order_templates t
               WHERE t.id = template_id AND public.has_any_nh_role(auth.uid(), t.nursing_home_id)));

CREATE POLICY "NH users manage order template items" ON public.nh_order_template_items
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_order_templates t
               WHERE t.id = template_id
                 AND (public.has_nh_role(auth.uid(), t.nursing_home_id, 'soignant')
                      OR public.has_nh_role(auth.uid(), t.nursing_home_id, 'admin_mr')
                      OR public.has_nh_role(auth.uid(), t.nursing_home_id, 'comptabilite'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.nh_order_templates t
               WHERE t.id = template_id
                 AND (public.has_nh_role(auth.uid(), t.nursing_home_id, 'soignant')
                      OR public.has_nh_role(auth.uid(), t.nursing_home_id, 'admin_mr')
                      OR public.has_nh_role(auth.uid(), t.nursing_home_id, 'comptabilite'))));

CREATE POLICY "Super admins manage all order template items" ON public.nh_order_template_items
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

-- Enrôlement : Admin MR / Admin Groupe / SUPERADMIN en select+insert.
-- La consommation du token passe exclusivement par edge function service_role.
CREATE POLICY "NH admins view device enrollments" ON public.nh_device_enrollments
FOR SELECT TO authenticated
USING (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr')
       OR EXISTS (SELECT 1 FROM public.nh_group_user_roles g
                  JOIN public.nursing_homes nh ON nh.group_id = g.group_id
                  WHERE nh.id = nh_device_enrollments.nursing_home_id
                    AND g.user_id = auth.uid() AND g.is_active = true AND g.role = 'admin_groupe'));

CREATE POLICY "NH admins create device enrollments" ON public.nh_device_enrollments
FOR INSERT TO authenticated
WITH CHECK (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr')
       OR EXISTS (SELECT 1 FROM public.nh_group_user_roles g
                  JOIN public.nursing_homes nh ON nh.group_id = g.group_id
                  WHERE nh.id = nh_device_enrollments.nursing_home_id
                    AND g.user_id = auth.uid() AND g.is_active = true AND g.role = 'admin_groupe'));

CREATE POLICY "Super admins manage device enrollments" ON public.nh_device_enrollments
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

-- Push : chacun ne voit et n'écrit que ses lignes
CREATE POLICY "Users manage their push subscriptions" ON public.nh_push_subscriptions
FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------- INDEX
CREATE INDEX IF NOT EXISTS care_staff_pins_nh_idx ON public.care_staff_pins(nursing_home_id);
CREATE INDEX IF NOT EXISTS care_pin_reset_tokens_user_idx ON public.care_pin_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS care_draft_carts_nh_idx ON public.care_draft_carts(nursing_home_id);
CREATE INDEX IF NOT EXISTS care_draft_cart_items_cart_idx ON public.care_draft_cart_items(cart_id);
CREATE INDEX IF NOT EXISTS care_category_shortcuts_user_idx ON public.care_category_shortcuts(user_id, nursing_home_id);
CREATE INDEX IF NOT EXISTS care_search_analytics_nh_idx ON public.care_search_analytics(nursing_home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS nh_order_templates_nh_idx ON public.nh_order_templates(nursing_home_id, unit_label);
CREATE INDEX IF NOT EXISTS nh_order_template_items_template_idx ON public.nh_order_template_items(template_id, position);
CREATE INDEX IF NOT EXISTS nh_device_enrollments_nh_idx ON public.nh_device_enrollments(nursing_home_id) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS nh_push_subscriptions_user_idx ON public.nh_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS nh_push_subscriptions_nh_idx ON public.nh_push_subscriptions(nursing_home_id);

-- =====================================================================
-- NUMÉROTATION DES FACTURES RÉSIDENTS — type INV-R, format INV-R-AAAA-NNNN
-- Séquence continue via document_number_sequences, attribuée à l'émission.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.generate_document_number(p_document_type text, p_year integer DEFAULT NULL::integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_year   int := COALESCE(p_year, EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Brussels'))::int);
  v_prefix text;
  v_pad    int;
  v_next   int;
BEGIN
  v_prefix := CASE p_document_type
    WHEN 'sale'               THEN 'MK'
    WHEN 'commission_invoice' THEN 'COM'
    WHEN 'credit_note'        THEN 'NC'
    WHEN 'delivery_note'      THEN 'BL'
    WHEN 'affiliate_payout'   THEN 'AP'
    WHEN 'sale_test'          THEN 'TEST'
    WHEN 'INV-R'              THEN 'INV-R'
    ELSE NULL
  END;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Type de document inconnu: %', p_document_type;
  END IF;

  v_pad := CASE p_document_type WHEN 'sale' THEN 5 WHEN 'sale_test' THEN 5 ELSE 4 END;

  INSERT INTO public.document_number_sequences (document_type, year, last_number)
  VALUES (p_document_type, v_year, 0)
  ON CONFLICT (document_type, year) DO NOTHING;

  UPDATE public.document_number_sequences
     SET last_number = last_number + 1,
         updated_at  = now()
   WHERE document_type = p_document_type AND year = v_year
  RETURNING last_number INTO v_next;

  RETURN v_prefix || '-' || v_year || '-' ||
         CASE WHEN v_next > (10 ^ v_pad - 1)::int
              THEN v_next::text
              ELSE lpad(v_next::text, v_pad, '0')
         END;
END;
$function$;

-- Passage brouillon -> émise : seul chemin d'attribution du numéro
CREATE OR REPLACE FUNCTION public.nh_issue_invoice(_invoice_id uuid)
RETURNS TABLE (invoice_id uuid, invoice_number text, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nh uuid;
  v_status text;
  v_number text;
BEGIN
  SELECT nursing_home_id, status, nh_invoices.invoice_number
    INTO v_nh, v_status, v_number
  FROM public.nh_invoices WHERE id = _invoice_id;

  IF v_nh IS NULL THEN
    RAISE EXCEPTION 'Facture introuvable';
  END IF;

  IF NOT (public.is_nh_super_admin(auth.uid())
          OR public.has_nh_role(auth.uid(), v_nh, 'admin_mr')
          OR public.has_nh_role(auth.uid(), v_nh, 'comptabilite')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF v_number IS NOT NULL THEN
    RETURN QUERY SELECT _invoice_id, v_number, v_status;
    RETURN;
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Seule une facture en brouillon peut être émise (statut actuel: %)', v_status;
  END IF;

  v_number := public.generate_document_number('INV-R');

  UPDATE public.nh_invoices
     SET invoice_number = v_number,
         status = 'issued',
         issue_date = current_date,
         updated_at = now()
   WHERE id = _invoice_id;

  RETURN QUERY SELECT _invoice_id, v_number, 'issued'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.nh_issue_invoice(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.nh_issue_invoice(uuid) TO authenticated, service_role;

-- Filet : interdit d'émettre sans numéro séquentiel
CREATE OR REPLACE FUNCTION public.nh_invoices_require_number_when_issued()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'draft' AND NEW.invoice_number IS NULL THEN
    RAISE EXCEPTION 'Une facture émise doit porter un numéro généré par generate_document_number(''INV-R'')';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nh_invoices_require_number ON public.nh_invoices;
CREATE TRIGGER trg_nh_invoices_require_number
BEFORE INSERT OR UPDATE ON public.nh_invoices
FOR EACH ROW EXECUTE FUNCTION public.nh_invoices_require_number_when_issued();