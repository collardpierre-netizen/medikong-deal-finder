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

const r2 = (n: number) => Math.round(n * 100) / 100;

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
