import { VCard } from "@/components/vendor/ui/VCard";
import { FileText } from "lucide-react";

export default function VendorTenders() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Appels d'offres</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">Marchés publics et demandes de devis</p>
      </div>
      <VCard>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText size={48} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Aucun appel d'offres</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-md">
            Les appels d'offres et demandes de devis apparaîtront ici lorsque des acheteurs publieront des marchés correspondant à votre catalogue.
          </p>
        </div>
      </VCard>
    </div>
  );
}
