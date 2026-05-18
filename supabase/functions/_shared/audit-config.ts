// Centralized config for audit emails.
// Single source of truth for the internal recipient of audit notifications
// (new leads, internal alerts, admin test sends).
//
// Override at runtime by setting the AUDIT_NOTIFICATION_EMAIL secret
// in the Supabase project — useful for staging / pre-prod without code changes.
// If unset, falls back to the production address below.

export const AUDIT_NOTIFICATION_EMAIL: string =
  (typeof Deno !== 'undefined' &&
    Deno.env?.get('AUDIT_NOTIFICATION_EMAIL')?.trim()) ||
  'pcoll@medikong.pro'
