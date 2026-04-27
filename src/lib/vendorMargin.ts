/**
 * Calculs commission MediKong + marge nette vendeur.
 *
 * Modèles supportés (cf. table vendors.commission_model) :
 *  - flat_percentage : commission_rate % du prix de vente HTVA
 *  - margin_split    : on prend la marge brute (vente - achat),
 *                      MediKong garde (100 - margin_split_pct) %, le vendeur garde margin_split_pct %.
 *  - fixed_amount    : commission fixe en € par unité vendue (fixed_commission_amount)
 *
 * Toutes les valeurs sont HTVA, en EUR. Arrondis 2 décimales pour l'affichage.
 */

export type CommissionModel = "flat_percentage" | "margin_split" | "fixed_amount";

export interface VendorCommissionConfig {
  commission_model: CommissionModel;
  /** Taux flat en % (ex: 12 = 12%) */
  commission_rate?: number | null;
  /** Part de marge gardée par le VENDEUR en % (ex: 50 = 50/50) */
  margin_split_pct?: number | null;
  /** € fixes par unité vendue */
  fixed_commission_amount?: number | null;
}

export interface MarginBreakdown {
  /** Prix de vente HTVA */
  sellPrice: number;
  /** Prix d'achat HTVA (0 si inconnu) */
  purchasePrice: number;
  /** Marge brute = vente - achat */
  grossMargin: number;
  /** Marge brute en % du prix de vente (0 si vente <= 0) */
  grossMarginPct: number;
  /** Commission MediKong en € (toujours >= 0) */
  commission: number;
  /** Commission MediKong en % du prix de vente (pour repère) */
  commissionPct: number;
  /** Net en poche pour le vendeur = vente - commission */
  netRevenue: number;
  /** Marge nette = vente - achat - commission */
  netMargin: number;
  /** Marge nette en % du prix de vente */
  netMarginPct: number;
  /** True si le prix d'achat est connu (sinon marge brute non calculable) */
  hasCost: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const safe = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? n : 0;

export function computeMargin(
  sellPriceExclVat: number,
  purchasePriceExclVat: number | null | undefined,
  cfg: VendorCommissionConfig,
): MarginBreakdown {
  const sell = Math.max(0, safe(sellPriceExclVat));
  const cost = Math.max(0, safe(purchasePriceExclVat));
  const hasCost = typeof purchasePriceExclVat === "number" && purchasePriceExclVat > 0;
  const gross = sell - cost;

  let commission = 0;
  switch (cfg.commission_model) {
    case "flat_percentage": {
      const rate = safe(cfg.commission_rate);
      commission = (sell * rate) / 100;
      break;
    }
    case "margin_split": {
      // MediKong keeps (100 - vendor_share)% of gross margin (only if positive)
      const vendorSharePct = safe(cfg.margin_split_pct);
      const platformSharePct = Math.max(0, 100 - vendorSharePct);
      const baseGross = Math.max(0, gross);
      commission = (baseGross * platformSharePct) / 100;
      break;
    }
    case "fixed_amount": {
      commission = safe(cfg.fixed_commission_amount);
      break;
    }
  }
  commission = Math.max(0, commission);

  const netRevenue = sell - commission;
  const netMargin = sell - cost - commission;

  return {
    sellPrice: r2(sell),
    purchasePrice: r2(cost),
    grossMargin: r2(gross),
    grossMarginPct: sell > 0 ? r2((gross / sell) * 100) : 0,
    commission: r2(commission),
    commissionPct: sell > 0 ? r2((commission / sell) * 100) : 0,
    netRevenue: r2(netRevenue),
    netMargin: r2(netMargin),
    netMarginPct: sell > 0 ? r2((netMargin / sell) * 100) : 0,
    hasCost,
  };
}

export const fmtEur = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(2)} €` : "—";

export const fmtPct = (n: number | null | undefined, digits = 1) =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(digits)} %` : "—";
