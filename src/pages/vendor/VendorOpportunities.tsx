import { VCard } from "@/components/vendor/ui/VCard";
import { Sparkles } from "lucide-react";

export default function VendorOpportunities() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Intelligence Marché</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">Opportunités et veille concurrentielle</p>
      </div>
      <VCard>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles size={48} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Aucune opportunité détectée</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-md">
            Les opportunités de marché, analyses de Buy Box et recommandations de pricing s'afficheront ici dès que la marketplace sera alimentée en données.
          </p>
        </div>
      </VCard>
    </div>
  );
}
