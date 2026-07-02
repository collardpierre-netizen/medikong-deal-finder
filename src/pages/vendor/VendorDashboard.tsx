import { useMemo, useState } from "react";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useVendorDashboardKpis } from "@/hooks/useVendorDashboardKpis";
import {
  useVendorMonthlyDashboard,
  type DashboardPeriod,
} from "@/hooks/useVendorMonthlyDashboard";
import { useVendorGmvProgress } from "@/hooks/useVendorGmvProgress";
import { VCard } from "@/components/vendor/ui/VCard";
import { VStat } from "@/components/vendor/ui/VStat";
import { Database } from "lucide-react";
import VendorKycStepper from "@/components/vendor/VendorKycStepper";
import NoShippingDashboard from "@/components/vendor/dashboard/NoShippingDashboard";
import SendcloudDashboard from "@/components/vendor/dashboard/SendcloudDashboard";
import VendorMarketIntelStatusCard from "@/components/vendor/dashboard/VendorMarketIntelStatusCard";
import MediKongCommissionCard from "@/components/vendor/dashboard/MediKongCommissionCard";
import RevenueTrendCard from "@/components/vendor/dashboard/RevenueTrendCard";
import CustomerTypeBreakdownCard from "@/components/vendor/dashboard/CustomerTypeBreakdownCard";
import { useMoneyFormat } from "@/lib/money-format";

const today = new Date();
const dateStr = today.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

type PeriodKey = "day" | "week" | "month" | "custom";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  day: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  custom: "Période",
};

function computePeriod(
  key: PeriodKey,
  custom: { from: string; to: string },
): DashboardPeriod {
  const now = new Date();
  if (key === "day") {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    const e = new Date(now); e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }
  if (key === "week") {
    // Semaine ISO : lundi → dimanche
    const s = new Date(now);
    const day = (s.getDay() + 6) % 7; // 0 = lundi
    s.setDate(s.getDate() - day);
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }
  if (key === "custom" && (custom.from || custom.to)) {
    const s = custom.from ? new Date(custom.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    s.setHours(0, 0, 0, 0);
    const e = custom.to ? new Date(custom.to) : new Date(now);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }
  // month par défaut
  const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: s, end: e };
}

