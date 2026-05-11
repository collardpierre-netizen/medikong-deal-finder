INSERT INTO public.vendor_market_intel_entitlements (vendor_id, status, trial_started_at, trial_ends_at, notes)
VALUES ('ba152407-8d3d-4e8f-8f35-2ed421c8e638', 'trial', now(), now() + interval '180 days', 'Activation manuelle admin (Fixmer Pharma)')
ON CONFLICT (vendor_id) DO UPDATE
  SET status = 'trial',
      trial_started_at = COALESCE(public.vendor_market_intel_entitlements.trial_started_at, now()),
      trial_ends_at = GREATEST(COALESCE(public.vendor_market_intel_entitlements.trial_ends_at, now()), now() + interval '180 days'),
      notes = 'Activation manuelle admin (Fixmer Pharma)';