import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, MessageSquare, CheckCircle, DollarSign, Eye, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  published: { label: "Publiée", color: "#00B85C", bg: "#EEFBF4" },
  counter_offer: { label: "Contre-offre", color: "#F59E0B", bg: "#FEF3C7" },
  sold: { label: "Vendue", color: "#1C58D9", bg: "#EBF0FB" },
  rejected: { label: "Rejetée", color: "#E54545", bg: "#FEF2F2" },
  expired: { label: "Expirée", color: "#8B929C", bg: "#F7F8FA" },
};

const stateLabel = (s: string) => ({ intact: "Intact", damaged_packaging: "Emb. abîmé", near_expiry: "Proche pér." }[s] || s);

export default function RestockSellerOffers() {
  const { user } = useAuth();

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["restock-seller-offers", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("restock_offers")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const stats = {
    active: offers.filter((o: any) => o.status === "published").length,
    counterOffers: offers.filter((o: any) => o.status === "counter_offer").length,
    sold: offers.filter((o: any) => o.status === "sold").length,
    revenue: offers.filter((o: any) => o.status === "sold").reduce((acc: number, o: any) => acc + (o.price_ht * o.quantity), 0),
  };

  return (
    <div className="p-6 max-w-6xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <h1 className="text-2xl font-bold text-[#1E252F] mb-6">Mes offres</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Offres actives", value: stats.active, icon: Package, color: "#00B85C" },
          { label: "Contre-offres", value: stats.counterOffers, icon: MessageSquare, color: "#F59E0B" },
          { label: "Ventes conclues", value: stats.sold, icon: CheckCircle, color: "#1C58D9" },
          { label: "Revenus ce mois", value: `${stats.revenue.toFixed(2)} €`, icon: DollarSign, color: "#00B85C" },
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

      {/* Table */}
      <div className="bg-white border border-[#D0D5DC] rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-[#8B929C]">Chargement...</div>
        ) : offers.length === 0 ? (
          <div className="p-10 text-center">
            <Package className="mx-auto mb-3 text-[#D0D5DC]" size={40} />
            <p className="text-[#5C6470] text-sm">Aucune offre pour l'instant.</p>
            <Link to="/restock/seller/new">
              <Button className="mt-3 bg-[#1C58D9] hover:bg-[#1549B8] rounded-lg">Créer ma première offre</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#D0D5DC] text-left text-[#8B929C] bg-[#F7F8FA]">
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">EAN / CNK</th>
                  <th className="px-4 py-3 text-right">Qté</th>
                  <th className="px-4 py-3 text-right">Prix HT</th>
                  <th className="px-4 py-3">DLU</th>
                  <th className="px-4 py-3">État</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o: any) => {
                  const st = statusConfig[o.status] || statusConfig.published;
                  return (
                    <tr key={o.id} className="border-b border-[#F0F4FF] hover:bg-[#F7F8FA]">
                      <td className="px-4 py-3 font-medium text-[#1E252F] max-w-[220px] truncate">{o.designation}</td>
                      <td className="px-4 py-3 text-[#5C6470]">{o.ean || "—"} / {o.cnk || "—"}</td>
                      <td className="px-4 py-3 text-right text-[#1E252F]">{o.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#1C58D9]">{Number(o.price_ht).toFixed(2)} €</td>
                      <td className="px-4 py-3 text-[#5C6470]">{o.dlu || "—"}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{stateLabel(o.product_state)}</Badge></td>
                      <td className="px-4 py-3">
                        <Badge className="text-[10px]" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="text-[#1C58D9] text-xs gap-1 h-7">
                          <Eye size={13} /> Voir
                        </Button>
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
