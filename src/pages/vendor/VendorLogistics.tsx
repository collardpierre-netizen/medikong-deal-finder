import { VCard } from "@/components/vendor/ui/VCard";
import { Truck } from "lucide-react";

export default function VendorLogistics() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Logistique</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">Expéditions, transporteurs et suivi livraisons</p>
      </div>
      <VCard>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Truck size={48} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Aucune expédition</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-md">
            Vos expéditions, transporteurs configurés et historique de livraisons apparaîtront ici dès vos premières commandes.
          </p>
        </div>
      </VCard>
    </div>
  );
}
