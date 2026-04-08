import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle, Clock, Truck, Shield, Wallet, Package, Download,
  AlertTriangle, DollarSign, ArrowRight,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending_payment: { label: "En attente paiement", color: "#F59E0B", bg: "#FEF3C7", icon: Clock },
  paid: { label: "Payé — Escrow", color: "#1C58D9", bg: "#EBF0FB", icon: Shield },
  shipped: { label: "Expédié", color: "#8B5CF6", bg: "#F3E8FF", icon: Truck },
  delivered: { label: "Livré — Sous escrow", color: "#F59E0B", bg: "#FEF3C7", icon: Clock },
  released: { label: "Fonds libérés ✓", color: "#00B85C", bg: "#EEFBF4", icon: Wallet },
  disputed: { label: "Litige", color: "#E54545", bg: "#FEE2E2", icon: AlertTriangle },
  refunded: { label: "Remboursé", color: "#8B929C", bg: "#F7F8FA", icon: DollarSign },
  cancelled: { label: "Annulé", color: "#8B929C", bg: "#F7F8FA", icon: AlertTriangle },
};

const ESCROW_STEPS = ["pending_payment", "paid", "shipped", "delivered", "released"];

function EscrowTimeline({ status }: { status: string }) {
  const currentIdx = ESCROW_STEPS.indexOf(status);
  if (status === "disputed" || status === "refunded" || status === "cancelled") {
    const cfg = STATUS_CONFIG[status];
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: cfg.bg }}>
        <cfg.icon size={14} style={{ color: cfg.color }} />
        <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {ESCROW_STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const cfg = STATUS_CONFIG[step];
        return (
          <div key={step} className="flex items-center gap-1">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${done ? "text-white" : "text-[#8B929C] border border-[#D0D5DC]"}`}
              style={done ? { backgroundColor: cfg.color } : {}}
              title={cfg.label}
            >
              {i + 1}
            </div>
            {i < ESCROW_STEPS.length - 1 && (
              <div className={`w-4 h-0.5 ${i < currentIdx ? "bg-[#00B85C]" : "bg-[#D0D5DC]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RestockSellerSales() {
  const { user } = useAuth();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["restock-seller-sales", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restock_transactions")
        .select("*, restock_offers!inner(designation, ean, cnk, grade)")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const totalRevenue = transactions
    .filter((t: any) => t.status === "released")
    .reduce((s: number, t: any) => s + (Number(t.seller_amount) || 0), 0);
  const pendingEscrow = transactions
    .filter((t: any) => ["paid", "shipped", "delivered"].includes(t.status))
    .reduce((s: number, t: any) => s + (Number(t.seller_amount) || 0), 0);
  const totalSales = transactions.filter((t: any) => !["cancelled", "refunded"].includes(t.status)).length;

  return (
    <div className="p-6 max-w-5xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-[#EEFBF4]">
          <CheckCircle size={22} className="text-[#00B85C]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1E252F]">Ventes conclues</h1>
          <p className="text-sm text-[#5C6470]">Suivi de vos ventes et paiements escrow</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><Package size={16} className="text-[#1C58D9]" /><span className="text-xs text-[#5C6470]">Ventes totales</span></div>
          <p className="text-2xl font-bold text-[#1E252F]">{totalSales}</p>
        </div>
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><Wallet size={16} className="text-[#00B85C]" /><span className="text-xs text-[#5C6470]">Revenus libérés</span></div>
          <p className="text-2xl font-bold text-[#00B85C]">{totalRevenue.toFixed(2)} €</p>
        </div>
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><Shield size={16} className="text-[#F59E0B]" /><span className="text-xs text-[#5C6470]">En escrow</span></div>
          <p className="text-2xl font-bold text-[#F59E0B]">{pendingEscrow.toFixed(2)} €</p>
        </div>
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><Clock size={16} className="text-[#8B929C]" /><span className="text-xs text-[#5C6470]">En attente</span></div>
          <p className="text-2xl font-bold text-[#1E252F]">{transactions.filter((t: any) => t.status === "pending_payment").length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-[#8B929C]">Chargement…</div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#D0D5DC] shadow-sm text-center py-16">
          <CheckCircle size={40} className="mx-auto mb-3 opacity-30 text-[#8B929C]" />
          <p className="font-medium text-[#5C6470]">Aucune vente pour le moment</p>
          <p className="text-sm text-[#8B929C] mt-1">Vos ventes apparaîtront ici dès qu'un acheteur confirme une commande.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#D0D5DC] rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F8FA] text-[#5C6470]">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Produit</th>
                <th className="text-center px-4 py-3 font-medium">Qté</th>
                <th className="text-right px-4 py-3 font-medium">Montant net</th>
                <th className="text-center px-4 py-3 font-medium">Escrow</th>
                <th className="text-left px-4 py-3 font-medium">Acheteur</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t: any) => {
                const offer = t.restock_offers;
                const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending_payment;
                const isRevealed = ["paid", "shipped", "delivered", "released"].includes(t.status);
                return (
                  <tr key={t.id} className="border-t border-[#D0D5DC]/50 hover:bg-[#F7F8FA]/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1E252F] truncate max-w-[200px]">{offer?.designation || "—"}</p>
                      <p className="text-[10px] text-[#8B929C]">{offer?.ean && `EAN ${offer.ean}`}{offer?.cnk && ` · CNK ${offer.cnk}`}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-[#1E252F] font-medium">{t.quantity}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#00B85C]">{Number(t.seller_amount || 0).toFixed(2)} €</td>
                    <td className="px-4 py-3 text-center">
                      <EscrowTimeline status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-[#5C6470]">
                      {isRevealed ? (
                        <span className="text-xs">{t.buyer_pharmacy_name || "Acheteur"}</span>
                      ) : (
                        <span className="text-xs text-[#8B929C] italic flex items-center gap-1"><Shield size={10} />Anonyme</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#8B929C] text-xs">{new Date(t.created_at).toLocaleDateString("fr-BE")}</td>
                    <td className="px-4 py-3 text-right">
                      {t.tracking_number && (
                        <Button size="sm" variant="ghost" className="text-xs gap-1 text-[#1C58D9]">
                          <Truck size={12} /> Suivi
                        </Button>
                      )}
                      {t.status === "released" && (
                        <Button size="sm" variant="ghost" className="text-xs gap-1 text-[#5C6470]">
                          <Download size={12} /> Facture
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
