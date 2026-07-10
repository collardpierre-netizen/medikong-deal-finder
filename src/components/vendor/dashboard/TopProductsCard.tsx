import { VCard } from "@/components/vendor/ui/VCard";
import { useMoneyFormat } from "@/lib/money-format";
import type { TopProductSlice } from "@/hooks/useVendorMonthlyDashboard";
import { Package, TrendingUp } from "lucide-react";

interface Props {
  products: TopProductSlice[];
  loading?: boolean;
}

/**
 * Classement des top-produits vendeur sur la période :
 * quantité, CA HTVA, commission MediKong et marge nette (barre relative).
 */
export default function TopProductsCard({ products, loading }: Props) {
  const { formatMoney } = useMoneyFormat();
  const maxRevenue = products.reduce((m, p) => Math.max(m, p.revenueCents), 0);

  return (
    <VCard className="h-full">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className="text-[13px] font-bold text-[#1D2530] inline-flex items-center gap-1.5">
            <TrendingUp size={13} className="text-[#1B5BDA]" /> Top produits
          </h3>
          <p className="text-[11px] text-[#8B95A5]">Classement CA · commission · net</p>
        </div>
        <span className="text-[10.5px] text-[#8B95A5]">{products.length} SKU</span>
      </div>

      {loading ? (
        <div className="h-40 w-full animate-pulse bg-[#F1F5F9] rounded" />
      ) : products.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-[12px] text-[#8B95A5]">
          Aucune vente sur la période.
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p, i) => {
            const rev = p.revenueCents / 100;
            const comm = p.commissionCents / 100;
            const net = p.netMarginCents / 100;
            const netPct = p.revenueCents > 0 ? (p.netMarginCents / p.revenueCents) * 100 : 0;
            const barPct = maxRevenue > 0 ? (p.revenueCents / maxRevenue) * 100 : 0;
            return (
              <div key={p.productId} className="text-[11.5px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="w-4 h-4 rounded-full bg-[#F1F5F9] text-[10px] font-bold text-[#475569] flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <Package size={11} className="text-[#8B95A5] shrink-0" />
                    <span className="truncate font-medium text-[#1D2530]" title={p.productName}>
                      {p.productName}
                    </span>
                  </div>
                  <span className="font-semibold text-[#1B5BDA] tabular-nums shrink-0">
                    {formatMoney(rev, { fractionDigits: 0 })}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barPct}%`, backgroundColor: "#1B5BDA" }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10.5px] text-[#64748B] tabular-nums">
                  <span>{p.quantity} u.</span>
                  <span>
                    Comm. <span className="text-amber-700 font-semibold">{formatMoney(comm, { fractionDigits: 0 })}</span>
                    {" · "}
                    Net{" "}
                    {p.hasCost ? (
                      <span className={`font-semibold ${net >= 0 ? "text-emerald-700" : "text-destructive"}`}>
                        {formatMoney(net, { fractionDigits: 0 })} ({netPct.toFixed(1)}%)
                      </span>
                    ) : (
                      <span className="italic text-[#94A3B8]">coût manquant</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </VCard>
  );
}
