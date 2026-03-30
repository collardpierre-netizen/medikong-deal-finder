import { X } from "lucide-react";
import { VBtn } from "@/components/vendor/ui/VBtn";

interface EditOfferPopupProps {
  offerId: string;
  onClose: () => void;
}

export default function EditOfferPopup({ offerId, onClose }: EditOfferPopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <X size={18} className="text-[#8B95A5]" />
        </button>
        <h2 className="text-[16px] font-bold text-[#1D2530] mb-4">Modifier l'offre</h2>
        <p className="text-[13px] text-[#8B95A5] py-8 text-center">
          L'éditeur d'offres sera disponible une fois les offres réelles chargées depuis la base de données.
        </p>
        <div className="flex justify-end">
          <VBtn small onClick={onClose}>Fermer</VBtn>
        </div>
      </div>
    </div>
  );
}
