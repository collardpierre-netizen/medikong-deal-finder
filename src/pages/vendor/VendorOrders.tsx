import { useState } from "react";
import { VCard } from "@/components/vendor/ui/VCard";
import { VTabBar } from "@/components/vendor/ui/VTabBar";
import { VStat } from "@/components/vendor/ui/VStat";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VProductIcon } from "@/components/vendor/ui/VProductIcon";
import { vendorOrders, orderAge } from "@/data/vendor-offers-mock";
import { buyerTypeColors } from "@/lib/vendor-tokens";
import { Clock, ArrowRight, AlertTriangle, Info } from "lucide-react";
import OrderDetailPopup from "@/components/vendor/OrderDetailPopup";

const statusLabels: Record<string, string> = { pending: "En attente", confirmed: "Confirmee", shipped: "Expediee", delivered: "Livree", dispute: "Litige" };
const statusColors: Record<string, string> = { pending: "#F59E0B", confirmed: "#1B5BDA", shipped: "#7C3AED", delivered: "#059669", dispute: "#EF4343" };
const kanbanStatuses = ["pending", "confirmed", "shipped", "delivered", "dispute"] as const;
const kanbanIcons = { pending: "Clock", confirmed: "CheckCircle", shipped: "Truck", delivered: "PackageCheck", dispute: "AlertTriangle" };

