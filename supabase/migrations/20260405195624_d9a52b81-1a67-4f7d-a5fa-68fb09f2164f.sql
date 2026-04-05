
-- KYC criteria per business type (CMS-editable by admin)
CREATE TABLE public.vendor_kyc_criteria (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_type text NOT NULL DEFAULT 'grossiste',
  label text NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT true,
  requires_document boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_kyc_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kyc_criteria" ON public.vendor_kyc_criteria FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "KYC criteria publicly readable" ON public.vendor_kyc_criteria FOR SELECT TO public USING (true);

-- Vendor KYC submissions
CREATE TABLE public.vendor_kyc_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  criteria_id uuid NOT NULL REFERENCES public.vendor_kyc_criteria(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  document_url text,
  notes text,
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, criteria_id)
);

ALTER TABLE public.vendor_kyc_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kyc_submissions" ON public.vendor_kyc_submissions FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Vendors read own submissions" ON public.vendor_kyc_submissions FOR SELECT TO authenticated USING (vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid()));
CREATE POLICY "Vendors insert own submissions" ON public.vendor_kyc_submissions FOR INSERT TO authenticated WITH CHECK (vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid()));
CREATE POLICY "Vendors update own submissions" ON public.vendor_kyc_submissions FOR UPDATE TO authenticated USING (vendor_id IN (SELECT id FROM vendors WHERE auth_user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_vendor_kyc_criteria_updated_at BEFORE UPDATE ON public.vendor_kyc_criteria FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendor_kyc_submissions_updated_at BEFORE UPDATE ON public.vendor_kyc_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default criteria
INSERT INTO public.vendor_kyc_criteria (business_type, label, description, is_required, requires_document, sort_order) VALUES
('grossiste', 'Licence AFMPS', 'Licence de distribution en gros de médicaments', true, true, 1),
('grossiste', 'Assurance RC Pro', 'Responsabilité civile professionnelle', true, true, 2),
('grossiste', 'Certificats CE produits', 'Certificats de conformité européenne', true, true, 3),
('grossiste', 'Système traçabilité', 'Système de traçabilité des lots', true, false, 4),
('grossiste', 'GDP compliance', 'Good Distribution Practice', true, false, 5),
('fabricant_dm', 'Marquage CE', 'Certificat de marquage CE', true, true, 1),
('fabricant_dm', 'Déclaration conformité', 'Déclaration de conformité UE', true, true, 2),
('fabricant_dm', 'Dossier technique', 'Documentation technique complète', true, true, 3),
('fabricant_dm', 'ISO 13485', 'Certification ISO 13485', true, true, 4),
('fabricant_dm', 'Vigilance matériovigilance', 'Système de matériovigilance', true, false, 5),
('distributeur_otc', 'Notification AFMPS', 'Notification auprès de l''AFMPS', true, true, 1),
('distributeur_otc', 'Bonnes pratiques distribution', 'Respect des BPD', true, false, 2),
('distributeur_otc', 'Traçabilité lots', 'Système de traçabilité des lots', true, false, 3),
('distributeur_otc', 'Pharmacien responsable', 'Pharmacien responsable désigné', true, false, 4),
('distributeur_otc', 'Assurance RC', 'Assurance responsabilité civile', true, true, 5),
('fabricant_cosmetique', 'Notification CPNP', 'Notification au portail CPNP', true, true, 1),
('fabricant_cosmetique', 'DIP', 'Dossier d''Information Produit', true, true, 2),
('fabricant_cosmetique', 'BPF ISO 22716', 'Bonnes Pratiques de Fabrication', true, true, 3),
('fabricant_cosmetique', 'Personne responsable', 'Personne responsable désignée', true, false, 4),
('fabricant_cosmetique', 'Cosmétovigilance', 'Système de cosmétovigilance', true, false, 5);

-- Storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-kyc-docs', 'vendor-kyc-docs', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Vendors upload own kyc docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vendor-kyc-docs' AND (storage.foldername(name))[1] IN (SELECT id::text FROM vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Vendors read own kyc docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vendor-kyc-docs' AND (storage.foldername(name))[1] IN (SELECT id::text FROM vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admins read all kyc docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vendor-kyc-docs' AND is_admin(auth.uid()));
