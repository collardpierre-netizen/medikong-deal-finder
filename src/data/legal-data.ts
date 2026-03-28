export interface CookieEntry {
  name: string;
  purpose: string;
  duration: string;
}

export const essentialCookies: CookieEntry[] = [
  { name: "session_id", purpose: "Maintien de la session utilisateur", duration: "Session" },
  { name: "cart_token", purpose: "Sauvegarde du panier d'achat", duration: "30 jours" },
  { name: "csrf_token", purpose: "Protection contre les attaques CSRF", duration: "Session" },
  { name: "cookie_consent", purpose: "Mémorisation du choix cookies", duration: "12 mois" },
];

export const analyticsCookies: CookieEntry[] = [
  { name: "_ga", purpose: "Identifiant Google Analytics", duration: "13 mois" },
  { name: "_gid", purpose: "Distinction des utilisateurs (Google)", duration: "24 heures" },
  { name: "_plausible", purpose: "Analytics respectueux de la vie privée", duration: "Session" },
];

export const marketingCookies: CookieEntry[] = [
  { name: "_fbp", purpose: "Suivi des conversions Facebook", duration: "3 mois" },
  { name: "_gcl_au", purpose: "Suivi des conversions Google Ads", duration: "3 mois" },
];
