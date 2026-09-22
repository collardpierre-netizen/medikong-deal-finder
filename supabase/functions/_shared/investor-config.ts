// Centralized config for investor relations emails.
// Override at runtime with the INVESTOR_NOTIFICATION_EMAIL secret.
export const INVESTOR_NOTIFICATION_EMAIL: string =
  (typeof Deno !== 'undefined' &&
    Deno.env?.get('INVESTOR_NOTIFICATION_EMAIL')?.trim()) ||
  'pcoll@medikong.pro'
