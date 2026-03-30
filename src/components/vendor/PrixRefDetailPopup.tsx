import { X } from "lucide-react";

interface PrixRefDetailPopupProps {
  productName: string;
  onClose: () => void;
}

export default function PrixRefDetailPopup({ productName, onClose }: PrixRefDetailPopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <X size={18} className="text-[#8B95A5]" />
        </button>
        <h2 className="text-[16px] font-bold text-[#1D2530] mb-4">Prix de référence — {productName}</h2>
        <p className="text-[13px] text-[#8B95A5] py-8 text-center">
          Les prix de référence seront disponibles une fois configurés dans l'administration.
        </p>
      </div>
    </div>
  );
}
