/**
 * Métriques financières d'une ligne / d'une commande manuelle admin.
 *
 * Règle d'arrondi unique partagée entre l'UI (page Nouvelle commande manuelle)
 * et les tests : on convertit chaque montant en CENTS via Math.round(x * 100),
 * on fait toute l'arithmétique en entiers, puis on redivise par 100 pour
 * l'affichage. Cela garantit les invariants ci-dessous au centime près :
 *
 *   ca       = commission + netVendor
 *   gross    = netMargin  + commission     (si hasCost)
 *   gross    = ca - cost                   (si hasCost)
 *   totals.* = somme exacte des lineMetrics arrondies
 */

export interface ManualLineInput {
  quantity: number;
  /** PU HTVA (€) */
  unit_price_excl_vat: number;
  /** TVA en % (0..100) */
  vat_rate?: number;
  /** PU achat HTVA (€) — string vide / null = inconnu */
  unit_cost_excl_vat?: string | number | null;
  /** Commission en % du CA HTVA — exclusif avec commission_amount */
  commission_rate?: string | number | null;
  /** Commission en € par unité vendue — exclusif avec commission_rate */
  commission_amount?: string | number | null;
}

export interface LineMetrics {
  ca: number;
  cost: number;
  gross: number;
  commission: number;
  netVendor: number;
  netMargin: number;
  hasCost: boolean;
  /** CA TTC = ca * (1 + vat_rate/100), arrondi 2 décimales */
  caIncl: number;
}

export interface OrderTotals {
  excl: number;
  incl: number;
  vat: number;
  cost: number;
  hasAnyCost: boolean;
  commission: number;
  gross: number;
  netVendor: number;
  netMargin: number;
}

export interface CoherenceCheck {
  ok: boolean;
  issues: string[];
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return NaN;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/** € → cents entiers (arrondi banquier non, half-away-from-zero). */
export const toCents = (eur: number): number => Math.round(eur * 100);
/** cents → € arrondis 2 décimales. */
export const fromCents = (cents: number): number => Math.round(cents) / 100;

export function lineMetrics(l: ManualLineInput): LineMetrics {
  const qty = Math.max(0, Math.trunc(toNum(l.quantity) || 0));
  const sellC = toCents(toNum(l.unit_price_excl_vat) || 0);
  const costRaw = toNum(l.unit_cost_excl_vat);
  const hasCost = Number.isFinite(costRaw) && costRaw > 0;
  const costC = hasCost ? toCents(costRaw) : 0;

  const caC = sellC * qty;
  const costTotalC = costC * qty;
  const grossC = hasCost ? caC - costTotalC : 0;

  const rate = toNum(l.commission_rate);
  const amt = toNum(l.commission_amount);
  let commissionC = 0;
  if (Number.isFinite(amt) && amt >= 0) {
    commissionC = toCents(amt) * qty;
  } else if (Number.isFinite(rate) && rate >= 0) {
    // commission = round(ca * rate / 100), calcul en cents
    commissionC = Math.round((caC * rate) / 100);
  }
  if (commissionC < 0) commissionC = 0;

  const netVendorC = caC - commissionC;
  const netMarginC = hasCost ? caC - costTotalC - commissionC : 0;

  const vat = toNum(l.vat_rate);
  const vatRate = Number.isFinite(vat) ? vat : 0;
  const caInclC = Math.round(caC * (1 + vatRate / 100));

  return {
    ca: fromCents(caC),
    cost: fromCents(costTotalC),
    gross: fromCents(grossC),
    commission: fromCents(commissionC),
    netVendor: fromCents(netVendorC),
    netMargin: fromCents(netMarginC),
    hasCost,
    caIncl: fromCents(caInclC),
  };
}

export function computeOrderTotals(lines: ManualLineInput[]): OrderTotals {
  let exclC = 0, inclC = 0, costC = 0, commissionC = 0;
  let hasAnyCost = false;
  for (const l of lines) {
    const m = lineMetrics(l);
    exclC += toCents(m.ca);
    inclC += toCents(m.caIncl);
    if (m.hasCost) { costC += toCents(m.cost); hasAnyCost = true; }
    commissionC += toCents(m.commission);
  }
  return {
    excl: fromCents(exclC),
    incl: fromCents(inclC),
    vat: fromCents(inclC - exclC),
    cost: fromCents(costC),
    hasAnyCost,
    commission: fromCents(commissionC),
    gross: hasAnyCost ? fromCents(exclC - costC) : 0,
    netVendor: fromCents(exclC - commissionC),
    netMargin: hasAnyCost ? fromCents(exclC - costC - commissionC) : 0,
  };
}

/**
 * Vérifie les invariants attendus sur les métriques (à 1 centime près).
 * Retourne ok=true si tout est cohérent, sinon la liste des écarts détectés.
 */
export function checkCoherence(lines: ManualLineInput[]): CoherenceCheck {
  const issues: string[] = [];
  const eq = (a: number, b: number) => Math.abs(toCents(a) - toCents(b)) <= 1;

  lines.forEach((l, i) => {
    const m = lineMetrics(l);
    if (!eq(m.ca, m.commission + m.netVendor)) {
      issues.push(`Ligne #${i + 1} : CA ≠ commission + net vendeur (${m.ca} ≠ ${m.commission} + ${m.netVendor})`);
    }
    if (m.hasCost) {
      if (!eq(m.gross, m.ca - m.cost)) {
        issues.push(`Ligne #${i + 1} : marge brute ≠ CA − coût`);
      }
      if (!eq(m.netMargin, m.gross - m.commission)) {
        issues.push(`Ligne #${i + 1} : marge nette ≠ marge brute − commission`);
      }
    }
  });

  const t = computeOrderTotals(lines);
  if (!eq(t.excl, t.commission + t.netVendor)) {
    issues.push(`Total : CA HTVA ≠ commission + net vendeur (${t.excl} ≠ ${t.commission} + ${t.netVendor})`);
  }
  if (t.hasAnyCost && !eq(t.gross, t.excl - t.cost)) {
    issues.push(`Total : marge brute ≠ CA − coût`);
  }
  if (t.hasAnyCost && !eq(t.netMargin, t.gross - t.commission)) {
    issues.push(`Total : marge nette ≠ marge brute − commission`);
  }
  if (!eq(t.incl, t.excl + t.vat)) {
    issues.push(`Total : TTC ≠ HTVA + TVA`);
  }

  return { ok: issues.length === 0, issues };
}
