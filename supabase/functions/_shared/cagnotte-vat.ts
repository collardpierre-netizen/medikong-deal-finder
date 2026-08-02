/**
 * Cagnotte MediKong — utilitaire TVA à 2 modes (miroir serveur de src/lib/cagnotte-vat.ts).
 *
 * Mode `payment` (défaut) : la cagnotte est un moyen de paiement → TVA sur le HT PLEIN.
 * Mode `discount` : la cagnotte est une remise commerciale → TVA sur (HT − cagnotte).
 */
export type CagnotteVatMode = "payment" | "discount";

export interface VatBreakdown {
  vat_base: number;
  vat_amount: number;
  vat_mode: CagnotteVatMode;
  total_ttc: number;
  net_to_pay: number;
}

/**
 * Arrondi monétaire de référence (2 décimales, demi-supérieur sur la valeur absolue,
 * insensible aux erreurs de représentation flottante : 1.005 → 1.01, 8.575 → 8.58).
 * Miroir strict de `src/lib/cagnotte-vat.ts`.
 */
export function roundEur(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  const cents = Math.round(Number((Math.abs(n) * 100).toPrecision(12)));
  return (sign * cents) / 100;
}

/**
 * Formatage monétaire belge : virgule décimale, toujours 2 décimales,
 * espace insécable comme séparateur de milliers, suffixe « € ».
 */
export function formatEurBe(value: number): string {
  const rounded = roundEur(value);
  const [intPart, decPart] = Math.abs(rounded).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return `${rounded < 0 ? "-" : ""}${grouped},${decPart}\u00A0€`;
}

const r2 = roundEur;

export function computeVatBase(
  subtotalHt: number,
  cagnotteUsed: number,
  vatMode: CagnotteVatMode = "payment",
  vatRate = 0.21,
  fullVatAmount?: number,
): VatBreakdown {
  const subtotal = r2(Math.max(subtotalHt, 0));
  const used = r2(Math.min(Math.max(cagnotteUsed, 0), subtotal));

  const vat_base = vatMode === "discount" ? r2(subtotal - used) : subtotal;

  let vat_amount: number;
  if (typeof fullVatAmount === "number" && subtotal > 0) {
    vat_amount = r2(fullVatAmount * (vat_base / subtotal));
  } else {
    vat_amount = r2(vat_base * vatRate);
  }

  const total_ttc = vatMode === "discount" ? r2(vat_base + vat_amount) : r2(subtotal + vat_amount);
  const net_to_pay = vatMode === "discount" ? total_ttc : r2(total_ttc - used);

  return { vat_base, vat_amount, vat_mode: vatMode, total_ttc, net_to_pay };
}

export function cagnotteVatModeLabel(mode: CagnotteVatMode) {
  return mode === "discount"
    ? "Remise commerciale (TVA sur le HT net)"
    : "Moyen de paiement (TVA sur le HT plein)";
}

/** Résultat du calcul résilient : `degraded = true` si le repli a été utilisé. */
export interface SafeVatBreakdown extends VatBreakdown {
  degraded: boolean;
  degraded_reason?: string;
}

/** Vérifie la cohérence interne d'un récapitulatif (montants finis + identités comptables). */
export function isVatBreakdownCoherent(
  b: VatBreakdown | null | undefined,
  subtotalHt: number,
  cagnotteUsed: number,
): boolean {
  if (!b) return false;
  const nums = [b.vat_base, b.vat_amount, b.total_ttc, b.net_to_pay];
  if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0)) return false;
  const subtotal = roundEur(Math.max(subtotalHt, 0));
  const used = roundEur(Math.min(Math.max(cagnotteUsed, 0), subtotal));
  if (b.vat_base > subtotal + 0.01) return false;
  if (roundEur(b.vat_base + b.vat_amount) !== b.total_ttc && b.vat_mode === "discount") return false;
  if (b.vat_mode === "payment" && roundEur(subtotal + b.vat_amount) !== b.total_ttc) return false;
  const expectedNet = b.vat_mode === "discount" ? b.total_ttc : roundEur(b.total_ttc - used);
  return roundEur(Math.abs(b.net_to_pay - expectedNet)) <= 0.01;
}

/**
 * Repli de calcul : mode `payment` (le plus prudent — TVA sur le HT plein,
 * la cagnotte est déduite du TTC), sans dépendance au helper principal.
 */
export function fallbackVatBreakdown(
  subtotalHt: number,
  cagnotteUsed: number,
  vatRate = 0.21,
  fullVatAmount?: number,
): VatBreakdown {
  const subtotal = roundEur(Math.max(Number(subtotalHt) || 0, 0));
  const used = roundEur(Math.min(Math.max(Number(cagnotteUsed) || 0, 0), subtotal));
  const vat_amount =
    typeof fullVatAmount === "number" && Number.isFinite(fullVatAmount) && fullVatAmount >= 0
      ? roundEur(fullVatAmount)
      : roundEur(subtotal * (Number.isFinite(vatRate) ? vatRate : 0.21));
  const total_ttc = roundEur(subtotal + vat_amount);
  return {
    vat_base: subtotal,
    vat_amount,
    vat_mode: "payment",
    total_ttc,
    net_to_pay: roundEur(total_ttc - used),
  };
}

/**
 * Calcul résilient du récapitulatif : utilise `computeVatBase`, et bascule sur
 * `fallbackVatBreakdown` si le helper lève une erreur ou renvoie un résultat
 * incohérent (évite un récap incomplet ou contradictoire côté UI et email).
 */
export function computeVatBaseSafe(
  subtotalHt: number,
  cagnotteUsed: number,
  vatMode: CagnotteVatMode = "payment",
  vatRate = 0.21,
  fullVatAmount?: number,
): SafeVatBreakdown {
  const invalidInput =
    !Number.isFinite(subtotalHt) ||
    !Number.isFinite(cagnotteUsed) ||
    !Number.isFinite(vatRate) ||
    (fullVatAmount !== undefined && !Number.isFinite(fullVatAmount));
  if (invalidInput) {
    return {
      ...fallbackVatBreakdown(subtotalHt, cagnotteUsed, vatRate, fullVatAmount),
      degraded: true,
      degraded_reason: "invalid_input",
    };
  }
  try {
    const b = computeVatBase(subtotalHt, cagnotteUsed, vatMode, vatRate, fullVatAmount);
    if (isVatBreakdownCoherent(b, subtotalHt, cagnotteUsed)) return { ...b, degraded: false };
    return {
      ...fallbackVatBreakdown(subtotalHt, cagnotteUsed, vatRate, fullVatAmount),
      degraded: true,
      degraded_reason: "incoherent_breakdown",
    };
  } catch (e) {
    return {
      ...fallbackVatBreakdown(subtotalHt, cagnotteUsed, vatRate, fullVatAmount),
      degraded: true,
      degraded_reason: e instanceof Error ? e.message : "compute_failed",
    };
  }
}

/** Charge le mode/taux TVA cagnotte depuis la table settings (best-effort). */
export async function loadCagnotteVatSettings(
  supabase: { from: (t: string) => any },
): Promise<{ vatMode: CagnotteVatMode; vatRate: number }> {
  try {
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["cagnotte_vat_mode", "cagnotte_vat_rate"]);
    const map: Record<string, any> = {};
    for (const r of data ?? []) map[r.key] = r.value;
    return {
      vatMode: (String(map.cagnotte_vat_mode ?? "payment") as CagnotteVatMode),
      vatRate: Number(map.cagnotte_vat_rate ?? 0.21),
    };
  } catch {
    return { vatMode: "payment", vatRate: 0.21 };
  }
}
