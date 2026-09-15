-- =====================================================================
-- MediKong Care — LOT 0 : fondations du schéma nh_* sur la production
-- Reconstruction (pas de migration de données). Décalqué du projet Care.
-- FK adaptées aux tables de PROD : products, orders, vendors, affiliates.
-- =====================================================================

-- ---------------------------------------------------------------- ENUMS
DO $$ BEGIN
  CREATE TYPE public.nh_billing_type AS ENUM ('RESIDENT','FACILITY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nh_role AS ENUM ('admin_mr','soignant','comptabilite','super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nh_resident_status AS ENUM ('active','discharged','deceased');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------- GROUPES
CREATE TABLE IF NOT EXISTS public.nh_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  legal_name text,
  trade_name text,
  description text,
  address text,
  city text,
  postal_code text,
  country text DEFAULT 'BE',
  vat_number text,
  contact_email text,
  contact_phone text,
  website_url text,
  logo_url text,
  primary_color text,
  secondary_color text,
  is_active boolean NOT NULL DEFAULT true,
  -- pilotage prix / affichage (donnée client)
  price_rule_type text,
  price_rule_value numeric(10,2),
  margin_split_pct numeric(5,2),
  show_public_price boolean DEFAULT true,
  show_pharmacy_price boolean DEFAULT false,
  show_savings_badge boolean DEFAULT true,
  hide_offers_above_ref_price boolean DEFAULT false,
  filter_shop_by_billing_type boolean DEFAULT false,
  -- logistique
  franco_threshold numeric(10,2),
  shipping_cost_below_franco numeric(10,2),
  urgent_delivery_cost numeric(10,2),
  cutoff_hour integer,
  cutoff_days_before integer,
  fixed_delivery_day_of_week integer,
  payment_terms text,
  -- INTERNE MediKong : jamais lu/écrit depuis care.medikong.pro
  commission_rate numeric(5,2),
  referrer_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  care_pharmacy_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  user_profile_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_groups TO authenticated;
GRANT ALL ON public.nh_groups TO service_role;
ALTER TABLE public.nh_groups ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------ RESIDENCES
CREATE TABLE IF NOT EXISTS public.nursing_homes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.nh_groups(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  legal_name text,
  trade_name text,
  address text,
  city text,
  postal_code text,
  country text DEFAULT 'BE',
  vat_number text,
  billing_address text,
  billing_city text,
  billing_postal_code text,
  billing_country text DEFAULT 'BE',
  admin_contact_name text,
  admin_contact_email text,
  admin_contact_phone text,
  logo_url text,
  website_url text,
  bed_count integer,
  language text DEFAULT 'fr',
  languages text[] DEFAULT ARRAY['fr']::text[],
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  -- héritage groupe
  inherits_group_pricing boolean DEFAULT true,
  inherits_group_display boolean DEFAULT true,
  inherits_group_payment_terms boolean DEFAULT true,
  -- prix / affichage (donnée client)
  price_rule_type text,
  price_rule_value numeric(10,2),
  margin_split_pct numeric(5,2),
  show_public_price boolean DEFAULT true,
  show_pharmacy_price boolean DEFAULT false,
  show_savings_badge boolean DEFAULT true,
  -- logistique
  franco_threshold numeric(10,2),
  shipping_cost_below_franco numeric(10,2),
  urgent_delivery_cost numeric(10,2),
  cutoff_hour integer,
  cutoff_days_before integer,
  fixed_delivery_day_of_week integer,
  payment_terms text,
  -- INTERNE MediKong : jamais lu/écrit depuis care.medikong.pro
  commission_rate numeric(5,2),
  referrer_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  user_profile_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nursing_homes TO authenticated;
GRANT ALL ON public.nursing_homes TO service_role;
ALTER TABLE public.nursing_homes ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------ ACCES
CREATE TABLE IF NOT EXISTS public.nh_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  role public.nh_role NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, nursing_home_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_user_roles TO authenticated;
GRANT ALL ON public.nh_user_roles TO service_role;
ALTER TABLE public.nh_user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_group_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.nh_groups(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin_groupe',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, group_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_group_user_roles TO authenticated;
GRANT ALL ON public.nh_group_user_roles TO service_role;
ALTER TABLE public.nh_group_user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.nh_role NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32),'hex'),
  status text DEFAULT 'pending',
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_invitations TO authenticated;
GRANT ALL ON public.nh_invitations TO service_role;
ALTER TABLE public.nh_invitations ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------- CHAMBRES / RESIDENTS
CREATE TABLE IF NOT EXISTS public.nh_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  floor text,
  unit text,
  is_occupied boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (nursing_home_id, room_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_rooms TO authenticated;
GRANT ALL ON public.nh_rooms TO service_role;
ALTER TABLE public.nh_rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_residents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.nh_rooms(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  internal_number text,
  status public.nh_resident_status DEFAULT 'active',
  billing_name text,
  billing_address text,
  billing_city text,
  billing_postal_code text,
  billing_country text DEFAULT 'BE',
  billing_contact_name text,
  billing_contact_email text,
  billing_contact_phone text,
  family_contact_name text,
  family_contact_phone text,
  family_contact_email text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_residents TO authenticated;
GRANT ALL ON public.nh_residents TO service_role;
ALTER TABLE public.nh_residents ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_resident_room_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.nh_residents(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.nh_rooms(id) ON DELETE SET NULL,
  moved_in_at timestamptz DEFAULT now(),
  moved_out_at timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_resident_room_history TO authenticated;
GRANT ALL ON public.nh_resident_room_history TO service_role;
ALTER TABLE public.nh_resident_room_history ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- FONCTIONS D'APPUI (créées après les tables qu'elles interrogent :
-- un corps LANGUAGE sql est validé à la création)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.has_nh_role(_user_id uuid, _nursing_home_id uuid, _role public.nh_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nh_user_roles
    WHERE user_id = _user_id AND nursing_home_id = _nursing_home_id
      AND role = _role AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_nh_role(_user_id uuid, _nursing_home_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nh_user_roles
    WHERE user_id = _user_id AND nursing_home_id = _nursing_home_id AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.nh_group_user_roles gur
    JOIN public.nursing_homes nh ON nh.group_id = gur.group_id
    WHERE gur.user_id = _user_id AND nh.id = _nursing_home_id AND gur.is_active = true
  )
$$;

-- SUPERADMIN : rôle nh super_admin OU admin MediKong actif (table admin_users de prod)
CREATE OR REPLACE FUNCTION public.is_nh_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nh_user_roles
    WHERE user_id = _user_id AND role = 'super_admin' AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id AND is_active = true AND role IN ('super_admin','admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.nh_update_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.nh_update_room_occupancy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.room_id IS NOT NULL AND OLD.room_id IS DISTINCT FROM NEW.room_id THEN
    UPDATE public.nh_rooms SET is_occupied = false WHERE id = OLD.room_id;
    UPDATE public.nh_resident_room_history SET moved_out_at = now()
      WHERE resident_id = NEW.id AND room_id = OLD.room_id AND moved_out_at IS NULL;
  END IF;
  IF NEW.room_id IS NOT NULL AND (OLD.room_id IS NULL OR OLD.room_id IS DISTINCT FROM NEW.room_id) THEN
    UPDATE public.nh_rooms SET is_occupied = true WHERE id = NEW.room_id;
    INSERT INTO public.nh_resident_room_history (resident_id, room_id) VALUES (NEW.id, NEW.room_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------- TRIGGERS
DROP TRIGGER IF EXISTS trg_nh_groups_updated ON public.nh_groups;
CREATE TRIGGER trg_nh_groups_updated BEFORE UPDATE ON public.nh_groups
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nursing_homes_updated ON public.nursing_homes;
CREATE TRIGGER trg_nursing_homes_updated BEFORE UPDATE ON public.nursing_homes
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nh_user_roles_updated ON public.nh_user_roles;
CREATE TRIGGER trg_nh_user_roles_updated BEFORE UPDATE ON public.nh_user_roles
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nh_group_user_roles_updated ON public.nh_group_user_roles;
CREATE TRIGGER trg_nh_group_user_roles_updated BEFORE UPDATE ON public.nh_group_user_roles
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nh_rooms_updated ON public.nh_rooms;
CREATE TRIGGER trg_nh_rooms_updated BEFORE UPDATE ON public.nh_rooms
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nh_residents_updated ON public.nh_residents;
CREATE TRIGGER trg_nh_residents_updated BEFORE UPDATE ON public.nh_residents
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nh_residents_room_occupancy ON public.nh_residents;
CREATE TRIGGER trg_nh_residents_room_occupancy AFTER UPDATE OF room_id ON public.nh_residents
FOR EACH ROW EXECUTE FUNCTION public.nh_update_room_occupancy();

-- =====================================================================
-- POLICIES (modèle à 3 policies : utilisateurs résidence en lecture,
-- Admin MR en écriture, SUPERADMIN tout — rôle comptabilite inclus en lecture)
-- =====================================================================
CREATE POLICY "Super admins can manage all nh groups" ON public.nh_groups
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "Group users can view their group" ON public.nh_groups
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.nh_group_user_roles gur
          WHERE gur.group_id = nh_groups.id AND gur.user_id = auth.uid() AND gur.is_active = true)
  OR EXISTS (SELECT 1 FROM public.nh_user_roles nu
             JOIN public.nursing_homes nh ON nh.id = nu.nursing_home_id
             WHERE nu.user_id = auth.uid() AND nh.group_id = nh_groups.id AND nu.is_active = true)
);

CREATE POLICY "Group admins can update their group" ON public.nh_groups
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_group_user_roles gur
               WHERE gur.group_id = nh_groups.id AND gur.user_id = auth.uid()
                 AND gur.is_active = true AND gur.role = 'admin_groupe'))
WITH CHECK (EXISTS (SELECT 1 FROM public.nh_group_user_roles gur
               WHERE gur.group_id = nh_groups.id AND gur.user_id = auth.uid()
                 AND gur.is_active = true AND gur.role = 'admin_groupe'));

CREATE POLICY "Super admins can manage all nursing homes" ON public.nursing_homes
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH users can view their nursing home" ON public.nursing_homes
FOR SELECT TO authenticated
USING (public.has_any_nh_role(auth.uid(), id));

CREATE POLICY "NH admins can update their nursing home" ON public.nursing_homes
FOR UPDATE TO authenticated
USING (public.has_nh_role(auth.uid(), id, 'admin_mr'))
WITH CHECK (public.has_nh_role(auth.uid(), id, 'admin_mr'));

CREATE POLICY "Super admins can manage all NH roles" ON public.nh_user_roles
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH admins can manage roles in their NH" ON public.nh_user_roles
FOR ALL TO authenticated
USING (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'))
WITH CHECK (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'));

CREATE POLICY "Users can view their own NH roles" ON public.nh_user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage group roles" ON public.nh_group_user_roles
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "Group admins can manage group roles" ON public.nh_group_user_roles
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_group_user_roles g
               WHERE g.group_id = nh_group_user_roles.group_id AND g.user_id = auth.uid()
                 AND g.is_active = true AND g.role = 'admin_groupe'))
WITH CHECK (EXISTS (SELECT 1 FROM public.nh_group_user_roles g
               WHERE g.group_id = nh_group_user_roles.group_id AND g.user_id = auth.uid()
                 AND g.is_active = true AND g.role = 'admin_groupe'));

CREATE POLICY "Users can view their own group roles" ON public.nh_group_user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all invitations" ON public.nh_invitations
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH admins can manage invitations" ON public.nh_invitations
FOR ALL TO authenticated
USING (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'))
WITH CHECK (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'));

CREATE POLICY "NH users can view invitations of their NH" ON public.nh_invitations
FOR SELECT TO authenticated USING (public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "NH users can view rooms" ON public.nh_rooms
FOR SELECT TO authenticated USING (public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "NH admins can manage rooms" ON public.nh_rooms
FOR ALL TO authenticated
USING (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'))
WITH CHECK (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'));

CREATE POLICY "Super admins can manage all rooms" ON public.nh_rooms
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH users can view residents" ON public.nh_residents
FOR SELECT TO authenticated USING (public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "NH admins can manage residents" ON public.nh_residents
FOR ALL TO authenticated
USING (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'))
WITH CHECK (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'));

CREATE POLICY "Super admins can manage all residents" ON public.nh_residents
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH users can view room history" ON public.nh_resident_room_history
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_residents r
               WHERE r.id = resident_id AND public.has_any_nh_role(auth.uid(), r.nursing_home_id)));

CREATE POLICY "NH admins can manage room history" ON public.nh_resident_room_history
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_residents r
               WHERE r.id = resident_id AND public.has_nh_role(auth.uid(), r.nursing_home_id, 'admin_mr')))
WITH CHECK (EXISTS (SELECT 1 FROM public.nh_residents r
               WHERE r.id = resident_id AND public.has_nh_role(auth.uid(), r.nursing_home_id, 'admin_mr')));

CREATE POLICY "Super admins can manage room history" ON public.nh_resident_room_history
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

-- ---------------------------------------------------------------- INDEX
CREATE INDEX IF NOT EXISTS idx_nursing_homes_group ON public.nursing_homes(group_id);
CREATE INDEX IF NOT EXISTS idx_nh_user_roles_user ON public.nh_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_nh_user_roles_nh ON public.nh_user_roles(nursing_home_id);
CREATE INDEX IF NOT EXISTS idx_nh_group_user_roles_user ON public.nh_group_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_nh_group_user_roles_group ON public.nh_group_user_roles(group_id);
CREATE INDEX IF NOT EXISTS idx_nh_rooms_nh ON public.nh_rooms(nursing_home_id);
CREATE INDEX IF NOT EXISTS idx_nh_residents_nh ON public.nh_residents(nursing_home_id);
CREATE INDEX IF NOT EXISTS idx_nh_residents_room ON public.nh_residents(room_id);
CREATE INDEX IF NOT EXISTS idx_nh_room_history_resident ON public.nh_resident_room_history(resident_id);
CREATE INDEX IF NOT EXISTS idx_nh_invitations_token ON public.nh_invitations(token);
CREATE INDEX IF NOT EXISTS idx_nh_invitations_email ON public.nh_invitations(email);