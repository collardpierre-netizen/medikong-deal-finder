import { useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, Users, Package, Globe2, Building2, AlertTriangle, Loader2, Info } from "lucide-react";
import { useImpersonation } from "@/contexts/impersonation";
import { useSearchParams } from "react-router-dom";
import { fmtEur } from "@/lib/format-currency";
import {
  useVendorAnalyticsKpis,
  useVendorAnalyticsByCustomerType,
  useVendorAnalyticsByCountry,
  useVendorAnalyticsTopCustomers,
  useVendorAnalyticsTopProducts,
  type AnalyticsPeriod,
} from "@/hooks/useVendorAnalytics";

import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useVendorAnalyticsCustomerLocations } from "@/hooks/useVendorAnalyticsRecurrence";
import { RecurrencePanel } from "@/components/vendor/analytics/RecurrencePanel";
import { CustomerMap } from "@/components/vendor/analytics/CustomerMap";
import { SellOutPanel } from "@/components/vendor/analytics/SellOutPanel";
import { AnalyticsExportButtons } from "@/components/vendor/analytics/AnalyticsExportButtons";
import { exportAnalyticsRows } from "@/lib/analytics-export";

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "12m", label: "12 mois" },
  { value: "ytd", label: "Année en cours" },
];

const TABS = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "typology", label: "Typologie clients" },
  { key: "recurrence", label: "Récurrence & cohortes" },
  { key: "customers", label: "Top clients" },
  { key: "map", label: "Carte clients" },
  { key: "products", label: "Top produits" },
  { key: "sellout", label: "Sell-in vs Sell-out" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  retail: "Retail",
  pharmacy: "Pharmacie",
  wholesaler: "Grossiste",
  hospital: "Hôpital",
  nursing_home: "MR/MRS",
  clinic: "Cabinet",
  veterinary: "Vétérinaire",
  dentist: "Dentiste",
  other: "Autre",
  unknown: "Non renseigné",
};

const COUNTRY_LABEL: Record<string, string> = {
  BE: "Belgique",
  FR: "France",
  LU: "Luxembourg",
  NL: "Pays-Bas",
  DE: "Allemagne",
  UNK: "Non renseigné",
};

const cardStyle = "p-5 rounded-[10px] bg-white border border-[#E2E8F0]";

/**
 * Explicit state notice for vendor_analytics_* hooks.
 * Distinguishes: no vendor_id | loading | error | empty.
 * Returns null when the caller should render its normal content.
 */
