-- Révoquer l'accès public aux fonctions du garde-fou (elles ne doivent
-- être déclenchées que via triggers internes ou admins).
REVOKE EXECUTE ON FUNCTION public.tg_record_deactivation_row() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_check_deactivation_threshold() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_bulk_deactivation_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_override_requested() FROM PUBLIC, anon, authenticated;