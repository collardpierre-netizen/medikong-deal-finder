-- ============================================================================
-- LOT 0a — Fondations scan facture pharmacien
-- Standards: montants en cents (bigint pour totaux, numeric(14,4) cents pour prix unitaires)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BUYERS (entités acheteuses)
-- ----------------------------------------------------------------------------
create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  pharmacy_name text,
  audience text not null default 'pharmacy'
    check (audience in ('pharmacy', 'institution', 'wholesaler', 'lab', 'healthcare_pro')),
  vat_number text,
  address jsonb,
  region text check (region in ('brussels', 'wallonia', 'flanders')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_buyers_user on public.buyers(user_id);

alter table public.buyers enable row level security;

drop policy if exists "buyers_select_own" on public.buyers;
create policy "buyers_select_own" on public.buyers
  for select using (user_id = auth.uid());

drop policy if exists "buyers_insert_own" on public.buyers;
create policy "buyers_insert_own" on public.buyers
  for insert with check (user_id = auth.uid());

drop policy if exists "buyers_update_own" on public.buyers;
create policy "buyers_update_own" on public.buyers
  for update using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. KNOWN_SUPPLIERS (référentiel grossistes BE)
-- ----------------------------------------------------------------------------
create table if not exists public.known_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  vat_number text,
  detection_patterns jsonb,
  template_active boolean not null default false,
  layout_hints_json jsonb,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.known_suppliers enable row level security;

drop policy if exists "known_suppliers_read_all" on public.known_suppliers;
create policy "known_suppliers_read_all" on public.known_suppliers
  for select to authenticated using (true);

insert into public.known_suppliers (name, vat_number, template_active, detection_patterns) values
  ('Phoenix',         'BE0405.301.066', true,  '{"keywords": ["Phoenix Pharma", "Phoenix"]}'::jsonb),
  ('Febelco',         'BE0410.057.534', true,  '{"keywords": ["Febelco", "Coöperatieve Vennootschap"]}'::jsonb),
  ('CERP',            'BE0426.062.090', true,  '{"keywords": ["CERP", "Cerp Belgique"]}'::jsonb),
  ('Pharma Belgium',  'BE0403.487.451', true,  '{"keywords": ["Pharma Belgium"]}'::jsonb),
  ('Meditrade',       'BE0432.781.034', true,  '{"keywords": ["Meditrade"]}'::jsonb),
  ('Cophana',         'BE0407.673.501', true,  '{"keywords": ["Cophana"]}'::jsonb)
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 3. WHOLESALER_PROFILES (règles de remise par défaut)
-- ----------------------------------------------------------------------------
create table if not exists public.wholesaler_profiles (
  id uuid primary key default gen_random_uuid(),
  known_supplier_id uuid references public.known_suppliers(id) on delete set null,
  slug text not null unique,
  display_name text not null,
  country text not null default 'BE',
  discount_mechanic text not null check (discount_mechanic in (
    'line_column', 'category_grid', 'monthly_rfa', 'none'
  )),
  default_discount_pct numeric(5, 2),
  default_discount_rules_json jsonb,
  extraction_hints_json jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wholesaler_profiles enable row level security;

drop policy if exists "wholesaler_profiles_read_all" on public.wholesaler_profiles;
create policy "wholesaler_profiles_read_all" on public.wholesaler_profiles
  for select to authenticated using (true);

insert into public.wholesaler_profiles (slug, display_name, discount_mechanic, default_discount_pct, default_discount_rules_json, extraction_hints_json) values
  ('phoenix', 'Phoenix', 'line_column', 5.00,
    '{"rule": "if discount column empty -> apply default; if filled -> use as-is, no stacking"}'::jsonb,
    '{"discount_column_label": ["Remise", "Rem.", "% Rem"]}'::jsonb),
  ('febelco', 'Febelco', 'monthly_rfa', 0.00,
    '{"rule": "no line-level discount; pharmacist enters monthly RFA % manually"}'::jsonb, '{}'::jsonb),
  ('cerp', 'CERP Belgique', 'category_grid', 0.00,
    '{"grid": {"cosmetic": 8.0, "ethical_drug": 3.5, "otc": 5.0, "default": 4.0}}'::jsonb, '{}'::jsonb),
  ('pharma-belgium', 'Pharma Belgium', 'line_column', 0.00,
    '{"rule": "discount in column Conditions, codes -7% or R4 (R4=4%)"}'::jsonb,
    '{"discount_column_label": ["Conditions", "Cond."]}'::jsonb),
  ('meditrade', 'Meditrade', 'none', 0.00, '{}'::jsonb, '{}'::jsonb),
  ('cophana', 'Cophana', 'line_column', 0.00,
    '{"rule": "discount in column %Remise"}'::jsonb,
    '{"discount_column_label": ["%Remise", "Remise"]}'::jsonb)
on conflict (slug) do nothing;

-- Lien known_suppliers <-> wholesaler_profiles via slug
update public.wholesaler_profiles wp
   set known_supplier_id = ks.id
  from public.known_suppliers ks
 where wp.known_supplier_id is null
   and (
     (wp.slug = 'phoenix'        and ks.name = 'Phoenix') or
     (wp.slug = 'febelco'        and ks.name = 'Febelco') or
     (wp.slug = 'cerp'           and ks.name = 'CERP') or
     (wp.slug = 'pharma-belgium' and ks.name = 'Pharma Belgium') or
     (wp.slug = 'meditrade'      and ks.name = 'Meditrade') or
     (wp.slug = 'cophana'        and ks.name = 'Cophana')
   );

-- ----------------------------------------------------------------------------
-- 4. PHARMACIST_WHOLESALER_SETTINGS (surcharges par pharmacien)
-- ----------------------------------------------------------------------------
create table if not exists public.pharmacist_wholesaler_settings (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wholesaler_profile_id uuid not null references public.wholesaler_profiles(id) on delete cascade,
  is_supplier_of_pharmacist boolean not null default true,
  override_default_discount_pct numeric(5, 2),
  override_rules_json jsonb,
  account_number text,
  contract_start_date date,
  notes text,
  configured_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(buyer_id, wholesaler_profile_id)
);

create index if not exists idx_pws_user on public.pharmacist_wholesaler_settings(user_id);

alter table public.pharmacist_wholesaler_settings enable row level security;

drop policy if exists "pws_owner_all" on public.pharmacist_wholesaler_settings;
create policy "pws_owner_all" on public.pharmacist_wholesaler_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. PRODUCT_ELIGIBILITY_CATEGORIES (référentiel éligibilité)
-- ----------------------------------------------------------------------------
create table if not exists public.product_eligibility_categories (
  code text primary key,
  label text not null,
  eligible_for_marketplace boolean not null,
  excluded_reason text,
  display_color text
);

alter table public.product_eligibility_categories enable row level security;

drop policy if exists "elig_cat_read_all" on public.product_eligibility_categories;
create policy "elig_cat_read_all" on public.product_eligibility_categories
  for select to authenticated using (true);

insert into public.product_eligibility_categories (code, label, eligible_for_marketplace, excluded_reason, display_color) values
  ('eligible_otc',                'OTC (vente libre)',                 true,  null, 'green'),
  ('eligible_cosmetic',           'Cosmétique / dermo',                true,  null, 'green'),
  ('eligible_supplement',         'Complément alimentaire',            true,  null, 'green'),
  ('eligible_nutrition',          'Nutrition médicale',                true,  null, 'green'),
  ('eligible_device_low_class',   'Dispositif médical (Cl. I-IIa)',    true,  null, 'green'),
  ('excluded_rx',                 'Médicament sur ordonnance',         false, 'Hors scope marketplace (Rx)', 'gray'),
  ('excluded_narcotic',           'Stupéfiant / méthylphénidate',      false, 'Hors scope (stupéfiant)', 'gray'),
  ('excluded_device_high_class',  'Dispositif médical (Cl. IIb-III)',  false, 'Hors scope (régulation stricte)', 'gray'),
  ('unknown_needs_review',        'À catégoriser',                     false, 'En attente de classification', 'orange')
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- 6. IMPORTED_INVOICES (factures uploadées)
-- ----------------------------------------------------------------------------
create table if not exists public.imported_invoices (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Fichier source
  source_type text not null check (source_type in ('pdf', 'image_jpeg', 'image_png', 'image_heic', 'image_webp')),
  source_url text not null,
  source_size_bytes int,
  source_pages int,
  source_hash text,

  -- Extraction
  status text not null default 'pending'
    check (status in ('pending', 'extracting', 'extracted', 'reviewed', 'archived', 'failed')),
  extraction_started_at timestamptz,
  extraction_completed_at timestamptz,
  extraction_model text,
  extraction_cost_eur numeric(10, 4),
  extraction_error text,

  -- En-tête extrait
  supplier_name text,
  supplier_vat_number text,
  invoice_number text,
  invoice_date date,
  due_date date,
  currency text not null default 'EUR',

  -- Totaux (cents)
  total_ht_cents bigint,
  total_vat_cents bigint,
  total_ttc_cents bigint,

  -- Paramétrage grossiste
  known_supplier_id uuid references public.known_suppliers(id) on delete set null,
  wholesaler_profile_id uuid references public.wholesaler_profiles(id) on delete set null,

  -- Analyse agrégée
  eligible_lines_count int,
  matched_eligible_lines_count int,
  net_total_ht_cents bigint,
  excluded_lines_count int,
  analysis_json jsonb,
  potential_savings_cents bigint,
  onboarding_complete boolean not null default true,

  -- Liens export
  exported_to_peppol_invoice_id uuid,
  exported_csv_at timestamptz,
  exported_pdf_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_imported_inv_buyer on public.imported_invoices(buyer_id, created_at desc);
create index if not exists idx_imported_inv_hash on public.imported_invoices(source_hash);
create index if not exists idx_imported_inv_status on public.imported_invoices(status);

alter table public.imported_invoices enable row level security;

drop policy if exists "imported_invoices_owner_all" on public.imported_invoices;
create policy "imported_invoices_owner_all" on public.imported_invoices
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. IMPORTED_INVOICE_LINES (lignes extraites)
-- ----------------------------------------------------------------------------
create table if not exists public.imported_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.imported_invoices(id) on delete cascade,
  line_index int not null,

  -- Champs bruts OCR
  raw_description text,
  raw_cnk text,
  raw_ean text,
  raw_quantity numeric(10, 2),
  raw_unit_price_ht_cents numeric(14, 4),
  raw_total_ht_cents bigint,
  raw_discount_pct numeric(5, 2),
  raw_vat_rate numeric(5, 2),
  raw_vat_amount_cents bigint,

  -- Normalisés
  quantity numeric(10, 2),
  unit_price_ht_cents numeric(14, 4),
  total_ht_cents bigint,
  vat_rate numeric(5, 2),
  vat_amount_cents bigint,

  -- Remise appliquée + prix net
  applied_discount_pct numeric(5, 2),
  discount_source text check (discount_source in ('ocr_line', 'profile_default', 'pharmacist_override', 'category_grid', 'none')),
  net_unit_price_ht_cents numeric(14, 4),
  net_total_ht_cents bigint,

  -- Éligibilité
  eligibility_category text references public.product_eligibility_categories(code),
  brand_extracted text,

  -- Match catalogue
  matched_product_id uuid,
  match_confidence text check (match_confidence in ('confirmed', 'probable', 'manual_review', 'no_match')),
  match_score numeric(4, 3),
  match_method text,
  alternative_matches_json jsonb,
  medikong_best_price_cents numeric(14, 4),

  -- Économie signée (cents, positive = MediKong moins cher)
  line_savings_cents bigint,
  line_savings_pct numeric(6, 2),
  medikong_status text check (medikong_status in ('cheaper', 'more_expensive', 'equal', 'not_in_catalog', 'out_of_scope')),

  -- Actions Brique D
  alignment_request_id uuid,
  gamme_demand_signal_id uuid,

  -- Historique pharmacie
  historical_avg_price_cents numeric(14, 4),
  is_anomalous boolean not null default false,
  anomaly_reasons text[],

  created_at timestamptz not null default now()
);

create index if not exists idx_imp_lines_invoice on public.imported_invoice_lines(invoice_id);
create index if not exists idx_imp_lines_product on public.imported_invoice_lines(matched_product_id);
create index if not exists idx_imp_lines_cnk on public.imported_invoice_lines(raw_cnk) where raw_cnk is not null;
create index if not exists idx_imp_lines_ean on public.imported_invoice_lines(raw_ean) where raw_ean is not null;

alter table public.imported_invoice_lines enable row level security;

drop policy if exists "imp_lines_read_own" on public.imported_invoice_lines;
create policy "imp_lines_read_own" on public.imported_invoice_lines
  for select using (
    invoice_id in (select id from public.imported_invoices where user_id = auth.uid())
  );

drop policy if exists "imp_lines_insert_own" on public.imported_invoice_lines;
create policy "imp_lines_insert_own" on public.imported_invoice_lines
  for insert with check (
    invoice_id in (select id from public.imported_invoices where user_id = auth.uid())
  );

drop policy if exists "imp_lines_update_own" on public.imported_invoice_lines;
create policy "imp_lines_update_own" on public.imported_invoice_lines
  for update using (
    invoice_id in (select id from public.imported_invoices where user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 8. SELLER_ALIGNMENT_REQUESTS (Brique D — cas 2)
-- ----------------------------------------------------------------------------
create table if not exists public.seller_alignment_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  cnk text not null,
  current_seller_id uuid not null,
  current_seller_price_cents numeric(14, 4) not null,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  invoice_line_id uuid references public.imported_invoice_lines(id) on delete set null,
  buyer_net_price_cents numeric(14, 4) not null,
  wholesaler_profile_id uuid references public.wholesaler_profiles(id) on delete set null,
  delta_cents bigint not null,
  delta_pct numeric(6, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'aligned', 'declined', 'expired')),
  expires_at timestamptz not null,
  aligned_new_price_cents numeric(14, 4),
  aligned_at timestamptz,
  declined_reason text,
  cooldown_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_alignment_seller on public.seller_alignment_requests(current_seller_id, status);
create index if not exists idx_alignment_buyer on public.seller_alignment_requests(buyer_id);
create index if not exists idx_alignment_expires on public.seller_alignment_requests(expires_at) where status = 'pending';

alter table public.seller_alignment_requests enable row level security;

drop policy if exists "alignment_seller_read" on public.seller_alignment_requests;
create policy "alignment_seller_read" on public.seller_alignment_requests
  for select using (current_seller_id = auth.uid());

drop policy if exists "alignment_seller_update" on public.seller_alignment_requests;
create policy "alignment_seller_update" on public.seller_alignment_requests
  for update using (current_seller_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 9. GAMME_DEMAND_SIGNALS (Brique D — cas 3)
-- ----------------------------------------------------------------------------
create table if not exists public.gamme_demand_signals (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,
  cnk_requested text not null,
  product_label_extracted text not null,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  invoice_line_id uuid references public.imported_invoice_lines(id) on delete set null,
  buyer_net_price_cents numeric(14, 4) not null,
  target_price_hint_cents numeric(14, 4) not null,
  quantity numeric(10, 2),
  notified_seller_ids uuid[],
  status text not null default 'open' check (status in ('open', 'fulfilled', 'expired')),
  expires_at timestamptz not null,
  fulfilled_by_seller_id uuid,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gamme_brand on public.gamme_demand_signals(brand_slug, status);
create index if not exists idx_gamme_expires on public.gamme_demand_signals(expires_at) where status = 'open';

alter table public.gamme_demand_signals enable row level security;

drop policy if exists "gamme_seller_read" on public.gamme_demand_signals;
create policy "gamme_seller_read" on public.gamme_demand_signals
  for select using (auth.uid() = any(notified_seller_ids));

-- ----------------------------------------------------------------------------
-- 10. ADMIN_SETTINGS (paramètres administrables)
-- ----------------------------------------------------------------------------
create table if not exists public.admin_settings (
  key text primary key,
  value_json jsonb not null,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;

drop policy if exists "admin_settings_read_all" on public.admin_settings;
create policy "admin_settings_read_all" on public.admin_settings
  for select to authenticated using (true);

-- Note: les UPDATE/INSERT/DELETE doivent être faits via service_role ou via une RPC admin dédiée.

insert into public.admin_settings (key, value_json, description) values
  ('alignment_request_default_ttl_days', '7'::jsonb,   'Durée demande alignement vendeur, en jours.'),
  ('alignment_request_cooldown_days',    '30'::jsonb,  'Cooldown entre demandes sur même CNK pour même vendeur.'),
  ('alignment_min_delta_pct',            '3.0'::jsonb, 'Écart min %% pour déclencher demande alignement.'),
  ('gamme_demand_target_discount_pct',   '5.0'::jsonb, 'Réduction appliquée au net acheteur pour target price gamme.'),
  ('gamme_demand_default_ttl_days',      '30'::jsonb,  'Durée signal de gamme.')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 11. TRIGGERS updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_buyers_updated on public.buyers;
create trigger trg_buyers_updated before update on public.buyers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_wholesaler_profiles_updated on public.wholesaler_profiles;
create trigger trg_wholesaler_profiles_updated before update on public.wholesaler_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_pws_updated on public.pharmacist_wholesaler_settings;
create trigger trg_pws_updated before update on public.pharmacist_wholesaler_settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_imported_invoices_updated on public.imported_invoices;
create trigger trg_imported_invoices_updated before update on public.imported_invoices
  for each row execute function public.set_updated_at();

drop trigger if exists trg_alignment_updated on public.seller_alignment_requests;
create trigger trg_alignment_updated before update on public.seller_alignment_requests
  for each row execute function public.set_updated_at();

drop trigger if exists trg_gamme_updated on public.gamme_demand_signals;
create trigger trg_gamme_updated before update on public.gamme_demand_signals
  for each row execute function public.set_updated_at();

drop trigger if exists trg_admin_settings_updated on public.admin_settings;
create trigger trg_admin_settings_updated before update on public.admin_settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 12. STORAGE BUCKET imported-invoices
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imported-invoices', 'imported-invoices', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "imported_invoices_upload_own" on storage.objects;
create policy "imported_invoices_upload_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'imported-invoices' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "imported_invoices_read_own" on storage.objects;
create policy "imported_invoices_read_own" on storage.objects
  for select to authenticated using (
    bucket_id = 'imported-invoices' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "imported_invoices_delete_own" on storage.objects;
create policy "imported_invoices_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'imported-invoices' and (storage.foldername(name))[1] = auth.uid()::text
  );