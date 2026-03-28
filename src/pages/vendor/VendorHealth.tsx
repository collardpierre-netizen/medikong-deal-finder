import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VProgressBar } from "@/components/vendor/ui/VProgressBar";
import { Clock, CheckCircle, AlertTriangle, ShieldCheck, Package, MessageSquare, Award, FileCheck, BarChart3 } from "lucide-react";

const score = 87;
const level = "Gold";
const nextLevel = "Platinum";
const nextScore = 93;

const metrics = [
  { label: "Taux livraison a temps", value: "94%", target: "Cible 95%", status: "attention" as const, icon: Clock },
  { label: "Taux litige", value: "1,2%", target: "Cible <2%", status: "ok" as const, icon: ShieldCheck },
  { label: "Delai expedition moyen", value: "1,8j", target: "Cible <2j", status: "ok" as const, icon: Package },
  { label: "Taux Buy Box", value: "72%", target: "Cible 70%", status: "ok" as const, icon: Award },
  { label: "Score qualite fiches", value: "85%", target: "Cible 80%", status: "ok" as const, icon: FileCheck },
  { label: "Taux reponse messages", value: "98%", target: "Cible 95%", status: "ok" as const, icon: MessageSquare },
  { label: "Certificats a jour", value: "100%", target: "Cible 100%", status: "ok" as const, icon: CheckCircle },
  { label: "Offres avec rupture", value: "1", target: "Cible 0", status: "attention" as const, icon: AlertTriangle },
];

const levels = [
  { name: "Bronze", score: "0-59", commission: "14%", visibility: "Standard", support: "Email", ao: "Non" },
  { name: "Silver", score: "60-79", commission: "13%", visibility: "+5%", support: "Email + Chat", ao: "Limite" },
  { name: "Gold", score: "80-92", commission: "12%", visibility: "+15%", support: "Prioritaire", ao: "Oui" },
  { name: "Platinum", score: "93+", commission: "10%", visibility: "+25%", support: "Dedie", ao: "Prioritaire" },
];

export default function VendorHealth() {
  const scoreColor = score >= 80 ? "#059669" : score >= 60 ? "#F59E0B" : "#EF4343";
  const gradient = `conic-gradient(${scoreColor} ${score * 3.6}deg, #E2E8F0 0deg)`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-[#1D2530]">Sante du Compte</h1>
        <VBadge color={scoreColor}>{level} — {score}/100</VBadge>
      </div>

      {/* Score card */}
      <VCard>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Donut */}
          <div className="relative w-32 h-32 shrink-0">
            <div className="w-full h-full rounded-full" style={{ background: gradient }} />
            <div className="absolute inset-3 bg-white rounded-full flex items-center justify-center flex-col">
              <span className="text-2xl font-bold" style={{ color: scoreColor }}>{score}</span>
              <span className="text-[10px] text-[#8B95A5]">/100</span>
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-lg font-bold text-[#1D2530]">Niveau {level}</p>
            <p className="text-[13px] text-[#616B7C] mt-1">Prochain niveau : <strong>{nextLevel}</strong> ({nextScore}+)</p>
            <VProgressBar value={score} color={scoreColor} height={8} />
            <p className="text-[12px] text-[#616B7C] mt-2">Il vous manque <strong className="text-[#1B5BDA]">{nextScore - score} points</strong> pour atteindre {nextLevel} et beneficier d'une commission reduite a 10%.</p>

            <div className="flex flex-wrap gap-2 mt-3">
              <VBadge color="#059669">Commission 12%</VBadge>
              <VBadge color="#1B5BDA">Visibilite +15%</VBadge>
              <VBadge color="#7C3AED">Support Prioritaire</VBadge>
            </div>
          </div>
        </div>
      </VCard>

      {/* Health metrics grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {metrics.map(m => {
          const isOk = m.status === "ok";
          const color = isOk ? "#059669" : "#F59E0B";
          return (
            <VCard key={m.label} className="!border-l-4 !p-4" style={{ borderLeftColor: color }}>
              <div className="flex items-start gap-3">
                <m.icon size={18} style={{ color }} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-[#616B7C]">{m.label}</span>
                    <VBadge color={color}>{isOk ? "OK" : "Attention"}</VBadge>
                  </div>
                  <p className="text-xl font-bold text-[#1D2530]">{m.value}</p>
                  <p className="text-[10px] text-[#8B95A5] mt-0.5">{m.target}</p>
                </div>
              </div>
            </VCard>
          );
        })}
      </div>

      {/* Levels table */}
      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Niveaux et avantages</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                <th className="text-left py-2.5 px-3 font-medium">Niveau</th>
                <th className="text-left py-2.5 px-3 font-medium">Score</th>
                <th className="text-left py-2.5 px-3 font-medium">Commission</th>
                <th className="text-left py-2.5 px-3 font-medium">Visibilite</th>
                <th className="text-left py-2.5 px-3 font-medium">Support</th>
                <th className="text-left py-2.5 px-3 font-medium">Acces AO</th>
              </tr>
            </thead>
            <tbody>
              {levels.map(l => {
                const isCurrent = l.name === level;
                return (
                  <tr key={l.name} className={`border-b border-[#E2E8F0] last:border-0 ${isCurrent ? "bg-[#1B5BDA08]" : ""}`}>
                    <td className={`py-2.5 px-3 ${isCurrent ? "font-bold text-[#1B5BDA]" : "font-medium text-[#1D2530]"}`}>{l.name}</td>
                    <td className="py-2.5 px-3 text-[#616B7C]">{l.score}</td>
                    <td className={`py-2.5 px-3 ${isCurrent ? "font-bold text-[#1D2530]" : "text-[#616B7C]"}`}>{l.commission}</td>
                    <td className={`py-2.5 px-3 ${isCurrent ? "font-bold text-[#1D2530]" : "text-[#616B7C]"}`}>{l.visibility}</td>
                    <td className={`py-2.5 px-3 ${isCurrent ? "font-bold text-[#1D2530]" : "text-[#616B7C]"}`}>{l.support}</td>
                    <td className={`py-2.5 px-3 ${isCurrent ? "font-bold text-[#1D2530]" : "text-[#616B7C]"}`}>{l.ao}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </VCard>
    </div>
  );
}
