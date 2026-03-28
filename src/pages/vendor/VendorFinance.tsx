import { useState } from "react";
import { VCard } from "@/components/vendor/ui/VCard";
import { VTabBar } from "@/components/vendor/ui/VTabBar";
import { VStat } from "@/components/vendor/ui/VStat";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VProgressBar } from "@/components/vendor/ui/VProgressBar";
import { FileText, Info } from "lucide-react";

const caData = [
  { month: "Sep", value: 28400 }, { month: "Oct", value: 32400 }, { month: "Nov", value: 38200 },
  { month: "Dec", value: 41500 }, { month: "Jan", value: 35800 }, { month: "Fev", value: 39600 },
  { month: "Mar", value: 45200 },
];
const maxCA = Math.max(...caData.map(m => m.value));

const invoices = [
  { id: "INV-001", date: "01/03", type: "Commission", amount: -540.00, status: "paid" },
  { id: "INV-002", date: "05/03", type: "Reversement", amount: 4200.00, status: "paid" },
  { id: "INV-003", date: "12/03", type: "Commission", amount: -680.00, status: "paid" },
  { id: "INV-004", date: "19/03", type: "Reversement", amount: 5300.00, status: "pending" },
  { id: "INV-005", date: "26/03", type: "Commission", amount: -440.00, status: "pending" },
];

const reversements = [
  { id: "REV-004", amount: 5300.00, ref: "INV-004", orders: 18, date: "19/03/2026", status: "pending" },
  { id: "REV-003", amount: 4200.00, ref: "INV-002", orders: 14, date: "05/03/2026", status: "paid" },
  { id: "REV-002", amount: 3920.00, ref: "REV-002", orders: 12, date: "19/02/2026", status: "paid" },
  { id: "REV-001", amount: 8920.00, ref: "REV-001", orders: 28, date: "05/02/2026", status: "paid" },
];

