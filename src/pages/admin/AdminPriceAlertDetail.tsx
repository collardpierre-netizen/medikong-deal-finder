import { useParams, useNavigate } from "react-router-dom";
import { usePriceAlertDetail, useUpdateAlertStatus } from "@/hooks/usePriceAlerts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bell, CheckCircle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const severityConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  info: { label: "Info", color: "#F59E0B", bg: "#FFFBEB", icon: "⚠️" },
  warning: { label: "Warning", color: "#F97316", bg: "#FFF7ED", icon: "🔶" },
  critical: { label: "Critique", color: "#EF4444", bg: "#FEF2F2", icon: "🔴" },
};

export default function AdminPriceAlertDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = usePriceAlertDetail(id);
  const updateStatus = useUpdateAlertStatus();

  // Price history for chart
  const { data: priceHistory = [] } = useQuery({
    queryKey: ["price-history-chart", data?.alert?.product_id],
    enabled: !!data?.alert?.product_id,
    queryFn: async () => {
      const { data: ph } = await supabase
        .from("price_history")
        .select("recorded_at, price_excl_vat")
        .eq("product_id", data!.alert.product_id)
        .order("recorded_at", { ascending: true })
        .limit(90);
      return (ph || []).map((p: any) => ({
        date: format(new Date(p.recorded_at), "dd/MM", { locale: fr }),
        prix_medikong: Number(p.price_excl_vat),
      }));
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#8B95A5]" />
      </div>
    );
  }

  const { alert, vendors, notifications, adjustments } = data;
  const sev = severityConfig[alert.severity] || severityConfig.info;

  const handleMarkInProgress = () => {
    updateStatus.mutate({ id: alert.id, status: "in_progress" });
    toast.success("Statut mis à jour");
  };

  const handleResolve = () => {
    updateStatus.mutate({ id: alert.id, status: "resolved" });
    toast.success("Alerte résolue");
  };

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/price-alerts")} className="mt-1">
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {alert.product?.image_url && (
              <img src={alert.product.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#E2E8F0]" />
            )}
            <div>
              <h1 className="text-lg font-bold" style={{ color: "#1D2530" }}>
                {alert.product?.name || "—"}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[12px]" style={{ color: "#8B95A5" }}>GTIN: {alert.product?.gtin || "—"}</span>
                <span className="text-[12px]" style={{ color: "#8B95A5" }}>Marque: {alert.product?.brand_name || "—"}</span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: sev.bg, color: sev.color }}
                >
                  {sev.icon} {sev.label}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alert.status !== "in_progress" && alert.status !== "resolved" && (
            <Button variant="outline" size="sm" onClick={handleMarkInProgress}>
              En cours de traitement
            </Button>
          )}
          {alert.status !== "resolved" && alert.status !== "auto_resolved" && (
            <Button size="sm" onClick={handleResolve}>
              <CheckCircle size={14} className="mr-1.5" /> Résoudre
            </Button>
          )}
        </div>
      </div>

      {/* Price comparison cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-5">
          <p className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>Meilleur prix MediKong</p>
          <p className="text-[22px] font-bold mt-1" style={{ color: "#1D2530" }}>{alert.best_medikong_price.toFixed(2)} €</p>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-5">
          <p className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>Prix de référence</p>
          <p className="text-[22px] font-bold mt-1" style={{ color: "#10B981" }}>{alert.reference_price.toFixed(2)} €</p>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-5">
          <p className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>Écart</p>
          <p className="text-[22px] font-bold mt-1" style={{ color: "#EF4444" }}>
            +{alert.gap_percentage.toFixed(1)}% <span className="text-[14px] font-normal">(+{alert.gap_amount.toFixed(2)} €)</span>
          </p>
        </div>
      </div>

      {/* Price chart */}
      {priceHistory.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-5">
          <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Évolution des prix</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8B95A5" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8B95A5" }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="prix_medikong" stroke="#2563EB" name="Prix MediKong" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Vendors table */}
      <div className="bg-white border border-[#E2E8F0] rounded-[10px] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="text-[14px] font-bold" style={{ color: "#1D2530" }}>
            Vendeurs concernés ({vendors.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E2E8F0]" style={{ backgroundColor: "#F8FAFC" }}>
                <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Vendeur</th>
                <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Prix actuel</th>
                <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Écart vs réf.</th>
                <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Prix suggéré</th>
                <th className="text-center px-4 py-3 font-medium text-[#616B7C]">Notifié</th>
                <th className="text-center px-4 py-3 font-medium text-[#616B7C]">Ajusté</th>
                <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Action</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 font-medium" style={{ color: "#1D2530" }}>
                    {v.vendor?.display_code || v.vendor?.company_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: "#1D2530" }}>
                    {v.vendor_price.toFixed(2)} €
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: "#EF4444" }}>
                    +{v.vendor_gap_percentage.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: "#10B981" }}>
                    {v.suggested_price ? `${v.suggested_price.toFixed(2)} €` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {v.notification_sent ? (
                      <span className="text-[#10B981]">✓</span>
                    ) : (
                      <span className="text-[#CBD5E1]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {v.price_adjusted ? (
                      <div className="text-center">
                        <span className="text-[#10B981] font-semibold">✓</span>
                        <p className="text-[10px] text-[#8B95A5]">{v.old_price?.toFixed(2)} → {v.new_price?.toFixed(2)} €</p>
                      </div>
                    ) : (
                      <span className="text-[#CBD5E1]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[12px]"
                      onClick={() => toast.success("Notification envoyée")}
                    >
                      <Send size={12} className="mr-1" /> Notifier
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment history */}
      {adjustments.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0]">
            <h3 className="text-[14px] font-bold" style={{ color: "#1D2530" }}>
              Historique des ajustements
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0]" style={{ backgroundColor: "#F8FAFC" }}>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Ancien prix</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Nouveau prix</th>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Déclencheur</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((adj: any) => (
                  <tr key={adj.id} className="border-b border-[#E2E8F0]">
                    <td className="px-4 py-3 text-[#616B7C]">
                      {format(new Date(adj.adjusted_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: "#EF4444" }}>
                      {Number(adj.old_price).toFixed(2)} €
                    </td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: "#10B981" }}>
                      {Number(adj.new_price).toFixed(2)} €
                    </td>
                    <td className="px-4 py-3 text-[#616B7C] capitalize">{adj.trigger?.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notifications history */}
      {notifications.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0]">
            <h3 className="text-[14px] font-bold" style={{ color: "#1D2530" }}>
              Historique des notifications ({notifications.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0]" style={{ backgroundColor: "#F8FAFC" }}>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Canal</th>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Envoyé par</th>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Lu</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n: any) => (
                  <tr key={n.id} className="border-b border-[#E2E8F0]">
                    <td className="px-4 py-3 text-[#616B7C]">
                      {format(new Date(n.sent_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </td>
                    <td className="px-4 py-3 capitalize text-[#616B7C]">{n.channel}</td>
                    <td className="px-4 py-3 capitalize text-[#616B7C]">{n.sent_by}</td>
                    <td className="px-4 py-3">{n.read_at ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
