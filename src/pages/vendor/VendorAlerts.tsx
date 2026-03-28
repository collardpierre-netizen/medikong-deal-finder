import { useState } from "react";
import { VCard } from "@/components/vendor/ui/VCard";
import { VTabBar } from "@/components/vendor/ui/VTabBar";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { alertsData, alertRules } from "@/data/vendor-intel-mock";
import { Bell, Play, Pause, Edit2, TriangleAlert, Info, Shield } from "lucide-react";

const sevColors: Record<string, string> = { red: "#EF4343", amber: "#F59E0B", blue: "#1B5BDA" };
const sevIcons: Record<string, typeof TriangleAlert> = { red: TriangleAlert, amber: TriangleAlert, blue: Info };

export default function VendorAlerts() {
  const [activeTab, setActiveTab] = useState("alerts");
  const unread = alertsData.filter(a => !a.read).length;

  const tabs = [
    { id: "alerts", label: "Alertes recentes", badge: unread },
    { id: "rules", label: "Mes regles", badge: alertRules.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-[#1D2530]">Alertes & Watch Rules</h1>
        <VBtn primary icon="Plus">Nouvelle regle</VBtn>
      </div>

      <VTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === "alerts" && (
        <div className="space-y-3">
          {alertsData.map(a => {
            const color = sevColors[a.severity];
            const Icon = sevIcons[a.severity] || Info;
            return (
              <VCard key={a.id} className={`!border-l-4 ${a.read ? "opacity-60" : ""}`} style={{ borderLeftColor: color }}>
                <div className="flex items-start gap-3">
                  <Icon size={16} style={{ color }} className="shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-semibold text-[#1D2530]">{a.product}</span>
                      <VBadge color={color}>{a.severity === "red" ? "Critique" : a.severity === "amber" ? "Warning" : "Info"}</VBadge>
                    </div>
                    <p className="text-[12px] text-[#616B7C]">{a.message}</p>
                    <p className="text-[10px] text-[#8B95A5] mt-1">Regle : {a.rule}</p>
                  </div>
                  <span className="text-[10px] text-[#8B95A5] shrink-0">{a.date}</span>
                </div>
              </VCard>
            );
          })}
        </div>
      )}

      {activeTab === "rules" && (
        <VCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                  <th className="text-left py-2.5 px-3 font-medium">Regle</th>
                  <th className="text-left py-2.5 px-3 font-medium">Produit</th>
                  <th className="text-left py-2.5 px-3 font-medium">Condition</th>
                  <th className="text-left py-2.5 px-3 font-medium">Statut</th>
                  <th className="text-center py-2.5 px-3 font-medium">Declench.</th>
                  <th className="text-left py-2.5 px-3 font-medium">Dernier</th>
                  <th className="text-right py-2.5 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {alertRules.map(r => (
                  <tr key={r.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 font-medium text-[#1D2530]">{r.name}</td>
                    <td className="py-2.5 px-3 text-[#616B7C]">{r.product}</td>
                    <td className="py-2.5 px-3 text-[#616B7C]">{r.condition}</td>
                    <td className="py-2.5 px-3">
                      <VBadge color={r.status === "active" ? "#059669" : "#616B7C"}>{r.status === "active" ? "Active" : "En pause"}</VBadge>
                    </td>
                    <td className="py-2.5 px-3 text-center font-medium">{r.triggers}</td>
                    <td className="py-2.5 px-3 text-[#8B95A5]">{r.lastTriggered}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 hover:bg-[#F1F5F9] rounded"><Edit2 size={14} className="text-[#8B95A5]" /></button>
                        <button className="p-1.5 hover:bg-[#F1F5F9] rounded">
                          {r.status === "active" ? <Pause size={14} className="text-[#F59E0B]" /> : <Play size={14} className="text-[#059669]" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </VCard>
      )}
    </div>
  );
}
