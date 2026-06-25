import { computeMargin, type VendorCommissionConfig } from "@/lib/vendorMargin";

/**
 * Fallback de commission utilisé par /admin/commandes quand :
 *  - aucun override commission_amount_override / commission_rate_override
 *    n'est stocké dans sub_orders (`stored.explicit === false`)
 *  - ET `draft_payload` est vide / absent
 *
 * Dans ce cas on recalcule la commission à partir des `order_lines`
 * persistés en multipliant chaque ligne par la config commission du vendeur.
 */
export interface OrderLineForCommission {
  vendor_id?: string | null;
  quantity?: number | string | null;
  unit_price_excl_vat?: number | string | null;
  cost_price?: number | string | null;
}

export function computeCommissionFromLines(
  lines: OrderLineForCommission[] | null | undefined,
  vendorCommissionById: Map<string, VendorCommissionConfig>,
): number {
  if (!Array.isArray(lines) || lines.length === 0) return 0;
  let total = 0;
  for (const l of lines) {
    const vendorId = l.vendor_id ?? undefined;
    if (!vendorId) continue;
    const cfg = vendorCommissionById.get(vendorId);
    if (!cfg) continue;
    const qty = Number(l.quantity) || 0;
    const unitSell = Number(l.unit_price_excl_vat) || 0;
    const unitCost = Number(l.cost_price) || 0;
    if (qty <= 0 || unitSell <= 0) continue;
    const lineSell = unitSell * qty;
    const lineCost = unitCost * qty;
    const b = computeMargin(lineSell, lineCost > 0 ? lineCost : null, cfg);
    total += b.commission;
  }
  return total;
}
