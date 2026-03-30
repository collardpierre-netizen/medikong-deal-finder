import { VCard } from "@/components/vendor/ui/VCard";
import { Package } from "lucide-react";

export default function VendorCatalog() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Catalogue</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">Gestion de vos produits</p>
      </div>
      <VCard>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package size={48} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Catalogue vide</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-md">
            Importez vos produits via CSV ou ajoutez-les manuellement pour constituer votre catalogue vendeur.
          </p>
        </div>
      </VCard>
    </div>
  );
}
