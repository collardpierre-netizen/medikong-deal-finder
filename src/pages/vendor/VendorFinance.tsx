import { VCard } from "@/components/vendor/ui/VCard";
import { Wallet } from "lucide-react";

export default function VendorFinance() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Finances</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">Revenus, commissions et reversements</p>
      </div>
      <VCard>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Wallet size={48} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Aucune transaction</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-md">
            Vos revenus, commissions et historique de reversements apparaîtront ici dès vos premières ventes.
          </p>
        </div>
      </VCard>
    </div>
  );
}