export default function VendorFinance() {
  const [activeTab, setActiveTab] = useState("overview");
  const tabs = [
    { id: "overview", label: "Apercu" },
    { id: "invoices", label: "Factures & Notes", badge: invoices.length },
    { id: "payouts", label: "Reversements" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-[#1D2530]">Finances</h1>
        <div className="flex gap-2">
          <VBtn icon="Download">Telecharger releves</VBtn>
          <VBtn icon="FileText">Factures</VBtn>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <VStat label="Solde disponible" value="12 450,80 EUR" icon="Wallet" color="#059669" />
        <VStat label="En attente" value="3 280,50 EUR" icon="Clock" color="#F59E0B" />
        <VStat label="Commission totale" value="6 786,00 EUR" sub="12% de taux" icon="Percent" color="#EF4343" />
        <VStat label="Dernier reversement" value="8 920,00 EUR" icon="ArrowDownRight" color="#1B5BDA" />
      </div>

      <VTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* CA Chart */}
            <VCard className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-[#1D2530] mb-4">Chiffre d'affaires mensuel</h3>
              <div className="flex items-end gap-2 h-40">
                {caData.map((m, i) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-medium text-[#1D2530]">{(m.value / 1000).toFixed(1)}k</span>
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${(m.value / maxCA) * 100}%`,
                        backgroundColor: i === caData.length - 1 ? "#1B5BDA" : "#1B5BDA50",
                      }}
                    />
                    <span className="text-[10px] text-[#8B95A5]">{m.month}</span>
                  </div>
                ))}
              </div>
            </VCard>

            {/* Right column */}
            <div className="space-y-4">
              <div className="rounded-[10px] p-5 text-white" style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
                <p className="text-[11px] font-medium text-white/70 uppercase tracking-wide">Prochain reversement</p>
                <p className="text-2xl font-bold mt-1">3 280,50 EUR</p>
                <p className="text-[12px] text-white/80 mt-1">Prevu le 02/04/2026</p>
              </div>
              <VCard>
                <p className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide mb-2">Repartition commissions</p>
                <VProgressBar value={12} max={14} color="#1B5BDA" height={6} />
                <p className="text-[11px] text-[#616B7C] mt-2">Taux : <strong className="text-[#1D2530]">12%</strong> — Niveau Gold (14% standard → 12% Gold)</p>
              </VCard>
            </div>
          </div>

          {/* TVA Ventilation */}
          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-4">Ventilation TVA</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="bg-[#F8FAFC] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-semibold text-[#1D2530]">TVA 6% — Dispositifs medicaux</p>
                    <VBadge color="#1B5BDA">46%</VBadge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[12px] mb-2">
                    <div><span className="text-[#8B95A5]">Base HT</span><br /><strong className="text-[#1D2530]">20 760,00 EUR</strong></div>
                    <div><span className="text-[#8B95A5]">TVA collectee</span><br /><strong className="text-[#1D2530]">1 245,60 EUR</strong></div>
                  </div>
                  <VProgressBar value={46} color="#1B5BDA" height={4} />
                  <p className="text-[10px] text-[#8B95A5] mt-1">46% du CA — 142 lignes</p>
                </div>

                <div className="bg-[#F8FAFC] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-semibold text-[#1D2530]">TVA 21% — OTC / Cosmetique / Hygiene</p>
                    <VBadge color="#7C3AED">54%</VBadge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[12px] mb-2">
                    <div><span className="text-[#8B95A5]">Base HT</span><br /><strong className="text-[#1D2530]">24 440,00 EUR</strong></div>
                    <div><span className="text-[#8B95A5]">TVA collectee</span><br /><strong className="text-[#1D2530]">5 132,40 EUR</strong></div>
                  </div>
                  <VProgressBar value={54} color="#7C3AED" height={4} />
                  <p className="text-[10px] text-[#8B95A5] mt-1">54% du CA — 92 lignes</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg p-4 border" style={{ backgroundColor: "#1B5BDA08", borderColor: "#1B5BDA30" }}>
                  <p className="text-[11px] font-semibold text-[#1B5BDA] uppercase tracking-wide mb-3">Resume TVA mensuel</p>
                  <div className="space-y-2 text-[13px]">
                    <div className="flex justify-between"><span className="text-[#616B7C]">Total HT</span><span className="font-medium text-[#1D2530]">45 200,00 EUR</span></div>
                    <div className="flex justify-between"><span className="text-[#616B7C]">TVA 6%</span><span className="font-medium text-[#1D2530]">1 245,60 EUR</span></div>
                    <div className="flex justify-between"><span className="text-[#616B7C]">TVA 21%</span><span className="font-medium text-[#1D2530]">5 132,40 EUR</span></div>
                    <div className="flex justify-between"><span className="text-[#616B7C]">Total TVA</span><span className="font-medium text-[#1D2530]">6 378,00 EUR</span></div>
                    <div className="border-t border-[#1B5BDA30] pt-2 mt-2 flex justify-between">
                      <span className="font-semibold text-[#1B5BDA]">Total TTC</span>
                      <span className="font-bold text-[#1B5BDA] text-base">51 578,00 EUR</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#F8FAFC] rounded-lg p-3 flex gap-2 text-[11px] text-[#616B7C]">
                  <Info size={14} className="text-[#8B95A5] shrink-0 mt-0.5" />
                  <span>Belgique : 6% pour dispositifs medicaux (MDR), 21% pour OTC/cosmetique/hygiene. Declaration SPF Finances trimestrielle.</span>
                </div>
              </div>
            </div>
          </VCard>
        </div>
      )}

      {activeTab === "invoices" && (
        <VCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                  <th className="text-left py-2.5 px-3 font-medium">Ref</th>
                  <th className="text-left py-2.5 px-3 font-medium">Date</th>
                  <th className="text-left py-2.5 px-3 font-medium">Type</th>
                  <th className="text-right py-2.5 px-3 font-medium">Montant</th>
                  <th className="text-left py-2.5 px-3 font-medium">Statut</th>
                  <th className="text-right py-2.5 px-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#8B95A5]">{inv.id}</td>
                    <td className="py-2.5 px-3 text-[#616B7C]">{inv.date}</td>
                    <td className="py-2.5 px-3">
                      <VBadge color={inv.type === "Commission" ? "#EF4343" : "#059669"}>{inv.type}</VBadge>
                    </td>
                    <td className={`py-2.5 px-3 text-right font-medium ${inv.amount > 0 ? "text-[#059669]" : "text-[#EF4343]"}`}>
                      {inv.amount > 0 ? "+" : ""}{inv.amount.toFixed(2).replace(".", ",")} EUR
                    </td>
                    <td className="py-2.5 px-3">
                      <VBadge color={inv.status === "paid" ? "#059669" : "#F59E0B"}>{inv.status === "paid" ? "Paye" : "En attente"}</VBadge>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <VBtn small icon="Download">PDF</VBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </VCard>
      )}

      {activeTab === "payouts" && (
        <div className="space-y-3">
          {reversements.map(r => (
            <VCard key={r.id} className="!p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-[#1D2530]">{r.amount.toLocaleString("fr-BE", { minimumFractionDigits: 2 })} EUR</p>
                  <p className="text-[12px] text-[#616B7C]">{r.ref} · {r.orders} commandes</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] text-[#8B95A5]">{r.date}</p>
                  <VBadge color={r.status === "paid" ? "#059669" : "#F59E0B"}>{r.status === "paid" ? "Verse" : "En attente"}</VBadge>
                </div>
              </div>
            </VCard>
          ))}
        </div>
      )}
    </div>
  );
}