function analyticsStateNotice({
  hasVendorId,
  isLoading,
  error,
  isEmpty,
  loadingLabel = "Chargement des données…",
  emptyLabel = "Aucune donnée sur la période.",
}: {
  hasVendorId: boolean;
  isLoading: boolean;
  error?: unknown;
  isEmpty: boolean;
  loadingLabel?: string;
  emptyLabel?: string;
}): React.ReactNode | null {
  if (!hasVendorId) {
    return (
      <div
        className="rounded-[10px] border px-4 py-3 flex items-start gap-2 text-[13px]"
        style={{ borderColor: "#DC2626", backgroundColor: "#FEF2F2", color: "#7F1D1D" }}
      >
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">Aucun vendor_id résolu</div>
          <div className="text-[12px] mt-0.5">
            Les RPC <code className="font-mono">vendor_analytics_*</code> ne sont pas appelés (paramètre <code className="font-mono">_vendor_id</code> manquant).
            Vérifiez que vous êtes connecté en tant que vendeur, ou passez en mode impersonation via
            <code className="font-mono"> ?impersonation_vendor_id=…</code>.
          </div>
        </div>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className={`${cardStyle} py-8 flex items-center justify-center gap-2 text-[13px] text-[#616B7C]`}>
        <Loader2 size={16} className="animate-spin" />
        <span>{loadingLabel}</span>
      </div>
    );
  }
  if (error) {
    const message = (error as { message?: string })?.message ?? String(error);
    return (
      <div
        className="rounded-[10px] border px-4 py-3 flex items-start gap-2 text-[13px]"
        style={{ borderColor: "#DC2626", backgroundColor: "#FEF2F2", color: "#7F1D1D" }}
      >
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="font-semibold">Erreur lors de la récupération des données</div>
          <div className="text-[12px] mt-0.5 font-mono break-all">{message}</div>
        </div>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div
        className="rounded-[10px] border px-4 py-3 flex items-start gap-2 text-[13px]"
        style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC", color: "#616B7C" }}
      >
        <Info size={16} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold text-[#1D2530]">{emptyLabel}</div>
          <div className="text-[12px] mt-0.5">
            Le RPC a répondu correctement mais n'a retourné aucune ligne pour ce vendor_id et cette période.
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function pctDelta(cur: number, prev: number): number | null {
  if (!prev || prev === 0) return cur > 0 ? 100 : null;
  return ((cur - prev) / prev) * 100;
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[#8B95A5]">
        <Minus size={12} /> —
      </span>
    );
  }
  const up = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium"
      style={{ color: up ? "#047857" : "#B91C1C" }}
    >
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {value >= 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

function KpiTile({
  label,
  value,
  prev,
  format,
  icon,
}: {
  label: string;
  value: number;
  prev: number;
  format: "eur" | "int";
  icon: React.ReactNode;
}) {
  const display = format === "eur" ? `${fmtEur(value / 100)} €` : value.toLocaleString("fr-FR");
  return (
    <div className={cardStyle}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[#8B95A5]">{label}</span>
        <span className="text-[#8B95A5]">{icon}</span>
      </div>
      <div className="text-[22px] font-bold text-[#1D2530] leading-tight">{display}</div>
      <div className="mt-1">
        <DeltaBadge value={pctDelta(value, prev)} />
        <span className="text-[10px] text-[#8B95A5] ml-1">vs période précédente</span>
      </div>
    </div>
  );
}

function OverviewTab({ period, vendorId }: { period: AnalyticsPeriod; vendorId: string | null }) {
  const { data, isLoading, error } = useVendorAnalyticsKpis(period);
  const notice = analyticsStateNotice({
    hasVendorId: !!vendorId,
    isLoading,
    error,
    isEmpty: !!data && Number(data.orders_count) === 0 && Number(data.ca_htva_cents) === 0,
    loadingLabel: "Chargement des KPIs…",
    emptyLabel: "Aucune commande sur la période.",
  });
  if (notice) return <>{notice}</>;
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <KpiTile label="CA HTVA" value={Number(data.ca_htva_cents)} prev={Number(data.prev_ca_htva_cents)} format="eur" icon={<TrendingUp size={14} />} />
      <KpiTile label="Marge nette" value={Number(data.margin_cents)} prev={Number(data.prev_margin_cents)} format="eur" icon={<TrendingUp size={14} />} />
      <KpiTile label="Commission MediKong" value={Number(data.commission_cents)} prev={Number(data.prev_commission_cents)} format="eur" icon={<TrendingUp size={14} />} />
      <KpiTile label="Commandes" value={Number(data.orders_count)} prev={Number(data.prev_orders_count)} format="int" icon={<Package size={14} />} />
      <KpiTile label="Clients actifs" value={Number(data.active_customers)} prev={Number(data.prev_active_customers)} format="int" icon={<Users size={14} />} />
      <KpiTile label="Panier moyen" value={Number(data.avg_basket_cents)} prev={Number(data.prev_avg_basket_cents)} format="eur" icon={<TrendingUp size={14} />} />
    </div>
  );
}

function ShareBar({ label, ca, share, extra }: { label: string; ca: number; share: number; extra?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-medium text-[#1D2530]">
          {label}
          {extra && <span className="text-[11px] text-[#8B95A5] ml-2">{extra}</span>}
        </span>
        <span className="text-[13px] tabular-nums text-[#1D2530]">
          {fmtEur(ca / 100)} €{" "}
          <span className="text-[11px] text-[#8B95A5] ml-1">({share.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-2 rounded bg-[#F1F5F9] overflow-hidden">
        <div className="h-full bg-[#1B5BDA] transition-all" style={{ width: `${Math.min(100, share)}%` }} />
      </div>
    </div>
  );
}

function TypologyTab({ period, vendorId }: { period: AnalyticsPeriod; vendorId: string | null }) {
  const { data: byType = [], isLoading: l1, error: e1 } = useVendorAnalyticsByCustomerType(period);
  const { data: byCountry = [], isLoading: l2, error: e2 } = useVendorAnalyticsByCountry(period);
  const globalNotice = analyticsStateNotice({
    hasVendorId: !!vendorId,
    isLoading: false,
    error: e1 ?? e2,
    isEmpty: !l1 && !l2 && byType.length === 0 && byCountry.length === 0,
    emptyLabel: "Aucune commande sur la période.",
  });
  if (globalNotice) return <>{globalNotice}</>;

  const typeRows = byType.map((r) => ({
    profil: CUSTOMER_TYPE_LABEL[r.customer_type] ?? r.customer_type,
    ca_htva_eur: Number((Number(r.ca_htva_cents) / 100).toFixed(2)),
    part_pct: Number(Number(r.share).toFixed(2)),
    commandes: Number(r.orders_count),
  }));
  const countryRows = byCountry.map((r) => ({
    pays: COUNTRY_LABEL[r.country_code] ?? r.country_code,
    code_pays: r.country_code,
    ca_htva_eur: Number((Number(r.ca_htva_cents) / 100).toFixed(2)),
    part_pct: Number(Number(r.share).toFixed(2)),
    commandes: Number(r.orders_count),
  }));
  const doExportType = (fmt: "csv" | "xlsx") =>
    exportAnalyticsRows(typeRows, `medikong-analytics-typologie-${period}`, fmt, "Typologie");
  const doExportCountry = (fmt: "csv" | "xlsx") =>
    exportAnalyticsRows(countryRows, `medikong-analytics-pays-${period}`, fmt, "Pays");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className={cardStyle}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-[#8B95A5]" />
            <h3 className="text-[14px] font-semibold text-[#1D2530]">Par typologie de client</h3>
          </div>
          <AnalyticsExportButtons
            disabled={typeRows.length === 0}
            onCsv={() => doExportType("csv")}
            onXlsx={() => doExportType("xlsx")}
          />
        </div>
        <p className="text-[11px] text-[#8B95A5] mb-4">Part du CA HTVA par profil</p>
        {l1 ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 animate-pulse bg-[#F1F5F9] rounded" />)}</div>
        ) : byType.length === 0 ? (
          <p className="text-[13px] text-[#8B95A5] py-8 text-center">Aucune commande sur la période</p>
        ) : (
          <div className="space-y-3">
            {byType.map((r) => (
              <ShareBar
                key={r.customer_type}
                label={CUSTOMER_TYPE_LABEL[r.customer_type] ?? r.customer_type}
                ca={Number(r.ca_htva_cents)}
                share={Number(r.share)}
                extra={`${r.orders_count} cmd`}
              />
            ))}
          </div>
        )}
      </div>

      <div className={cardStyle}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <Globe2 size={14} className="text-[#8B95A5]" />
            <h3 className="text-[14px] font-semibold text-[#1D2530]">Par pays</h3>
          </div>
          <AnalyticsExportButtons
            disabled={countryRows.length === 0}
            onCsv={() => doExportCountry("csv")}
            onXlsx={() => doExportCountry("xlsx")}
          />
        </div>
        <p className="text-[11px] text-[#8B95A5] mb-4">Part du CA HTVA par pays de livraison</p>
        {l2 ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 animate-pulse bg-[#F1F5F9] rounded" />)}</div>
        ) : byCountry.length === 0 ? (
          <p className="text-[13px] text-[#8B95A5] py-8 text-center">Aucune commande sur la période</p>
        ) : (
          <div className="space-y-3">
            {byCountry.map((r) => (
              <ShareBar
                key={r.country_code}
                label={COUNTRY_LABEL[r.country_code] ?? r.country_code}
                ca={Number(r.ca_htva_cents)}
                share={Number(r.share)}
                extra={`${r.orders_count} cmd`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopCustomersTab({ period, vendorId }: { period: AnalyticsPeriod; vendorId: string | null }) {
  const { data = [], isLoading, error } = useVendorAnalyticsTopCustomers(period, 25);
  const notice = analyticsStateNotice({
    hasVendorId: !!vendorId,
    isLoading,
    error,
    isEmpty: data.length === 0,
    loadingLabel: "Chargement du top clients…",
    emptyLabel: "Aucun client sur la période.",
  });
  const exportRows = data.map((r) => ({
    client: r.company_name || "",
    profil: CUSTOMER_TYPE_LABEL[r.customer_type ?? "unknown"] ?? r.customer_type ?? "",
    code_postal: r.postal_code || "",
    ville: r.city || "",
    pays: r.country_code || "",
    ca_htva_eur: Number((Number(r.ca_htva_cents) / 100).toFixed(2)),
    part_pct: Number(Number(r.share).toFixed(2)),
    commandes: Number(r.orders_count),
    derniere_commande: r.last_order_at ? new Date(r.last_order_at).toISOString().slice(0, 10) : "",
  }));
  const doExport = (fmt: "csv" | "xlsx") =>
    exportAnalyticsRows(exportRows, `medikong-analytics-top-clients-${period}`, fmt, "Top clients");

  return (
    <div className={cardStyle}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-[14px] font-semibold text-[#1D2530]">Top clients (25)</h3>
        <AnalyticsExportButtons
          disabled={exportRows.length === 0}
          onCsv={() => doExport("csv")}
          onXlsx={() => doExport("xlsx")}
        />
      </div>
      <p className="text-[11px] text-[#8B95A5] mb-4">Classement par CA HTVA sur la période</p>
      {notice ? notice : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide text-[#8B95A5] border-b border-[#E2E8F0]">
              <tr>
                <th className="px-2 py-2 text-left">Client</th>
                <th className="px-2 py-2 text-left">Profil</th>
                <th className="px-2 py-2 text-left">Localisation</th>
                <th className="px-2 py-2 text-right">CA HTVA</th>
                <th className="px-2 py-2 text-right">Part</th>
                <th className="px-2 py-2 text-right">Cmd</th>
                <th className="px-2 py-2 text-right">Dernière</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.customer_id} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-2 py-2 font-medium text-[#1D2530]">{r.company_name || "—"}</td>
                  <td className="px-2 py-2 text-[#616B7C]">{CUSTOMER_TYPE_LABEL[r.customer_type ?? "unknown"] ?? r.customer_type}</td>
                  <td className="px-2 py-2 text-[#616B7C]">
                    {[r.postal_code, r.city].filter(Boolean).join(" ")} {r.country_code ? `· ${r.country_code}` : ""}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtEur(Number(r.ca_htva_cents) / 100)} €</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#8B95A5]">{Number(r.share).toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.orders_count}</td>
                  <td className="px-2 py-2 text-right text-[#8B95A5]">
                    {r.last_order_at ? new Date(r.last_order_at).toLocaleDateString("fr-FR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TopProductsTab({ period, vendorId }: { period: AnalyticsPeriod; vendorId: string | null }) {
  const { data = [], isLoading, error } = useVendorAnalyticsTopProducts(period, 25);
  const notice = analyticsStateNotice({
    hasVendorId: !!vendorId,
    isLoading,
    error,
    isEmpty: data.length === 0,
    loadingLabel: "Chargement du top produits…",
    emptyLabel: "Aucune vente sur la période.",
  });
  const exportRows = data.map((r) => ({
    produit: r.product_name || "",
    product_id: r.product_id ?? "",
    unites: Number(r.units),
    ca_htva_eur: Number((Number(r.ca_htva_cents) / 100).toFixed(2)),
    marge_eur: Number((Number(r.margin_cents) / 100).toFixed(2)),
    commission_eur: Number((Number(r.commission_cents) / 100).toFixed(2)),
  }));
  const doExport = (fmt: "csv" | "xlsx") =>
    exportAnalyticsRows(exportRows, `medikong-analytics-top-produits-${period}`, fmt, "Top produits");

  return (
    <div className={cardStyle}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-[14px] font-semibold text-[#1D2530]">Top produits (25)</h3>
        <AnalyticsExportButtons
          disabled={exportRows.length === 0}
          onCsv={() => doExport("csv")}
          onXlsx={() => doExport("xlsx")}
        />
      </div>
      <p className="text-[11px] text-[#8B95A5] mb-4">Classement par CA HTVA — unités vendues, marge et commission</p>
      {notice ? notice : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide text-[#8B95A5] border-b border-[#E2E8F0]">
              <tr>
                <th className="px-2 py-2 text-left">Produit</th>
                <th className="px-2 py-2 text-right">Unités</th>
                <th className="px-2 py-2 text-right">CA HTVA</th>
                <th className="px-2 py-2 text-right">Marge</th>
                <th className="px-2 py-2 text-right">Commission</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.product_id ?? Math.random()} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-2 py-2 font-medium text-[#1D2530]">{r.product_name || "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{Number(r.units).toLocaleString("fr-FR")}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtEur(Number(r.ca_htva_cents) / 100)} €</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#047857]">{fmtEur(Number(r.margin_cents) / 100)} €</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#8B95A5]">{fmtEur(Number(r.commission_cents) / 100)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MapTab({ period, vendorId }: { period: AnalyticsPeriod; vendorId: string | null }) {
  const [productId, setProductId] = useState<string>("");
  const [minCa, setMinCa] = useState<string>("");
  const [minOrders, setMinOrders] = useState<string>("");

  const { data: products = [] } = useVendorAnalyticsTopProducts(period, 100);
  const { data: allRows = [], isLoading, error } = useVendorAnalyticsCustomerLocations(
    period,
    productId || null
  );

  const minCaCents = Math.max(0, Number(minCa) || 0) * 100;
  const minOrdersNum = Math.max(0, Number(minOrders) || 0);

  const filtered = useMemo(
    () =>
      allRows.filter(
        (r) =>
          r.ca_htva_cents >= minCaCents && Number(r.orders_count) >= minOrdersNum
      ),
    [allRows, minCaCents, minOrdersNum]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-[10px] border border-[#E2E8F0] bg-white">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-[#616B7C] font-medium">Produit</label>
          <select
            className="h-9 px-2 rounded-md border border-[#E2E8F0] text-[13px] bg-white min-w-[220px]"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Tous les produits</option>
            {products.map((p) => (
              <option key={p.product_id ?? "unk"} value={p.product_id ?? ""}>
                {p.product_name || "—"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-[#616B7C] font-medium">CA HTVA min (€)</label>
          <input
            type="number"
            min={0}
            step={100}
            className="h-9 px-2 rounded-md border border-[#E2E8F0] text-[13px] w-32"
            value={minCa}
            onChange={(e) => setMinCa(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-[#616B7C] font-medium">Commandes min</label>
          <input
            type="number"
            min={0}
            step={1}
            className="h-9 px-2 rounded-md border border-[#E2E8F0] text-[13px] w-28"
            value={minOrders}
            onChange={(e) => setMinOrders(e.target.value)}
            placeholder="0"
          />
        </div>
        {(productId || minCa || minOrders) && (
          <button
            type="button"
            onClick={() => {
              setProductId("");
              setMinCa("");
              setMinOrders("");
            }}
            className="h-9 px-3 rounded-md border border-[#E2E8F0] text-[12px] text-[#616B7C] hover:bg-[#F8FAFC]"
          >
            Réinitialiser
          </button>
        )}
        <div className="ml-auto text-[12px] text-[#616B7C]">
          {filtered.length} zone{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
          {filtered.length !== allRows.length ? ` sur ${allRows.length}` : ""}
        </div>
      </div>

      {(() => {
        const notice = analyticsStateNotice({
          hasVendorId: !!vendorId,
          isLoading,
          error,
          isEmpty: allRows.length === 0,
          loadingLabel: "Chargement des localisations…",
          emptyLabel: "Aucune localisation client sur la période.",
        });
        if (notice) return notice;
        if (filtered.length === 0) {
          return (
            <div className={`${cardStyle} py-12 text-center text-[13px] text-[#8B95A5]`}>
              Aucune localisation client à afficher pour ces filtres.
            </div>
          );
        }
        return (
          <>
            <CustomerMap rows={filtered} />
            <p className="text-[11px] text-[#8B95A5]">
              Taille des cercles proportionnelle au CA HTVA. Couleur selon la couverture (vert : forte, orange : moyenne, rouge : faible — tertiles du CA affiché). Géocodage OpenStreetMap.
            </p>
          </>
        );
      })()}
    </div>
  );
}

export default function VendorAnalytics() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [tab, setTab] = useState<TabKey>("overview");
  const { data: vendor } = useCurrentVendor();
  const { state: impState } = useImpersonation();
  const [searchParams] = useSearchParams();
  const impersonationVendorIdFromUrl = searchParams.get("impersonation_vendor_id");
  const isImpersonating =
    (impState.isImpersonating && impState.session?.target_type === "vendor") ||
    !!impersonationVendorIdFromUrl;
  const impersonationSource = impersonationVendorIdFromUrl
    ? "URL (?impersonation_vendor_id)"
    : impState.isImpersonating
      ? "Session admin"
      : null;

  const rangeLabel = useMemo(() => PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "", [period]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1D2530]">Analytics ventes</h1>
          <p className="text-[13px] text-[#616B7C] mt-0.5">
            Outil d'analyse — KPIs, typologie, récurrence, carte et sell-out · <span className="font-medium">{rangeLabel}</span>
          </p>
        </div>
        <div className="inline-flex rounded-[8px] border border-[#E2E8F0] bg-white p-0.5" role="tablist" aria-label="Période">
          {PERIOD_OPTIONS.map((opt) => {
            const active = opt.value === period;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(opt.value)}
                className="px-3 py-1.5 text-[12px] font-medium rounded-[6px] transition-colors"
                style={{ backgroundColor: active ? "#1B5BDA" : "transparent", color: active ? "#fff" : "#616B7C" }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-[8px] border px-3 py-2 text-[12px] flex flex-wrap items-center gap-x-4 gap-y-1"
        style={{
          borderColor: isImpersonating ? "#F59E0B" : "#E2E8F0",
          backgroundColor: isImpersonating ? "#FFFBEB" : "#F8FAFC",
          color: "#1D2530",
        }}
      >
        <span className="font-semibold uppercase tracking-wide text-[10px] text-[#616B7C]">
          Debug analytics
        </span>
        <span>
          <span className="text-[#616B7C]">Vendor ciblé :</span>{" "}
          <span className="font-medium">{vendor?.name || vendor?.company_name || "—"}</span>
        </span>
        <span>
          <span className="text-[#616B7C]">vendor_id :</span>{" "}
          <code className="font-mono text-[11px] bg-white border border-[#E2E8F0] rounded px-1 py-0.5">
            {vendor?.id ?? "null"}
          </code>
        </span>
        <span>
          <span className="text-[#616B7C]">Impersonation :</span>{" "}
          <span className="font-medium" style={{ color: isImpersonating ? "#B45309" : "#047857" }}>
            {isImpersonating ? `oui (${impersonationSource})` : "non"}
          </span>
        </span>
      </div>



      <div className="border-b border-[#E2E8F0] flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="px-4 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors -mb-px"
              style={{
                borderColor: active ? "#1B5BDA" : "transparent",
                color: active ? "#1B5BDA" : "#616B7C",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab period={period} vendorId={vendor?.id ?? null} />}
      {tab === "typology" && <TypologyTab period={period} vendorId={vendor?.id ?? null} />}
      {tab === "recurrence" && <RecurrencePanel period={period} />}
      {tab === "customers" && <TopCustomersTab period={period} vendorId={vendor?.id ?? null} />}
      {tab === "map" && <MapTab period={period} vendorId={vendor?.id ?? null} />}
      {tab === "products" && <TopProductsTab period={period} vendorId={vendor?.id ?? null} />}
      {tab === "sellout" && <SellOutPanel vendorId={vendor?.id ?? null} />}
    </div>
  );
}
