import { CheckCircle } from "lucide-react";

export default function RestockSellerSales() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#EEFBF4]">
          <CheckCircle size={22} className="text-[#00B85C]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1E252F]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Ventes conclues
          </h1>
          <p className="text-sm text-[#5C6470]">Historique de vos ventes finalisées via ReStock</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#D0D5DC] shadow-[0_1px_3px_rgba(0,0,0,.06)]">
        <div className="text-center py-16 text-[#8B929C]">
          <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-[#5C6470]">Aucune vente conclue pour le moment</p>
          <p className="text-sm mt-1">Vos ventes apparaîtront ici une fois qu'un acheteur aura confirmé une commande.</p>
        </div>
      </div>
    </div>
  );
}
