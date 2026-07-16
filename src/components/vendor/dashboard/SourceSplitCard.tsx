import { VCard } from "@/components/vendor/ui/VCard";
import { useMoneyFormat } from "@/lib/money-format";
import { Globe, UserCog, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  siteCents: number;
  siteOrders: number;
  siteCommissionCents: number;
  manualCents: number;
  manualOrders: number;
  manualCommissionCents: number;
  loading?: boolean;
}

/**
 * Split CA HTVA + commission selon l'origine :
 * - Site : commandes passées par le buyer sur medikong.pro
 * - Manuel : commandes créées par un admin (source='manual_admin' ou created_by_admin)
 */
export default function SourceSplitCard({
  siteCents,
  siteOrders,
  siteCommissionCents,
  manualCents,
  manualOrders,
  manualCommissionCents,
  loading,
}: Props) {
  const { formatMoney } = useMoneyFormat();
  const totalRevenue = siteCents + manualCents;
  const pct = (v: number) => (totalRevenue > 0 ? (v / totalRevenue) * 100 : 0);

  const rows = [
    {
      key: "site",
      label: "Ventes site",
      sub: "checkout medikong.pro",
      revenueCents: siteCents,
      commissionCents: siteCommissionCents,
      orders: siteOrders,
      icon: <Globe size={14} className="text-white" />,
      color: "#1B5BDA",
    },
    {
      key: "manual",
      label: "Ventes manuelles",
      sub: "saisies par un admin MediKong",
      revenueCents: manualCents,
      commissionCents: manualCommissionCents,
      orders: manualOrders,
      icon: <UserCog size={14} className="text-white" />,
      color: "#059669",
    },
  ];

  return (
    <VCard>
      <div className="mb-3">
        <h3 className="text-[13px] font-bold text-[#1D2530]">
          Ventes site vs ventes manuelles
        </h3>
        <p className="text-[11px] text-[#8B95A5]">
          Origine de chaque commande (CA HTVA · commission MediKong · nb commandes)
        </p>
      </div>

      {loading ? (
        <div className="h-20 w-full animate-pulse bg-[#F1F5F9] rounded" />
      ) : totalRevenue === 0 ? (
        <div className="text-[12px] text-[#8B95A5] py-4">
          Aucune vente sur la période.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="flex items-start gap-3">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: r.color }}
              >
                {r.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[#1D2530]">
                    {r.label}
                  </span>
                  <span className="text-[13px] font-bold tabular-nums text-[#1D2530]">
                    {formatMoney(r.revenueCents / 100, { fractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct(r.revenueCents)}%`, backgroundColor: r.color }}
                    />
                  </div>
                  <span className="text-[10.5px] tabular-nums text-[#8B95A5] w-10 text-right">
                    {pct(r.revenueCents).toFixed(0)}%
                  </span>
                </div>
                <div className="text-[10.5px] text-[#8B95A5] mt-0.5">
                  {r.sub} · {r.orders} commande{r.orders > 1 ? "s" : ""} · commission{" "}
                  <span className="font-semibold text-[#1D2530]">
                    {formatMoney(r.commissionCents / 100, { fractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </VCard>
  );
}
