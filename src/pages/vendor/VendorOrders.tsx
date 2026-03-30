import { VCard } from "@/components/vendor/ui/VCard";
import { ShoppingCart } from "lucide-react";

export default function VendorOrders() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Commandes</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">Gestion de vos commandes</p>
      </div>
      <VCard>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingCart size={48} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Aucune commande</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-md">
            Vos commandes apparaîtront ici dès qu'un acheteur passera commande sur vos offres.
          </p>
        </div>
      </VCard>
    </div>
  );
}
