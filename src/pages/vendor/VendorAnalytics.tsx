import { VCard } from "@/components/vendor/ui/VCard";
import { Database } from "lucide-react";

export default function VendorAnalytics() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Analytics</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">Performance et intelligence commerciale</p>
      </div>
      <VCard>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Database size={48} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Aucune donnée disponible</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-md">
            Les analytics de votre boutique s'afficheront ici dès que vous aurez des commandes et des offres actives.
          </p>
        </div>
      </VCard>
    </div>
  );
}
