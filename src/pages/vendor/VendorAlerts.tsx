import { VCard } from "@/components/vendor/ui/VCard";
import { Bell } from "lucide-react";

export default function VendorAlerts() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Alertes</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">Notifications et règles d'alerte</p>
      </div>
      <VCard>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell size={48} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Aucune alerte configurée</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-md">
            Les alertes de prix, stock et concurrence seront disponibles dès que vos offres seront actives sur la marketplace.
          </p>
        </div>
      </VCard>
    </div>
  );
}
