import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VProgressBar } from "@/components/vendor/ui/VProgressBar";
import { icons, Info } from "lucide-react";

const academyModules = [
  { id: 1, title: "Demarrer sur MediKong", category: "Onboarding", duration: "15 min", progress: 100, icon: "Play" as keyof typeof icons, lessons: 5 },
  { id: 2, title: "Optimiser vos fiches produit", category: "Catalogue", duration: "20 min", progress: 60, icon: "Tag" as keyof typeof icons, lessons: 8 },
  { id: 3, title: "Comprendre la reglementation MDR", category: "Conformite", duration: "30 min", progress: 25, icon: "Shield" as keyof typeof icons, lessons: 12 },
  { id: 4, title: "Strategies prix competitifs", category: "Commercial", duration: "25 min", progress: 0, icon: "DollarSign" as keyof typeof icons, lessons: 10 },
  { id: 5, title: "Gerer la logistique B2B", category: "Operations", duration: "20 min", progress: 0, icon: "Truck" as keyof typeof icons, lessons: 7 },
  { id: 6, title: "Repondre aux appels d'offres", category: "Commercial", duration: "15 min", progress: 0, icon: "FileText" as keyof typeof icons, lessons: 6 },
];

const completed = academyModules.filter(m => m.progress === 100).length;

export default function VendorAcademy() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-[#1D2530]">MediKong Academy</h1>
        <VBadge color="#059669">{completed}/{academyModules.length} modules completes</VBadge>
      </div>

      <VCard className="!border-l-4 !border-l-[#1B5BDA]">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-[#1B5BDA] shrink-0" />
          <p className="text-[12px] text-[#616B7C]">Completez les modules pour ameliorer votre score de sante et debloquer des avantages.</p>
        </div>
      </VCard>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {academyModules.map(m => {
          const Icon = icons[m.icon];
          const isDone = m.progress === 100;
          const color = isDone ? "#059669" : "#1B5BDA";
          return (
            <VCard key={m.id} className="!p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: color + "14" }}>
                  {Icon && <Icon size={20} style={{ color }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1D2530]">{m.title}</p>
                  <p className="text-[11px] text-[#8B95A5]">{m.category} · {m.duration} · {m.lessons} lecons</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <VProgressBar value={m.progress} color={color} height={6} />
                <span className="text-[11px] font-semibold shrink-0" style={{ color }}>{m.progress}%</span>
              </div>
              {!isDone && (
                <VBtn small primary className="w-full !justify-center">
                  {m.progress > 0 ? "Continuer" : "Commencer"}
                </VBtn>
              )}
            </VCard>
          );
        })}
      </div>
    </div>
  );
}
