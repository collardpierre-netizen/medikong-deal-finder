import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle, Clock } from "lucide-react";

export default function RestockAdminPayouts() {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["restock-admin-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restock_transactions")
        .select("*")
        .in("status", ["delivered", "paid", "released"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const toRelease = transactions.filter((t: any) => t.status === "delivered");
  const released = transactions.filter((t: any) => t.status === "released");
  const totalToRelease = toRelease.reduce((s: number, t: any) => s + (Number(t.seller_amount) || 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center gap-3 mb-6">
        <Wallet size={24} className="text-[#1C58D9]" />
        <h1 className="text-2xl font-bold text-[#1E252F]">Escrow & Payouts</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><Clock size={18} className="text-[#F59E0B]" /><span className="text-sm text-[#5C6470]">À libérer</span></div>
          <p className="text-2xl font-bold text-[#1E252F]">{totalToRelease.toFixed(2)} €</p>
          <p className="text-xs text-[#8B929C]">{toRelease.length} transaction(s)</p>
        </div>
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><CheckCircle size={18} className="text-[#00B85C]" /><span className="text-sm text-[#5C6470]">Libérés ce mois</span></div>
          <p className="text-2xl font-bold text-[#1E252F]">{released.reduce((s: number, t: any) => s + (Number(t.seller_amount) || 0), 0).toFixed(2)} €</p>
          <p className="text-xs text-[#8B929C]">{released.length} transaction(s)</p>
        </div>
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><Wallet size={18} className="text-[#1C58D9]" /><span className="text-sm text-[#5C6470]">Total en escrow</span></div>
          <p className="text-2xl font-bold text-[#1E252F]">{transactions.filter((t: any) => t.status === "paid").reduce((s: number, t: any) => s + (Number(t.buyer_total) || 0), 0).toFixed(2)} €</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-[#8B929C]">Chargement…</div>
      ) : toRelease.length === 0 ? (
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-8 text-center text-[#8B929C]">
          <Wallet size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-[#5C6470]">Aucun paiement à libérer</p>
        </div>
      ) : (
        <div className="bg-white border border-[#D0D5DC] rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F8FA] text-[#5C6470]">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Transaction</th>
                <th className="text-right px-4 py-3 font-medium">Montant vendeur</th>
                <th className="text-right px-4 py-3 font-medium">Commission</th>
                <th className="text-center px-4 py-3 font-medium">Statut</th>
                <th className="text-left px-4 py-3 font-medium">Livré le</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {toRelease.map((t: any) => (
                <tr key={t.id} className="border-t border-[#D0D5DC]/50 hover:bg-[#F7F8FA]/50">
                  <td className="px-4 py-3 font-mono text-xs text-[#1E252F]">{t.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-right font-medium text-[#00B85C]">{Number(t.seller_amount || 0).toFixed(2)} €</td>
                  <td className="px-4 py-3 text-right text-[#8B929C]">{Number(t.commission_amount || 0).toFixed(2)} €</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] text-[10px]">À libérer</Badge>
                  </td>
                  <td className="px-4 py-3 text-[#5C6470]">{t.delivered_at ? new Date(t.delivered_at).toLocaleDateString("fr-BE") : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" className="bg-[#00B85C] hover:bg-[#009E4F] text-white text-xs">
                      Libérer
                    </Button>
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
