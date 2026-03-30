import { VCard } from "@/components/vendor/ui/VCard";
import { Tag } from "lucide-react";

export default function VendorOffers() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Mes Offres</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">Gestion de votre catalogue d'offres</p>
      </div>
      <VCard>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Tag size={48} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Aucune offre active</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-md">
            Créez vos premières offres pour commencer à vendre sur MediKong. Vos offres, prix et stocks seront gérés ici.
          </p>
        </div>
      </VCard>
    </div>
  );
}
