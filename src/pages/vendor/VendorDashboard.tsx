import { useNavigate } from "react-router-dom";
import { VCard } from "@/components/vendor/ui/VCard";
import { VStat } from "@/components/vendor/ui/VStat";
import { VMiniBar } from "@/components/vendor/ui/VMiniBar";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VProgressBar } from "@/components/vendor/ui/VProgressBar";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { vendorProfile, buyerTypeColors } from "@/lib/vendor-tokens";
import { dashboardAlerts, dashboardOrders, dashboardMessages, pricingCoachSuggestions } from "@/data/vendor-mock";
import { AlertTriangle, MessageSquare, ArrowRight, Sparkles, CircleDot } from "lucide-react";

const statusLabels: Record<string, string> = { pending: "En attente", confirmed: "A expedier", shipped: "Expedie", delivered: "Livre" };
const statusColors: Record<string, string> = { pending: "#F59E0B", confirmed: "#1B5BDA", shipped: "#7C3AED", delivered: "#059669" };

function orderAgeBadge(hours: number) {
  if (hours < 4) return { label: `${hours}h`, color: "#059669" };
  if (hours < 12) return { label: `${hours}h`, color: "#1B5BDA" };
  if (hours < 24) return { label: `${hours}h`, color: "#F59E0B" };
  const days = Math.floor(hours / 24);
  return { label: `${days}j`, color: "#EF4343" };
}

