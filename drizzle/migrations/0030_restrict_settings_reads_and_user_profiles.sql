-- 1) Réglages : lecture directe réservée aux admins (les valeurs internes de marge
--    ne doivent plus être lisibles côté acheteur/vendeur).
drop policy if exists "settings_public_read" on public.settings;
drop policy if exists "Authenticated can read restock settings" on public.restock_settings;

revoke select on public.settings from anon, authenticated;
revoke select on public.restock_settings from anon, authenticated;

create policy "settings_admin_read" on public.settings
  for select to authenticated using (public.is_admin());

create policy "restock_settings_admin_read" on public.restock_settings
  for select to authenticated using (public.is_admin(auth.uid()));

grant select on public.settings to authenticated;
grant select on public.restock_settings to authenticated;

-- RPC exposant uniquement les clés non sensibles nécessaires aux écrans acheteur/vendeur.
create or replace function public.get_public_app_settings()
returns table (source text, key text, value text)
language sql
stable
security definer
set search_path = public
as $$
  select 'settings'::text, s.key, s.value::text
  from public.settings s
  where s.key in (
    'cagnotte_rate',
    'cagnotte_min_commission_eligibility',
    'cagnotte_min_spend',
    'cagnotte_max_spend_pct',
    'cagnotte_vat_mode',
    'cagnotte_vat_rate'
  )
  union all
  select 'restock_settings'::text, r.key, r.value::text
  from public.restock_settings r
  where r.key in (
    'commission_buyer_pct',
    'destruction_cost_per_unit_eur',
    'pricing_zone_red_max',
    'pricing_zone_yellow_max',
    'pricing_zone_green_max',
    'pricing_widget_enabled',
    'moq_min',
    'mov_min_eur',
    'dlu_minimum_months',
    'buyer_verification_required',
    'escrow_hold_days',
    'escrow_release_days',
    'cancellation_penalty_eur',
    'legal_faq_version',
    'legal_faq_acknowledgment_required',
    'exclusivity_days',
    'exclusivity_text',
    'max_photos_per_offer',
    'referral_reward_amount',
    'referral_reward_description',
    'invoice_footer_text',
    'commissionnaire_agreement_text',
    'commissionnaire_agreement_version',
    'cgu_mandate_clause'
  )
$$;

grant execute on function public.get_public_app_settings() to anon, authenticated;

-- 2) Profils professionnels : lecture publique limitée aux profils actifs.
drop policy if exists "public_read_user_profiles" on public.user_profiles;

create policy "public_read_active_user_profiles" on public.user_profiles
  for select to anon, authenticated using (is_active = true);