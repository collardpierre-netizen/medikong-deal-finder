import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { useI18n } from "@/contexts/I18nContext";
import { useInvoices, useVendors } from "@/hooks/useAdminData";
import {
  DollarSign, TrendingUp, Receipt, CreditCard, RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const fmt = (n: number) => n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AdminFinances = () => {
  const { t } = useI18n();
  const { data: invoicesData = [], isLoading } = useInvoices();
  const { data: vendors = [] } = useVendors();
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "payouts">("overview");

  const totalHT = invoicesData.reduce((a, inv) => a + Number(inv.amount_ht), 0);
  const totalTVA = invoicesData.reduce((a, inv) => a + Number(inv.tva_amount || 0), 0);
  const pendingInvoices = invoicesData.filter(i => i.status === "pending");
  const paidInvoices = invoicesData.filter(i => i.status === "paid");

  const commissionData = vendors.filter(v => v.is_active).slice(0, 5).map(v => ({
    seller: (v.company_name || v.name || "").length > 15 ? (v.company_name || v.name || "").substring(0, 15) + "…" : (v.company_name || v.name || ""),
    commission: Number(v.commission_rate) || 12,
  }));

  const tabs = [
    { key: "overview" as const, label: "Vue d'ensemble" },
    { key: "invoices" as const, label: "Factures" },
    { key: "payouts" as const, label: "Reversements" },
  ];

  return (
    <div>
      <AdminTopBar title={t("finances")} subtitle="Revenus, commissions et fiscalité" />

      <div className="grid grid-cols-5 gap-3 mb-5">
        <KpiCard icon={TrendingUp} label="GMV mois" value="127 450 EUR" evolution={{ value: 18.3, label: "vs mois dernier" }} />
        <KpiCard icon={DollarSign} label="Factures HT" value={`${fmt(totalHT)} EUR`} iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={Receipt} label="TVA collectée" value={`${fmt(totalTVA)} EUR`} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={CreditCard} label="En attente" value={String(pendingInvoices.length)} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={RotateCcw} label="Payées" value={String(paidInvoices.length)} iconColor="#059669" iconBg="#F0FDF4" />
      </div>

      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex" }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-md text-[12px] font-semibold transition-colors"
            style={{ backgroundColor: activeTab === tab.key ? "#1B5BDA" : "transparent", color: activeTab === tab.key ? "#fff" : "#616B7C" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Taux commission par vendeur</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={commissionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#8B95A5" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="seller" type="category" tick={{ fontSize: 11, fill: "#616B7C" }} axisLine={false} tickLine={false} width={130} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(v: number) => [`${v}%`]} />
                <Bar dataKey="commission" radius={[0, 4, 4, 0]}>
                  {commissionData.map((_, i) => (
                    <Cell key={i} fill={["#1B5BDA", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Résumé factures</h3>
            <div className="space-y-4 text-[13px]">
              <div className="flex justify-between"><span style={{ color: "#616B7C" }}>Total factures</span><span className="font-bold" style={{ color: "#1D2530" }}>{invoicesData.length}</span></div>
              <div className="flex justify-between"><span style={{ color: "#616B7C" }}>En attente</span><span className="font-bold" style={{ color: "#F59E0B" }}>{pendingInvoices.length}</span></div>
              <div className="flex justify-between"><span style={{ color: "#616B7C" }}>Payées</span><span className="font-bold" style={{ color: "#059669" }}>{paidInvoices.length}</span></div>
              <div className="flex justify-between"><span style={{ color: "#616B7C" }}>Total HT</span><span className="font-bold" style={{ color: "#1D2530" }}>{fmt(totalHT)} EUR</span></div>
              <div className="flex justify-between"><span style={{ color: "#616B7C" }}>Total TTC</span><span className="font-bold" style={{ color: "#059669" }}>{fmt(invoicesData.reduce((a, i) => a + Number(i.amount_ttc || 0), 0))} EUR</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                  {["N° Facture", "Type", "HT", "TVA", "TTC", "Échéance", "Statut"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoicesData.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td className="px-4 py-3 text-[12px] font-bold font-mono" style={{ color: "#1B5BDA" }}>{inv.invoice_number}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{
                        backgroundColor: inv.type === "commission" ? "#EFF6FF" : "#F5F3FF",
                        color: inv.type === "commission" ? "#1B5BDA" : "#7C3AED",
                      }}>{inv.type === "commission" ? "Commission" : inv.type === "lead_cpa" ? "Lead CPA" : inv.type}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#1D2530" }}>{fmt(Number(inv.amount_ht))} EUR</td>
                    <td className="px-4 py-3 text-[11px] font-mono" style={{ color: "#8B95A5" }}>{fmt(Number(inv.tva_amount || 0))} EUR</td>
                    <td className="px-4 py-3 text-[12px] font-bold font-mono" style={{ color: "#059669" }}>{fmt(Number(inv.amount_ttc || 0))} EUR</td>
                    <td className="px-4 py-3 text-[11px]" style={{ color: "#8B95A5" }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString("fr-BE") : "—"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                        backgroundColor: inv.status === "paid" ? "#F0FDF4" : inv.status === "overdue" ? "#FEF2F2" : "#FFFBEB",
                        color: inv.status === "paid" ? "#059669" : inv.status === "overdue" ? "#EF4343" : "#D97706",
                      }}>
                        {inv.status === "paid" ? "Payée" : inv.status === "overdue" ? "En retard" : inv.status === "draft" ? "Brouillon" : "En attente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "payouts" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Vendeur", "Commission", "Tier", "Statut"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.filter(v => v.is_active).map((v) => (
                <tr key={v.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "#1B5BDA" }}>{v.company_name || v.name}</td>
                  <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#616B7C" }}>{v.commission_rate}%</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{v.type}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>Actif</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminFinances;
