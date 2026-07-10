import { VCard } from "@/components/vendor/ui/VCard";
import { useMoneyFormat } from "@/lib/money-format";
import { ArrowRight } from "lucide-react";

interface Props {
  gmvCents: number;
  revenueExclVatCents: number;
  grossMarginCents: number;
  commissionCents: number;
  netMarginCents: number;
  loading?: boolean;
}

/**
 * Waterfall visuel : GMV TTC → CA HTVA → Marge brute → −Commission MediKong → Net vendeur.
 * Chaque bloc est proportionnel au GMV pour visualiser d'un coup d'œil "où va l'argent".
 */
export default function VendorWaterfallCard({
  gmvCents,
  revenueExclVatCents,
  grossMarginCents,
  commissionCents,
  netMarginCents,
  loading,
}: Props) {
  const { formatMoney } = useMoneyFormat();
  const base = Math.max(gmvCents, revenueExclVatCents, 1);

  const steps = [
    { label: "GMV TTC", value: gmvCents, color: "#0F172A", sub: "toutes taxes comprises" },
    { label: "CA HTVA", value: revenueExclVatCents, color: "#1B5BDA", sub: "hors TVA" },
    { label: "Marge brute", value: grossMarginCents, color: "#7C3AED", sub: "CA − coûts d'achat" },
    { label: "− Commission MediKong", value: -commissionCents, color: "#F59E0B", sub: "prélèvement plateforme" },
    { label: "Net vendeur", value: netMarginCents, color: "#059669", sub: "en poche après commission" },
  ];

  return (
    <VCard>
      <div className="mb-3">
        <h3 className="text-[13px] font-bold text-[#1D2530]">Où va chaque euro de vente ?</h3>
        <p className="text-[11px] text-[#8B95A5]">
          Décomposition GMV → Net vendeur pour la période sélectionnée
        </p>
      </div>

      {loading ? (
        <div className="h-24 w-full animate-pulse bg-[#F1F5F9] rounded" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {steps.map((s, i) => {
            const abs = Math.abs(s.value);
            const pct = base > 0 ? Math.min(100, (abs / base) * 100) : 0;
            const isNeg = s.value < 0;
            return (
              <div key={s.label} className="relative">
                <div
                  className="rounded-lg p-2.5 text-white flex flex-col justify-between h-full min-h-[80px]"
                  style={{
                    backgroundColor: s.color,
                    opacity: abs === 0 ? 0.4 : 1,
                  }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                    {s.label}
                  </div>
                  <div className="mt-1">
                    <div className="text-[15px] font-bold tabular-nums">
                      {isNeg ? "−" : ""}
                      {formatMoney(abs / 100, { fractionDigits: 0 })}
                    </div>
                    <div className="text-[9.5px] opacity-80 mt-0.5">{s.sub}</div>
                    <div className="mt-1 h-1 rounded-full bg-white/25 overflow-hidden">
                      <div className="h-full bg-white/80" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight
                    size={14}
                    className="hidden sm:block absolute -right-1.5 top-1/2 -translate-y-1/2 text-[#CBD5E1] bg-white rounded-full z-10"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </VCard>
  );
}
