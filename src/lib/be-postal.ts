/**
 * Mapping code postal belge → province.
 * Source : conventions postales BE (1xxx Bruxelles, 1300-1499 Brabant wallon, etc.)
 */

export type BeProvince =
  | "Bruxelles-Capitale"
  | "Brabant wallon"
  | "Brabant flamand"
  | "Anvers"
  | "Limbourg"
  | "Liège"
  | "Namur"
  | "Hainaut"
  | "Luxembourg"
  | "Flandre orientale"
  | "Flandre occidentale";

export function deriveBeProvince(postalCode: string | null | undefined): BeProvince | null {
  if (!postalCode) return null;
  const cp = parseInt(String(postalCode).trim().slice(0, 4), 10);
  if (isNaN(cp)) return null;

  if (cp >= 1000 && cp <= 1299) return "Bruxelles-Capitale";
  if (cp >= 1300 && cp <= 1499) return "Brabant wallon";
  if ((cp >= 1500 && cp <= 1999) || (cp >= 3000 && cp <= 3499)) return "Brabant flamand";
  if (cp >= 2000 && cp <= 2999) return "Anvers";
  if (cp >= 3500 && cp <= 3999) return "Limbourg";
  if ((cp >= 4000 && cp <= 4999)) return "Liège";
  if (cp >= 5000 && cp <= 5999) return "Namur";
  if ((cp >= 6000 && cp <= 6599) || (cp >= 7000 && cp <= 7999)) return "Hainaut";
  if (cp >= 6600 && cp <= 6999) return "Luxembourg";
  if (cp >= 8000 && cp <= 8999) return "Flandre occidentale";
  if (cp >= 9000 && cp <= 9999) return "Flandre orientale";
  return null;
}

export function formatSellerLocation(opts: {
  city?: string | null;
  postal_code?: string | null;
  province?: string | null;
}): string {
  const province = opts.province || deriveBeProvince(opts.postal_code);
  if (opts.city && province) return `${opts.city} · ${province}`;
  if (opts.city) return opts.city;
  if (province) return province;
  return "Belgique";
}
