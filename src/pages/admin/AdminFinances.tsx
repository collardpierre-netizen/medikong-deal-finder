import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { useI18n } from "@/contexts/I18nContext";
import {
  DollarSign, TrendingUp, Receipt, CreditCard, RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const fmt = (n: number) => n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const commissionData = [
  { seller: "Valerco NV", commission: 3312 },
  { seller: "Pharmamed SRL", commission: 2845 },
  { seller: "MedDistri SA", commission: 2190 },
  { seller: "Brussels Med", commission: 1450 },
  { seller: "Pharma-GDD", commission: 980 },
];

const revenueChannels = [
  { channel: "Direct (marketplace)", pct: 72, amount: 91764, color: "#1B5BDA" },
  { channel: "Indirect (leads/affiliation)", pct: 22, amount: 28038, color: "#7C3AED" },
  { channel: "Market intel (abonnements)", pct: 6, amount: 7647, color: "#059669" },
];

const tvaCategories = [
  { category: "Dispositifs médicaux (Classe I-III)", taux: 6, caHT: 42300, tvaCollected: 2538, pctGMV: 33.2 },
  { category: "Médicaments OTC enregistrés", taux: 6, caHT: 18900, tvaCollected: 1134, pctGMV: 14.8 },
  { category: "Nutrition médicale", taux: 6, caHT: 8400, tvaCollected: 504, pctGMV: 6.6 },
  { category: "Cosmétiques & hygiène", taux: 21, caHT: 28700, tvaCollected: 6027, pctGMV: 22.5 },
  { category: "Consommables standard (gants, masques)", taux: 21, caHT: 19200, tvaCollected: 4032, pctGMV: 15.1 },
  { category: "Parapharmacie", taux: 21, caHT: 10000, tvaCollected: 2100, pctGMV: 7.8 },
];

const creditLines = [
  { buyer: "CHU Saint-Pierre", limit: 50000, used: 38900, available: 11100, terms: "Net 60", riskScore: "A+", avgDelay: 0 },
  { buyer: "Pharmacie Centrale Bruxelles", limit: 15000, used: 8900, available: 6100, terms: "Net 30", riskScore: "A", avgDelay: 2 },
  { buyer: "Résidence Les Tilleuls", limit: 25000, used: 19800, available: 5200, terms: "Net 60", riskScore: "B+", avgDelay: 8 },
  { buyer: "Cabinet Dr. Janssens", limit: 5000, used: 1200, available: 3800, terms: "Comptant", riskScore: "A", avgDelay: 0 },
  { buyer: "Parapharmacie du Midi", limit: 10000, used: 7800, available: 2200, terms: "Net 30", riskScore: "B", avgDelay: 12 },
  { buyer: "CPAS Namur", limit: 30000, used: 28500, available: 1500, terms: "Net 60", riskScore: "C", avgDelay: 22 },
];

const invoices = [
  { id: "FAC-2025-0089", type: "Commission", seller: "Valerco NV", ht: 892.30, tva: 187.38, ttc: 1079.68, due: "31/03/2025", status: "pending" },
  { id: "FAC-2025-0088", type: "Commission", seller: "Pharmamed SRL", ht: 756.40, tva: 158.84, ttc: 915.24, due: "31/03/2025", status: "pending" },
  { id: "FAC-2025-0087", type: "Lead CPA", seller: "DocMorris.be", ht: 245.00, tva: 51.45, ttc: 296.45, due: "25/03/2025", status: "paid" },
  { id: "FAC-2025-0086", type: "Commission", seller: "MedDistri SA", ht: 612.80, tva: 128.69, ttc: 741.49, due: "28/02/2025", status: "paid" },
  { id: "FAC-2025-0085", type: "Lead CPA", seller: "Pharmamarket.be", ht: 189.00, tva: 39.69, ttc: 228.69, due: "28/02/2025", status: "overdue" },
];

const reversements = [
  { seller: "Valerco NV", gmv: 38900, commission: 3312, net: 35588, date: "01/04/2025", status: "pending" },
  { seller: "Pharmamed SRL", gmv: 45200, commission: 2845, net: 42355, date: "01/04/2025", status: "pending" },
  { seller: "MedDistri SA", gmv: 31400, commission: 2190, net: 29210, date: "01/04/2025", status: "pending" },
  { seller: "Brussels Med Supply", gmv: 22800, commission: 1450, net: 21350, date: "28/02/2025", status: "completed" },
  { seller: "Pharma-GDD SRL", gmv: 18600, commission: 980, net: 17620, date: "28/02/2025", status: "completed" },
];

const riskColors: Record<string, { bg: string; text: string }> = {
  "A+": { bg: "#F0FDF4", text: "#059669" },
  A: { bg: "#F0FDF4", text: "#059669" },
  "B+": { bg: "#EFF6FF", text: "#1B5BDA" },
  B: { bg: "#FFFBEB", text: "#D97706" },
  C: { bg: "#FEF2F2", text: "#EF4343" },
};

const AdminFinances = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"overview" | "tva" | "credit" | "invoices" | "payouts">("overview");

  const tabs = [
    { key: "overview" as const, label: "Vue d'ensemble" },
    { key: "tva" as const, label: "TVA & Fiscalité" },
    { key: "credit" as const, label: "Conditions paiement B2B" },
    { key: "invoices" as const, label: "Factures" },
    { key: "payouts" as const, label: "Reversements vendeurs" },
  ];

  return (
    <div>
      <AdminTopBar title={t("finances")} subtitle="Revenus, commissions et fiscalité" />

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <KpiCard icon={TrendingUp} label="GMV mois" value="127 450 EUR" evolution={{ value: 18.3, label: "vs mois dernier" }} />
        <KpiCard icon={DollarSign} label="Commissions nettes" value="10 777 EUR" evolution={{ value: 14.6, label: "vs mois dernier" }} iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={Receipt} label="TVA collectée" value="16 335 EUR" iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={CreditCard} label="Encours clients" value="81 300 EUR" iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={RotateCcw} label="Remboursements" value="1 240 EUR" iconColor="#EF4343" iconBg="#FEF2F2" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex" }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-md text-[12px] font-semibold transition-colors"
            style={{ backgroundColor: activeTab === tab.key ? "#1B5BDA" : "transparent", color: activeTab === tab.key ? "#fff" : "#616B7C" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Vue d'ensemble */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Commissions par vendeur</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={commissionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#8B95A5" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v} EUR`} />
                <YAxis dataKey="seller" type="category" tick={{ fontSize: 11, fill: "#616B7C" }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(v: number) => [`${fmt(v)} EUR`]} />
                <Bar dataKey="commission" radius={[0, 4, 4, 0]}>
                  {commissionData.map((_, i) => (
                    <Cell key={i} fill={["#1B5BDA", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Revenus par canal</h3>
            {revenueChannels.map((rc) => (
              <div key={rc.channel} className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{rc.channel}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold" style={{ color: "#1D2530" }}>{fmt(rc.amount)} EUR</span>
                    <span className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{rc.pct}%</span>
                  </div>
                </div>
                <div className="h-3 rounded-full" style={{ backgroundColor: "#F1F5F9" }}>
                  <div className="h-3 rounded-full transition-all" style={{ width: `${rc.pct}%`, backgroundColor: rc.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TVA & Fiscalité */}
      {activeTab === "tva" && (
        <div className="space-y-4">
          <div className="p-4 rounded-[10px] flex items-start gap-3" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <AlertTriangle size={18} style={{ color: "#D97706" }} className="shrink-0 mt-0.5" />
            <div>
              <span className="text-[13px] font-bold" style={{ color: "#92400E" }}>Règles TVA belges applicables</span>
              <p className="text-[12px] mt-1" style={{ color: "#A16207" }}>
                Dispositifs médicaux (classes I/IIa/IIb/III), médicaments OTC enregistrés et nutrition médicale : <strong>6%</strong>.
                Cosmétiques, hygiène, parapharmacie et consommables standard : <strong>21%</strong>.
                Le taux est déterminé automatiquement par la sous-catégorie produit.
              </p>
            </div>
          </div>
          <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                  {["Catégorie fiscale", "Taux TVA", "CA HT", "TVA collectée", "% GMV"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tvaCategories.map((c) => (
                  <tr key={c.category} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "#1D2530" }}>{c.category}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{
                        backgroundColor: c.taux === 6 ? "#F0FDF4" : "#FFFBEB",
                        color: c.taux === 6 ? "#059669" : "#D97706",
                      }}>{c.taux}%</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-bold font-mono" style={{ color: "#1D2530" }}>{fmt(c.caHT)} EUR</td>
                    <td className="px-4 py-3 text-[13px] font-mono" style={{ color: "#059669" }}>{fmt(c.tvaCollected)} EUR</td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{c.pctGMV}%</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: "#F8FAFC" }}>
                  <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>Total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-[13px] font-bold font-mono" style={{ color: "#1D2530" }}>
                    {fmt(tvaCategories.reduce((a, c) => a + c.caHT, 0))} EUR
                  </td>
                  <td className="px-4 py-3 text-[13px] font-bold font-mono" style={{ color: "#059669" }}>
                    {fmt(tvaCategories.reduce((a, c) => a + c.tvaCollected, 0))} EUR
                  </td>
                  <td className="px-4 py-3 text-[12px] font-bold" style={{ color: "#1D2530" }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conditions paiement B2B */}
      {activeTab === "credit" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Acheteur", "Limite", "Utilisé", "Disponible", "Usage", "Conditions", "Score risque", "Retard moyen"].map((h) => (
                  <th key={h} className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creditLines.map((cl) => {
                const usagePct = Math.round((cl.used / cl.limit) * 100);
                const rc = riskColors[cl.riskScore] || riskColors.B;
                return (
                  <tr key={cl.buyer} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td className="px-3 py-3 text-[13px] font-medium" style={{ color: "#1D2530" }}>{cl.buyer}</td>
                    <td className="px-3 py-3 text-[12px] font-mono" style={{ color: "#616B7C" }}>{fmt(cl.limit)} EUR</td>
                    <td className="px-3 py-3 text-[12px] font-mono font-bold" style={{ color: "#1D2530" }}>{fmt(cl.used)} EUR</td>
                    <td className="px-3 py-3 text-[12px] font-mono" style={{ color: "#059669" }}>{fmt(cl.available)} EUR</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full" style={{ backgroundColor: "#F1F5F9" }}>
                          <div className="h-2 rounded-full" style={{
                            width: `${usagePct}%`,
                            backgroundColor: usagePct > 90 ? "#EF4343" : usagePct > 70 ? "#F59E0B" : "#059669",
                          }} />
                        </div>
                        <span className="text-[10px] font-bold" style={{ color: "#616B7C" }}>{usagePct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[11px]" style={{ color: "#616B7C" }}>{cl.terms}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: rc.bg, color: rc.text }}>{cl.riskScore}</span>
                    </td>
                    <td className="px-3 py-3 text-[12px]" style={{ color: cl.avgDelay > 15 ? "#EF4343" : cl.avgDelay > 5 ? "#F59E0B" : "#059669" }}>
                      {cl.avgDelay}j
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Factures */}
      {activeTab === "invoices" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["N° Facture", "Type", "Vendeur / Partenaire", "HT", "TVA", "TTC", "Échéance", "Statut"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-3 text-[12px] font-bold font-mono" style={{ color: "#1B5BDA" }}>{inv.id}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{
                      backgroundColor: inv.type === "Commission" ? "#EFF6FF" : "#F5F3FF",
                      color: inv.type === "Commission" ? "#1B5BDA" : "#7C3AED",
                    }}>{inv.type}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-medium" style={{ color: "#1D2530" }}>{inv.seller}</td>
                  <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#1D2530" }}>{fmt(inv.ht)} EUR</td>
                  <td className="px-4 py-3 text-[11px] font-mono" style={{ color: "#8B95A5" }}>{fmt(inv.tva)} EUR</td>
                  <td className="px-4 py-3 text-[12px] font-bold font-mono" style={{ color: "#059669" }}>{fmt(inv.ttc)} EUR</td>
                  <td className="px-4 py-3 text-[11px]" style={{ color: "#8B95A5" }}>{inv.due}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                      backgroundColor: inv.status === "paid" ? "#F0FDF4" : inv.status === "overdue" ? "#FEF2F2" : "#FFFBEB",
                      color: inv.status === "paid" ? "#059669" : inv.status === "overdue" ? "#EF4343" : "#D97706",
                    }}>
                      {inv.status === "paid" ? "Payée" : inv.status === "overdue" ? "En retard" : "En attente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reversements vendeurs */}
      {activeTab === "payouts" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Vendeur", "GMV", "Commission", "Net à reverser", "Date exécution", "Statut"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reversements.map((r) => (
                <tr key={`${r.seller}-${r.date}`} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "#1B5BDA" }}>{r.seller}</td>
                  <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#616B7C" }}>{fmt(r.gmv)} EUR</td>
                  <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#EF4343" }}>-{fmt(r.commission)} EUR</td>
                  <td className="px-4 py-3 text-[13px] font-bold font-mono" style={{ color: "#059669" }}>{fmt(r.net)} EUR</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{r.date}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                      backgroundColor: r.status === "completed" ? "#F0FDF4" : "#FFFBEB",
                      color: r.status === "completed" ? "#059669" : "#D97706",
                    }}>
                      {r.status === "completed" ? "Exécuté" : "En attente"}
                    </span>
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
