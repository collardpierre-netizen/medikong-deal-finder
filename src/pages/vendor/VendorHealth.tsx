import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { BarChart3 } from "lucide-react";

const levels = [
  { name: "Bronze", score: "0-59", commission: "14%", visibility: "Standard", support: "Email", ao: "Non" },
  { name: "Silver", score: "60-79", commission: "13%", visibility: "+5%", support: "Email + Chat", ao: "Limité" },
  { name: "Gold", score: "80-92", commission: "12%", visibility: "+15%", support: "Prioritaire", ao: "Oui" },
  { name: "Platinum", score: "93+", commission: "10%", visibility: "+25%", support: "Dédié", ao: "Prioritaire" },
];

export default function VendorHealth() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-[#1D2530]">Santé du Compte</h1>

      {/* Empty state — real metrics coming soon */}
      <VCard>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 size={48} style={{ color: "#CBD5E1" }} className="mb-4" />
          <h3 className="text-[15px] font-bold mb-2 text-[#1D2530]">Pas encore de données</h3>
          <p className="text-[13px] max-w-md text-[#8B95A5]">
            Votre score de santé sera calculé automatiquement dès que vous aurez des commandes et de l'activité sur votre compte.
          </p>
        </div>
      </VCard>

      {/* Levels table — static reference */}
      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Niveaux et avantages</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                <th className="text-left py-2.5 px-3 font-medium">Niveau</th>
                <th className="text-left py-2.5 px-3 font-medium">Score</th>
                <th className="text-left py-2.5 px-3 font-medium">Commission</th>
                <th className="text-left py-2.5 px-3 font-medium">Visibilité</th>
                <th className="text-left py-2.5 px-3 font-medium">Support</th>
                <th className="text-left py-2.5 px-3 font-medium">Accès AO</th>
              </tr>
            </thead>
            <tbody>
              {levels.map(l => (
                <tr key={l.name} className="border-b border-[#E2E8F0] last:border-0">
                  <td className="py-2.5 px-3 font-medium text-[#1D2530]">{l.name}</td>
                  <td className="py-2.5 px-3 text-[#616B7C]">{l.score}</td>
                  <td className="py-2.5 px-3 text-[#616B7C]">{l.commission}</td>
                  <td className="py-2.5 px-3 text-[#616B7C]">{l.visibility}</td>
                  <td className="py-2.5 px-3 text-[#616B7C]">{l.support}</td>
                  <td className="py-2.5 px-3 text-[#616B7C]">{l.ao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </VCard>
    </div>
  );
}
