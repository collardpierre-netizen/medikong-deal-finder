import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, MessageSquare, Clock, CheckCircle, Bell, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: "Confirmée", color: "#00B85C", bg: "#EEFBF4" },
  pending_payment: { label: "En attente paiement", color: "#F59E0B", bg: "#FEF3C7" },
  paid: { label: "Payée", color: "#1C58D9", bg: "#EBF0FB" },
  shipped: { label: "Expédiée", color: "#1C58D9", bg: "#EBF0FB" },
  delivered: { label: "Livrée", color: "#00B85C", bg: "#EEFBF4" },
  cancelled: { label: "Annulée", color: "#E54545", bg: "#FEE2E2" },
};

const counterStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "En attente", color: "#F59E0B", bg: "#FEF3C7" },
  accepted: { label: "Acceptée", color: "#00B85C", bg: "#EEFBF4" },
  refused: { label: "Refusée", color: "#E54545", bg: "#FEE2E2" },
};

export default function RestockBuyerDashboard() {
  const { user } = useAuth();

  // Fetch transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["restock-buyer-transactions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("restock_transactions")
        .select("*, restock_offers(designation, ean, cnk, grade)")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch counter-offers
  const { data: counterOffers = [] } = useQuery({
    queryKey: ["restock-buyer-counters", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("restock_counter_offers")
        .select("*, restock_offers(designation, ean, cnk)")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const stats = {
    purchases: transactions.length,
    pending: counterOffers.filter((c: any) => c.status === "pending").length,
    accepted: counterOffers.filter((c: any) => c.status === "accepted").length,
    totalSpent: transactions.reduce((acc: number, t: any) => acc + ((t.final_price || 0) * (t.quantity || 0)), 0),
  };

  const formatPrice = (p: number) => `${p.toFixed(2)} €`;

  return (
    <div className="p-6 max-w-5xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E252F]">Mon espace ReStock</h1>
          <p className="text-[#5C6470] text-sm">Suivez vos achats et contre-offres</p>
        </div>
        <Link to="/restock/opportunities/demo">
          <Button className="bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-lg gap-2">
            <Package size={16} /> Voir les opportunités
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Achats", value: stats.purchases, icon: ShoppingCart, color: "#00B85C" },
          { label: "Contre-offres en cours", value: stats.pending, icon: MessageSquare, color: "#F59E0B" },
          { label: "Contre-offres acceptées", value: stats.accepted, icon: CheckCircle, color: "#1C58D9" },
          { label: "Total dépensé", value: formatPrice(stats.totalSpent), icon: Package, color: "#00B85C" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-[#D0D5DC] rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon size={16} style={{ color: kpi.color }} />
              <span className="text-xs text-[#8B929C]">{kpi.label}</span>
            </div>
            <p className="text-xl font-bold text-[#1E252F]">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Transactions */}
      <div className="bg-white border border-[#D0D5DC] rounded-xl shadow-sm mb-6">
        <div className="p-4 border-b border-[#D0D5DC]">
          <h2 className="font-bold text-[#1E252F] flex items-center gap-2">
            <ShoppingCart size={16} /> Historique des achats
          </h2>
        </div>
        {transactions.length === 0 ? (
          <div className="p-10 text-center text-[#8B929C]">
            <Package size={40} className="mx-auto mb-2 opacity-40" />
            <p>Aucun achat pour l'instant</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#D0D5DC] text-left text-[#8B929C] bg-[#F7F8FA]">
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3 text-right">Qté</th>
                  <th className="px-4 py-3 text-right">Prix HT</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t: any) => {
                  const st = statusConfig[t.status] || statusConfig.confirmed;
                  const offer = t.restock_offers;
                  return (
                    <tr key={t.id} className="border-b border-[#F0F4FF] hover:bg-[#F7F8FA]">
                      <td className="px-4 py-3 font-medium text-[#1E252F] max-w-[200px] truncate">
                        {offer?.designation || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">{t.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#1C58D9]">{formatPrice(t.final_price || 0)}</td>
                      <td className="px-4 py-3 text-[#5C6470]">{t.delivery_mode === "pickup" ? "Enlèvement" : "Livraison"}</td>
                      <td className="px-4 py-3">
                        <Badge className="text-[10px]" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[#5C6470]">
                        {new Date(t.created_at).toLocaleDateString("fr-BE")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Counter-offers */}
      <div className="bg-white border border-[#D0D5DC] rounded-xl shadow-sm">
        <div className="p-4 border-b border-[#D0D5DC]">
          <h2 className="font-bold text-[#1E252F] flex items-center gap-2">
            <MessageSquare size={16} /> Mes contre-offres
          </h2>
        </div>
        {counterOffers.length === 0 ? (
          <div className="p-10 text-center text-[#8B929C]">
            <MessageSquare size={40} className="mx-auto mb-2 opacity-40" />
            <p>Aucune contre-offre envoyée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#D0D5DC] text-left text-[#8B929C] bg-[#F7F8FA]">
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3 text-right">Prix proposé</th>
                  <th className="px-4 py-3 text-right">Qté</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {counterOffers.map((c: any) => {
                  const st = counterStatusConfig[c.status] || counterStatusConfig.pending;
                  const offer = c.restock_offers;
                  return (
                    <tr key={c.id} className="border-b border-[#F0F4FF] hover:bg-[#F7F8FA]">
                      <td className="px-4 py-3 font-medium text-[#1E252F] max-w-[200px] truncate">
                        {offer?.designation || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#1C58D9]">{formatPrice(c.proposed_price || 0)}</td>
                      <td className="px-4 py-3 text-right">{c.proposed_quantity}</td>
                      <td className="px-4 py-3">
                        <Badge className="text-[10px]" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[#5C6470]">
                        {new Date(c.created_at).toLocaleDateString("fr-BE")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
