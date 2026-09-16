/**
 * Source unique de vérité (front) pour la longueur du code de vérification e-mail.
 *
 * Doit rester alignée avec :
 *  - `supabase/functions/_shared/otp.ts` (e-mails transactionnels)
 *  - la longueur du code OTP généré par l'authentification backend
 */
export const OTP_LENGTH = 8;
