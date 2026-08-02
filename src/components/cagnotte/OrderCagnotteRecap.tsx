import { Wallet, Info } from "lucide-react";
import { useCagnotteSettings } from "@/hooks/useCagnotte";
import { computeVatBaseSafe, cagnotteVatModeLabel, formatEurBe } from "@/lib/cagnotte-vat";

interface OrderCagnotteRecapProps {
  subtotalHt: number;
  cagnotteUsed: number;
  /** TVA réelle multi-taux calculée sur le HT plein (orders.vat_amount) */
  fullVatAmount?: number;
  className?: string;
}

/**
 * Récapitulatif détaillé « cagnotte utilisée » + TVA (mode payment vs discount).
 * Affiché sur la confirmation de commande. Ne s'affiche que si de la cagnotte a été appliquée.
 */
export function OrderCagnotteRecap({
  subtotalHt,
  cagnotteUsed,
  fullVatAmount,
  className = "",
}: OrderCagnotteRecapProps) {
  const { data: settings } = useCagnotteSettings();
  if (!cagnotteUsed || cagnotteUsed <= 0) return null;

  const vatMode = settings?.vatMode ?? "payment";
  const vatRate = Number(settings?.raw?.cagnotte_vat_rate ?? 0.21);
  const b = computeVatBaseSafe(subtotalHt, cagnotteUsed, vatMode, vatRate, fullVatAmount);
  const effectiveMode = b.vat_mode;

  const rows: Array<{ label: string; value: string; hint?: string; strong?: boolean }> = [
    { label: "Sous-total HT", value: formatEurBe(subtotalHt) },
    { label: "Cagnotte MediKong utilisée", value: `− ${formatEurBe(cagnotteUsed)}` },
    {
      label: "Base TVA",
      value: formatEurBe(b.vat_base),
      hint:
        effectiveMode === "discount"
          ? "HT net (sous-total − cagnotte)"
          : "HT plein (la cagnotte est un moyen de paiement)",
    },
    { label: "TVA", value: formatEurBe(b.vat_amount) },
    { label: "Total TTC", value: formatEurBe(b.total_ttc) },
    { label: "Net à payer", value: formatEurBe(b.net_to_pay), strong: true },
  ];

  return (
    <div className={`border border-mk-line rounded-lg p-5 text-left ${className}`}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-mk-navy mb-1">
        <Wallet size={16} className="text-mk-blue" /> Cagnotte MediKong &amp; TVA
      </h2>
      <p className="flex items-start gap-1.5 text-[11px] text-mk-sec mb-3">
        <Info size={12} className="mt-0.5 shrink-0" />
        Mode TVA appliqué : <strong className="font-semibold text-mk-navy">{cagnotteVatModeLabel(effectiveMode)}</strong>
      </p>
      {b.degraded && (
        <p className="text-[11px] text-mk-sec mb-3">
          Récapitulatif recalculé en mode sécurisé (TVA sur le HT plein). Le montant net à payer
          reste exact ; en cas de doute, la facture fait foi.
        </p>
      )}
      <dl className="divide-y divide-mk-line/70">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className={`text-xs ${r.strong ? "font-semibold text-mk-navy" : "text-mk-sec"}`}>
              {r.label}
              {r.hint && <span className="block text-[10px] text-mk-sec/80">{r.hint}</span>}
            </dt>
            <dd
              className={`text-sm tabular-nums ${
                r.strong ? "font-bold text-mk-navy" : "font-medium text-mk-navy"
              }`}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
