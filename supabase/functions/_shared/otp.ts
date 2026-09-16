/**
 * Source unique de vérité (edge functions / e-mails) pour la longueur du code
 * de vérification e-mail.
 *
 * Doit rester alignée avec `src/config/otp.ts` (UI d'onboarding) et avec la
 * longueur du code OTP généré par l'authentification backend.
 */
export const OTP_LENGTH = 8

/** Code d'exemple utilisé uniquement par l'endpoint de prévisualisation des e-mails. */
export const OTP_SAMPLE_TOKEN = Array.from(
  { length: OTP_LENGTH },
  (_, i) => String((i + 1) % 10),
).join('')
