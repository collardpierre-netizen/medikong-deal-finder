import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VStat } from "@/components/vendor/ui/VStat";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { Wifi, WifiOff, Package, TrendingUp } from "lucide-react";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  vendorId: string;
  showCostKpis?: boolean;
}

type ShipmentRow = {
  id: string;
  order_reference: string;
  recipient_name: string;
  carrier: string | null;
  status: string;
  tracking_number: string | null;
  cost_base_cents: number | null;
  cost_margin_cents: number | null;
  cost_total_cents: number | null;
  created_at: string;
};

export default function SendcloudDashboard({ vendorId, showCostKpis = false }: Props) {
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: shipments = [] } = useQuery({
    queryKey: ["vendor-shipments-30d", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("id, order_reference, recipient_name, carrier, status, tracking_number, cost_base_cents, cost_margin_cents, cost_total_cents, created_at")
        .eq("vendor_id", vendorId)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ShipmentRow[];
    },
  });

  const { data: credentials } = useQuery({
    queryKey: ["vendor-sc-creds", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_sendcloud_credentials")
        .select("is_connected, last_verified_at")
        .eq("vendor_id", vendorId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !showCostKpis, // only for own_sendcloud
  });

  // KPI calculations
  const monthShipments = shipments.filter((s) => s.created_at >= startOfMonth);
  const pending = monthShipments.filter((s) => ["pending", "created", "announced"].includes(s.status)).length;
  const delivered = monthShipments.filter((s) => s.status === "delivered").length;
  const deliveredRate = monthShipments.length > 0 ? Math.round((delivered / monthShipments.length) * 100) : 0;

  // Cost KPIs (whitelabel only)
  const spendCents = monthShipments.reduce((sum, s) => sum + (s.cost_total_cents ?? 0), 0);
  const spendEur = (spendCents / 100).toFixed(2);

  // Chart data — shipments per day over 30 days
  const chartData = (() => {
    const map = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      map.set(d, 0);
    }
    shipments.forEach((s) => {
      const d = format(new Date(s.created_at), "yyyy-MM-dd");
      if (map.has(d)) map.set(d, (map.get(d) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([date, count]) => ({
      date,
      label: format(new Date(date), "d MMM", { locale: fr }),
      shipments: count,
    }));
  })();

  const chartConfig = {
    shipments: { label: "Expéditions", color: "#1B5BDA" },
  };

  return (
    <div className="space-y-5">
      {/* Connection status for own_sendcloud */}
      {!showCostKpis && (
        <VCard className="flex items-center justify-between py-3 px-5">
          <div className="flex items-center gap-2 text-[13px]">
            {credentials?.is_connected ? (
              <>
                <Wifi size={16} className="text-[#059669]" />
                <span className="text-[#059669] font-medium">Sendcloud connecté</span>
              </>
            ) : (
              <>
                <WifiOff size={16} className="text-[#EF4343]" />
                <span className="text-[#EF4343] font-medium">Sendcloud déconnecté</span>
              </>
            )}
          </div>
          {credentials?.last_verified_at && (
            <span className="text-[11px] text-[#8B95A5]">
              Vérifié {format(new Date(credentials.last_verified_at), "d MMM yyyy HH:mm", { locale: fr })}
            </span>
          )}
        </VCard>
      )}

      {/* KPI row */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${showCostKpis ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-4`}>
        <VStat label="Expéditions ce mois" value={monthShipments.length} icon="Package" color="#1B5BDA" sub="total" />
        <VStat label="En attente" value={pending} icon="Clock" color="#F59E0B" sub="à traiter" />
        <VStat label="Taux livraison" value={`${deliveredRate}%`} icon="CheckCircle" color="#059669" sub={`${delivered} livrées`} />
        <VStat label="Total 30j" value={shipments.length} icon="TrendingUp" color="#7C3AED" sub="expéditions" />
        {showCostKpis && (
          <VStat label="Dépense du mois" value={`${spendEur} €`} icon="Euro" color="#EF4343" sub="shipping" />
        )}
      </div>

      {/* Chart */}
      <VCard>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-[#1B5BDA]" />
          <h3 className="text-[13px] font-bold text-[#1D2530]">Expéditions / jour (30 derniers jours)</h3>
        </div>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-[#E2E8F0]" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#8B95A5" }}
              interval={4}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#8B95A5" }}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="shipments"
              stroke="var(--color-shipments)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </VCard>

      {/* Recent shipments table */}
      <VCard>
        <h3 className="text-[13px] font-bold text-[#1D2530] mb-3">Expéditions récentes</h3>
        {shipments.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Package size={36} className="text-[#CBD5E1] mb-3" />
            <p className="text-[13px] text-[#8B95A5]">Aucune expédition ces 30 derniers jours</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-left text-[11px] uppercase text-[#616B7C] tracking-wide">
                  <th className="pb-2 pr-3">Réf.</th>
                  <th className="pb-2 pr-3">Destinataire</th>
                  <th className="pb-2 pr-3">Transporteur</th>
                  <th className="pb-2 pr-3">Statut</th>
                  <th className="pb-2 pr-3">Suivi</th>
                  {showCostKpis && <th className="pb-2 pr-3 text-right">Coût</th>}
                  <th className="pb-2 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {shipments.slice(0, 20).map((s) => (
                  <tr key={s.id} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-[#1D2530]">{s.order_reference}</td>
                    <td className="py-2.5 pr-3 text-[#616B7C]">{s.recipient_name}</td>
                    <td className="py-2.5 pr-3 text-[#616B7C]">{s.carrier ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-2.5 pr-3 text-[#8B95A5] font-mono text-[11px]">
                      {s.tracking_number || "—"}
                    </td>
                    {showCostKpis && (
                      <td className="py-2.5 pr-3 text-right text-[#1D2530]">
                        {s.cost_total_cents ? `${(s.cost_total_cents / 100).toFixed(2)} €` : "—"}
                      </td>
                    )}
                    <td className="py-2.5 text-right text-[#8B95A5]">
                      {format(new Date(s.created_at), "d MMM", { locale: fr })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </VCard>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: "green" | "amber" | "red" | "blue" | "gray"; label: string }> = {
    pending: { color: "gray", label: "En attente" },
    created: { color: "blue", label: "Créé" },
    announced: { color: "blue", label: "Annoncé" },
    in_transit: { color: "amber", label: "En transit" },
    delivered: { color: "green", label: "Livré" },
    exception: { color: "red", label: "Exception" },
    cancelled: { color: "gray", label: "Annulé" },
  };
  const s = map[status] ?? { color: "gray" as const, label: status };
  return <VBadge color={s.color}>{s.label}</VBadge>;
}
