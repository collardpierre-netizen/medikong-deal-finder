// Centralized config for audit emails (frontend mirror).
// Used by admin UI surfaces (test send button, contact strings tied to the
// internal audit recipient). Server-side, the canonical value lives in
// supabase/functions/_shared/audit-config.ts and can be overridden via the
// AUDIT_NOTIFICATION_EMAIL secret.

export const AUDIT_NOTIFICATION_EMAIL = "pcoll@medikong.pro" as const;