export default function VendorDashboard() {
  const { data: vendor } = useCurrentVendor();
  const [periodKey, setPeriodKey] = useState<PeriodKey>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const period = useMemo(
    () => computePeriod(periodKey, { from: customFrom, to: customTo }),
    [periodKey, customFrom, customTo],
  );

  const { data: kpis } = useVendorDashboardKpis(vendor?.id, period);
  const { data: monthly, isLoading: monthlyLoading } = useVendorMonthlyDashboard(vendor?.id, period);
  const { data: gmvProgress } = useVendorGmvProgress(vendor?.id);
  const { formatMoney } = useMoneyFormat();

  const isApproved = vendor?.validation_status === "approved";
  const shippingMode = (vendor as any)?.vendor_shipping_mode ?? "no_shipping";

  const activeOffers = kpis?.activeOffers ?? 0;
  const ordersCount = monthly?.ordersCount ?? 0;
  // CA HTVA (source unique : order_lines facturables, exprimés en cents)
  const revenueEur = (monthly?.revenueExclVatCents ?? 0) / 100;
  const marginEur = (monthly?.grossMarginCents ?? 0) / 100;
  const marginPct =
    (monthly?.revenueExclVatCents ?? 0) > 0
      ? ((monthly?.grossMarginCents ?? 0) / (monthly!.revenueExclVatCents)) * 100
      : 0;
  const forecastRevenueEur = ((kpis as any)?.forecastRevenueCents ?? 0) / 100;
  const forecastMarginEur = ((kpis as any)?.forecastMarginCents ?? 0) / 100;
  const forecastMarginPct = ((kpis as any)?.forecastMarginPct ?? 0);
  const forecastOrders = (kpis as any)?.forecastOrders ?? 0;

  const periodLabel = PERIOD_LABELS[periodKey];
  const rangeLabel = `${period.start.toLocaleDateString("fr-BE")} → ${period.end.toLocaleDateString("fr-BE")}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Tableau de bord</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5 capitalize">{dateStr}</p>
      </div>

      {/* Show KYC stepper if not yet approved */}
      {vendor && !isApproved && (
        <VendorKycStepper vendor={vendor} />
      )}

      {/* KPI Row — only show when approved */}
      {isApproved && (
        <>
          <VendorMarketIntelStatusCard />

          {/* Sélecteur de période */}
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setPeriodKey(k)}
                className="px-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors"
                style={{
                  backgroundColor: periodKey === k ? "#1B5BDA" : "#F1F5F9",
                  color: periodKey === k ? "#fff" : "#475569",
                }}
              >
                {PERIOD_LABELS[k]}
              </button>
            ))}
            {periodKey === "custom" && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-[12px] px-2 py-1 rounded border border-[#E2E8F0]"
                />
                <span className="text-[11px] text-[#8B95A5]">→</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-[12px] px-2 py-1 rounded border border-[#E2E8F0]"
                />
              </div>
            )}
            <span className="ml-1 text-[11px] text-[#8B95A5] tabular-nums">{rangeLabel}</span>
          </div>
          <p className="text-[11px] text-[#8B95A5]">
            CA HTVA &amp; GMV TTC : même source unique (<code>order_lines</code>) — exclut commandes prévisionnelles, de test, masquées, supprimées, annulées, refusées, rejetées, remboursées ou en échec.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <VStat
              label={`CA HTVA · ${periodLabel.toLowerCase()}`}
              value={revenueEur > 0 ? formatMoney(revenueEur, { fractionDigits: 0 }) : "0 EUR"}
              icon="Euro"
              color="#1B5BDA"
              sub={revenueEur > 0 ? "hors TVA, lignes facturables" : "aucune vente"}
            />
            <VStat
              label="Marge brute"
              value={marginEur !== 0 ? formatMoney(marginEur, { fractionDigits: 0 }) : "—"}
              icon="TrendingUp"
              color="#059669"
              sub={marginEur !== 0 ? `${marginPct.toFixed(1)}% du CA HTVA` : "prix d'achat manquant"}
            />
            <VStat
              label="Commandes"
              value={String(ordersCount)}
              icon="ShoppingCart"
              color="#7C3AED"
              sub={periodLabel.toLowerCase()}
            />
            <VStat
              label="Offres actives"
              value={String(activeOffers)}
              icon="Tag"
              color="#F59E0B"
              sub={activeOffers > 0 ? `${activeOffers} en ligne` : "aucune offre"}
            />
          </div>

          {(forecastRevenueEur > 0 || forecastOrders > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <VStat
                label="CA prévisionnel"
                value={forecastRevenueEur > 0 ? formatMoney(forecastRevenueEur, { fractionDigits: 0 }) : "0 EUR"}
                icon="CalendarClock"
                color="#7C3AED"
                sub={`${forecastOrders} commande${forecastOrders > 1 ? "s" : ""} (actives + converties)`}
              />
              <VStat
                label="Marge prévisionnelle"
                value={forecastMarginEur !== 0 ? formatMoney(forecastMarginEur, { fractionDigits: 0 }) : "—"}
                icon="TrendingUp"
                color="#7C3AED"
                sub={forecastMarginEur !== 0 ? `${forecastMarginPct.toFixed(1)}% du CA HTVA` : "prix d'achat manquant"}
              />
            </div>
          )}

          {/* Bloc GMV / Commission MediKong / Marge nette + jauge palier négocié */}
          <MediKongCommissionCard
            gmvCents={monthly?.gmvCents ?? 0}
            commissionCents={monthly?.commissionCents ?? 0}
            netMarginCents={monthly?.netMarginCents ?? 0}
            progress={gmvProgress ?? null}
            loading={monthlyLoading}
          />

          {/* Courbe CA + ventilation par profil client */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <RevenueTrendCard data={monthly?.dailySeries ?? []} loading={monthlyLoading} />
            </div>
            <CustomerTypeBreakdownCard
              data={monthly?.customerTypeBreakdown ?? []}
              loading={monthlyLoading}
            />
          </div>


          {/* Shipping section — adapts to vendor's shipping mode */}
          {vendor && (
            <div className="space-y-2">
              <h2 className="text-[15px] font-bold text-[#1D2530]">Logistique</h2>
              {shippingMode === "no_shipping" && (
                <NoShippingDashboard vendorId={vendor.id} />
              )}
              {shippingMode === "own_sendcloud" && (
                <SendcloudDashboard vendorId={vendor.id} />
              )}
              {shippingMode === "medikong_whitelabel" && (
                <SendcloudDashboard vendorId={vendor.id} showCostKpis />
              )}
            </div>
          )}

          {shippingMode === "no_shipping" && (
            <VCard>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Database size={48} className="text-[#CBD5E1] mb-4" />
                <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Bienvenue sur votre espace vendeur</h3>
                <p className="text-[13px] text-[#8B95A5] max-w-md">
                  Votre tableau de bord s'alimentera automatiquement dès que vous aurez des offres actives et des commandes.
                  Commencez par créer vos premières offres dans la section "Mes Offres".
                </p>
              </div>
            </VCard>
          )}
        </>
      )}
    </div>
  );
}