export default function VendorOrders() {
  const [activeTab, setActiveTab] = useState("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  const totalCA = vendorOrders.reduce((s, o) => s + o.totalTTC, 0);
  const inProgress = vendorOrders.filter(o => ["pending", "confirmed", "shipped"].includes(o.status)).length;
  const disputes = vendorOrders.filter(o => o.status === "dispute").length;

  const tabs = [
    { id: "list", label: "Toutes les commandes", badge: vendorOrders.length },
    { id: "kanban", label: "Pipeline Kanban" },
    { id: "disputes", label: "Retours & Litiges", badge: disputes },
  ];

  const filtered = statusFilter === "all" ? vendorOrders : vendorOrders.filter(o => o.status === statusFilter);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-[#1D2530]">Commandes</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <VStat label="Commandes (mois)" value={vendorOrders.length} icon="ShoppingCart" color="#1B5BDA" trend={12} />
        <VStat label="CA mois" value={`${totalCA.toLocaleString("fr-BE", { minimumFractionDigits: 2 })} EUR`} icon="Euro" color="#059669" trend={8.3} />
        <VStat label="En cours" value={inProgress} icon="Loader" color="#7C3AED" />
        <VStat label="Litiges" value={disputes} icon="AlertTriangle" color="#EF4343" />
      </div>

      <VTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* LIST TAB */}
      {activeTab === "list" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {["all", ...kanbanStatuses].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${statusFilter === s ? "bg-[#1B5BDA] text-white" : "bg-[#F1F5F9] text-[#616B7C] hover:bg-[#E2E8F0]"}`}>
                {s === "all" ? "Toutes" : statusLabels[s]} ({s === "all" ? vendorOrders.length : vendorOrders.filter(o => o.status === s).length})
              </button>
            ))}
          </div>

          <VCard className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                    <th className="text-left py-2.5 px-3 font-medium">Ref</th>
                    <th className="text-left py-2.5 px-3 font-medium">Acheteur</th>
                    <th className="text-left py-2.5 px-3 font-medium">Type</th>
                    <th className="text-right py-2.5 px-3 font-medium">Total TTC</th>
                    <th className="text-left py-2.5 px-3 font-medium">Statut</th>
                    <th className="text-left py-2.5 px-3 font-medium">Anciennete</th>
                    <th className="text-right py-2.5 px-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => {
                    const age = orderAge(o.dateTs);
                    const bt = buyerTypeColors[o.buyerType] || { text: "#616B7C", bg: "#616B7C18" };
                    return (
                      <tr key={o.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] cursor-pointer transition-colors" onClick={() => setSelectedOrder(o.id)}>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#8B95A5]">{o.id}</td>
                        <td className="py-2.5 px-3 font-medium text-[#1D2530]">{o.buyer}</td>
                        <td className="py-2.5 px-3"><VBadge color={bt.text} bg={bt.bg}>{o.buyerType}</VBadge></td>
                        <td className="py-2.5 px-3 text-right font-medium">{o.totalTTC.toLocaleString("fr-BE", { minimumFractionDigits: 2 })} EUR</td>
                        <td className="py-2.5 px-3"><VBadge color={statusColors[o.status]}>{statusLabels[o.status]}</VBadge></td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: age.color }} />
                            <span className="text-[11px] font-medium" style={{ color: age.color }}>{age.label}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right"><ArrowRight size={14} className="text-[#CBD5E1]" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </VCard>
        </div>
      )}

      {/* KANBAN TAB */}
      {activeTab === "kanban" && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {kanbanStatuses.map(status => {
            const orders = vendorOrders.filter(o => o.status === status).sort((a, b) => a.dateTs - b.dateTs);
            return (
              <div key={status} className="min-w-[260px] flex-1">
                <div className="rounded-t-lg border-t-[3px] bg-white border border-[#E2E8F0]" style={{ borderTopColor: statusColors[status] }}>
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#E2E8F0]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[status] }} />
                    <span className="text-[12px] font-semibold text-[#1D2530]">{statusLabels[status]}</span>
                    <VBadge color={statusColors[status]}>{orders.length}</VBadge>
                  </div>
                  <div className="p-2 space-y-2 min-h-[200px]">
                    {orders.map(o => {
                      const age = orderAge(o.dateTs);
                      const bt = buyerTypeColors[o.buyerType] || { text: "#616B7C", bg: "#616B7C18" };
                      return (
                        <div key={o.id} onClick={() => setSelectedOrder(o.id)}
                          className={`bg-[#F8FAFC] rounded-lg p-3 border cursor-pointer hover:shadow-sm transition-shadow ${age.urgency === "urgent" ? "border-[#EF4343]" : "border-[#E2E8F0]"}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-mono text-[10px] text-[#8B95A5]">{o.id}</span>
                            <VBadge color={age.color}>{age.label}</VBadge>
                          </div>
                          <p className="text-[12px] font-semibold text-[#1D2530]">{o.buyer}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <VBadge color={bt.text} bg={bt.bg} className="!text-[9px]">{o.buyerType}</VBadge>
                            <span className="text-[11px] font-medium text-[#1D2530]">{o.totalTTC.toLocaleString("fr-BE", { minimumFractionDigits: 2 })} EUR</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-[#8B95A5]">
                            <span>{o.lines.length} art.</span>
                            {o.tracking && <span>{o.tracking.carrier}</span>}
                          </div>
                          {status === "pending" && <VBtn small primary className="mt-2 w-full !justify-center">Confirmer</VBtn>}
                          {status === "confirmed" && <VBtn small primary className="mt-2 w-full !justify-center">Expedier</VBtn>}
                          {status === "shipped" && <VBtn small className="mt-2 w-full !justify-center">Marquer livre</VBtn>}
                        </div>
                      );
                    })}
                    {orders.length === 0 && <p className="text-[11px] text-[#CBD5E1] text-center py-8">Aucune commande</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DISPUTES TAB */}
      {activeTab === "disputes" && (
        <div className="space-y-4">
          {vendorOrders.filter(o => o.status === "dispute").map(o => (
            <VCard key={o.id} className="!border-l-4 !border-l-[#EF4343]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-semibold text-[#1D2530]">Litige #{o.id}</p>
                  <p className="text-[11px] text-[#8B95A5]">Motif : Produit non conforme a la description — {o.buyer}</p>
                </div>
                <VBadge color="#EF4343">Litige ouvert</VBadge>
              </div>
              <div className="flex gap-2 mt-3">
                <VBtn small primary>Proposer remplacement</VBtn>
                <VBtn small>Contester</VBtn>
                <VBtn small onClick={() => setSelectedOrder(o.id)}>Voir la commande</VBtn>
              </div>
            </VCard>
          ))}

          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Indicateur de performance</h3>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-2xl font-bold text-[#1D2530]">1,2%</p>
                <p className="text-[11px] text-[#8B95A5]">Taux de litige</p>
              </div>
              <div className="text-[12px] text-[#616B7C]">Objectif : &lt;2%</div>
              <VBadge color="#059669">Conforme</VBadge>
            </div>
          </VCard>
        </div>
      )}

      {selectedOrder && <OrderDetailPopup orderId={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
}