const today = new Date();
const dateStr = today.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function VendorDashboard() {
  const navigate = useNavigate();
  const pendingOrders = dashboardOrders.filter(o => o.status === "pending" || o.status === "confirmed");
  const sparkData = [5800, 6200, 7100, 5400, 6800, 7200, 6700];
  const dayOfWeek = today.getDay();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Bonjour, {vendorProfile.name.split(" ")[0]}</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5 capitalize">{dateStr}</p>
      </div>

      {/* Urgent Alerts */}
      {dashboardAlerts.length > 0 && (
        <VCard className="!border-l-4 !border-l-[#F59E0B] !bg-[#FFFBEB]">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-[#F59E0B]" />
            <h3 className="text-sm font-semibold text-[#1D2530]">Alertes urgentes</h3>
            <VBadge color="#F59E0B">{dashboardAlerts.length}</VBadge>
          </div>
          <div className="space-y-2.5">
            {dashboardAlerts.map(a => (
              <div key={a.id} className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: a.severity === "red" ? "#EF4343" : "#F59E0B" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#1D2530]"><span className="font-semibold">{a.product}</span> — {a.message}</p>
                </div>
                <span className="text-[11px] text-[#8B95A5] shrink-0">{a.date}</span>
              </div>
            ))}
          </div>
        </VCard>
      )}

      {/* Pending Orders */}
      {pendingOrders.length > 0 && (
        <VCard className="!border-l-4 !border-l-[#EF4343] !bg-[#FEF2F2]">
          <div className="flex items-center gap-2 mb-3">
            <CircleDot size={16} className="text-[#EF4343]" />
            <h3 className="text-sm font-semibold text-[#1D2530]">Commandes a traiter</h3>
            <VBadge color="#EF4343">{pendingOrders.length}</VBadge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingOrders.map(o => {
              const age = orderAgeBadge(o.age);
              return (
                <div key={o.id} className="bg-white rounded-lg border border-[#E2E8F0] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-[#8B95A5]">{o.id}</span>
                    <VBadge color={age.color}>{age.label}</VBadge>
                  </div>
                  <p className="text-[13px] font-semibold text-[#1D2530]">{o.buyer}</p>
                  <p className="text-[11px] text-[#616B7C] mb-3">{o.status === "pending" ? "En attente de confirmation" : "A expedier"}</p>
                  <VBtn small primary>{o.status === "pending" ? "Traiter" : "Expedier"}</VBtn>
                </div>
              );
            })}
          </div>
        </VCard>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <VStat label="CA du mois" value="45 200 EUR" icon="Euro" color="#1B5BDA" trend={8.3} sub="vs mois dernier" />
        <VStat label="Commandes" value="234" icon="ShoppingCart" color="#059669" trend={12} sub="ce mois" />
        <VStat label="Offres actives" value="189" icon="Tag" color="#7C3AED" trend={5} sub="sur 340 refs" />
        <VStat label="Taux Buy Box" value="72%" icon="Trophy" color="#F59E0B" trend={-3} sub="vs mois dernier" />
      </div>

      {/* Sparkline CA 7j */}
      <VCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#1D2530]">CA des 7 derniers jours</h3>
          <span className="text-[11px] text-[#8B95A5]">Total : {sparkData.reduce((a, b) => a + b, 0).toLocaleString("fr-BE")} EUR</span>
        </div>
        <div className="flex items-end gap-1.5 h-16">
          {sparkData.map((v, i) => {
            const max = Math.max(...sparkData);
            const isToday = i === (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${(v / max) * 100}%`,
                    backgroundColor: isToday ? "#1B5BDA" : "#1B5BDA40",
                  }}
                />
                <span className="text-[9px] text-[#8B95A5]">{["L","M","M","J","V","S","D"][i]}</span>
              </div>
            );
          })}
        </div>
      </VCard>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Left: Recent Orders */}
        <VCard>
          <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Dernieres commandes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                  <th className="text-left py-2 font-medium">Commande</th>
                  <th className="text-left py-2 font-medium">Acheteur</th>
                  <th className="text-left py-2 font-medium">Type</th>
                  <th className="text-right py-2 font-medium">Total TTC</th>
                  <th className="text-left py-2 font-medium">Statut</th>
                  <th className="text-right py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {dashboardOrders.map(o => {
                  const bt = buyerTypeColors[o.buyerType] || { text: "#616B7C", bg: "#616B7C18" };
                  return (
                    <tr key={o.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-2.5 font-mono text-[11px] text-[#8B95A5]">{o.id}</td>
                      <td className="py-2.5 font-medium text-[#1D2530]">{o.buyer}</td>
                      <td className="py-2.5"><VBadge color={bt.text} bg={bt.bg}>{o.buyerType}</VBadge></td>
                      <td className="py-2.5 text-right font-medium text-[#1D2530]">{o.total.toLocaleString("fr-BE", { minimumFractionDigits: 2 })} EUR</td>
                      <td className="py-2.5"><VBadge color={statusColors[o.status]}>{statusLabels[o.status]}</VBadge></td>
                      <td className="py-2.5 text-right text-[#8B95A5]">{o.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </VCard>

        {/* Right column */}
        <div className="space-y-4">
          {/* Health */}
          <VCard>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#1D2530]">Sante du compte</h3>
              <span className="text-lg font-bold text-[#1D2530]">{vendorProfile.score}<span className="text-[13px] text-[#8B95A5] font-normal">/100</span></span>
            </div>
            <VProgressBar value={vendorProfile.score} color="#1B5BDA" />
            <p className="text-[11px] text-[#8B95A5] mt-2">Niveau {vendorProfile.level} — Commission {vendorProfile.commissionRate}%</p>
            <div className="flex gap-2 mt-3">
              <VBadge color="#059669">Livraison OK</VBadge>
              <VBadge color="#059669">Litiges OK</VBadge>
              <VBadge color="#F59E0B">Buy Box !</VBadge>
            </div>
          </VCard>

          {/* Messages */}
          <VCard>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1D2530]">Messages</h3>
              <VBadge color="#1B5BDA">{dashboardMessages.filter(m => m.unread).length} non lus</VBadge>
            </div>
            <div className="space-y-2.5">
              {dashboardMessages.map(m => (
                <div key={m.id} className="flex items-start gap-2.5">
                  {m.unread && <span className="w-2 h-2 rounded-full bg-[#1B5BDA] shrink-0 mt-1.5" />}
                  {!m.unread && <span className="w-2 h-2 shrink-0 mt-1.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#1D2530] truncate">{m.from}</p>
                    <p className="text-[11px] text-[#616B7C] truncate">{m.subject}</p>
                  </div>
                  <span className="text-[10px] text-[#8B95A5] shrink-0">{m.date}</span>
                </div>
              ))}
            </div>
          </VCard>

          {/* Next payout */}
          <div className="rounded-[10px] p-5" style={{ background: "linear-gradient(135deg, #1E293B 0%, #334155 100%)" }}>
            <p className="text-[11px] text-white/50 font-medium uppercase tracking-wide">Prochain reversement</p>
            <p className="text-2xl font-bold text-white mt-1">3 280,50 EUR</p>
            <p className="text-[12px] text-white/40 mt-1">Prevu le 02/04/2026</p>
          </div>
        </div>
      </div>

      {/* Pricing Coach */}
      <VCard className="!border-l-4 !border-l-[#7C3AED]">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-[#7C3AED]" />
          <h3 className="text-sm font-semibold text-[#1D2530]">Pricing Coach IA</h3>
          <VBadge color="#7C3AED">3 recommandations</VBadge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {pricingCoachSuggestions.map((s, i) => (
            <div key={i} className="bg-[#F8FAFC] rounded-lg p-3.5 border border-[#E2E8F0]">
              <p className="text-[12px] font-semibold text-[#1D2530] mb-1">{s.product}</p>
              <p className="text-[13px] font-medium mb-2" style={{ color: s.color }}>{s.action}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-[#059669]">
                <ArrowRight size={12} />
                <span className="font-medium">{s.impact}</span>
              </div>
            </div>
          ))}
        </div>
      </VCard>
    </div>
  );
}
