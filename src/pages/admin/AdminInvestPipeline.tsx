import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Users, TrendingUp, Clock, Eye } from "lucide-react";

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "#FEF3C7", text: "#D97706", label: "En attente" },
  contacted: { bg: "#DBEAFE", text: "#2563EB", label: "Contacté" },
  signed: { bg: "#D1FAE5", text: "#059669", label: "Signé" },
  paid: { bg: "#ECFDF5", text: "#047857", label: "Payé" },
  cancelled: { bg: "#FEE2E2", text: "#DC2626", label: "Annulé" },
};

export default function AdminInvestPipeline() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["invest-subscriptions"],
    queryFn: async () => [] as any[],
  });

  const filtered = statusFilter === "all" ? subs : subs.filter((s: any) => s.status === statusFilter);

  const totalAmount = subs.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
  const signed = subs.filter((s: any) => s.status === "signed" || s.status === "paid");
  const signedAmount = signed.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
  const pending = subs.filter((s: any) => s.status === "pending");

  const stats = [
    { label: "Total souscriptions", value: subs.length, sub: `${totalAmount.toLocaleString("fr-BE")} €`, icon: Users, color: "#1B5BDA" },
    { label: "Montant signé", value: `${signedAmount.toLocaleString("fr-BE")} €`, sub: `${signed.length} investisseurs`, icon: DollarSign, color: "#059669" },
    { label: "En attente", value: pending.length, sub: "À traiter", icon: Clock, color: "#F59E0B" },
    { label: "Conversion", value: subs.length > 0 ? `${Math.round((signed.length / subs.length) * 100)}%` : "—", sub: "signé / total", icon: TrendingUp, color: "#8B5CF6" },
  ];

  return (
    <div>
      <AdminTopBar title="Pipeline Investisseurs" subtitle="Suivi des souscriptions au capital MediKong" />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-lg border p-4" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-[#8B95A5] uppercase tracking-wide font-medium">{s.label}</p>
              <s.icon size={16} style={{ color: s.color }} />
            </div>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] text-[#8B95A5]">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        {["all", "pending", "contacted", "signed", "paid", "cancelled"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${statusFilter === s ? "bg-[#1D2530] text-white border-transparent" : "bg-white text-[#616B7C] border-[#E2E8F0] hover:bg-[#F8FAFC]"}`}>
            {s === "all" ? "Tous" : statusColors[s]?.label || s}
            {s === "all" ? ` (${subs.length})` : ` (${subs.filter((sub: any) => sub.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
        {isLoading ? (
          <div className="p-8 text-center text-[#8B95A5]">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-[#8B95A5]">Aucune souscription pour le moment</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b text-[11px] text-[#8B95A5] uppercase tracking-wide" style={{ borderColor: "#E2E8F0" }}>
                <th className="text-left py-2.5 px-3 font-medium">Date</th>
                <th className="text-left py-2.5 px-3 font-medium">Nom</th>
                <th className="text-left py-2.5 px-3 font-medium">Email</th>
                <th className="text-right py-2.5 px-3 font-medium">Montant</th>
                <th className="text-right py-2.5 px-3 font-medium">Parts</th>
                <th className="text-center py-2.5 px-3 font-medium">Pays</th>
                <th className="text-right py-2.5 px-3 font-medium">Réduction</th>
                <th className="text-center py-2.5 px-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: any) => {
                const sc = statusColors[s.status] || statusColors.pending;
                return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-[#F8FAFC]" style={{ borderColor: "#E2E8F0" }}>
                    <td className="py-2.5 px-3 text-[#8B95A5]">{new Date(s.created_at).toLocaleDateString("fr-BE")}</td>
                    <td className="py-2.5 px-3 font-medium text-[#1D2530]">{s.first_name} {s.last_name}</td>
                    <td className="py-2.5 px-3 text-[#616B7C]">{s.email}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#1D2530]">{s.amount?.toLocaleString("fr-BE")} €</td>
                    <td className="py-2.5 px-3 text-right text-[#616B7C]">{s.shares}</td>
                    <td className="py-2.5 px-3 text-center">{s.country}</td>
                    <td className="py-2.5 px-3 text-right font-medium" style={{ color: "#059669" }}>
                      {s.tax_reduction > 0 ? `- ${Number(s.tax_reduction).toLocaleString("fr-BE")} €` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: sc.bg, color: sc.text }}>{sc.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
