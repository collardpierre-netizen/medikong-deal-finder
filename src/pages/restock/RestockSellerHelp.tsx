import { HelpCircle, Upload, Tag, Clock, Truck, Shield } from "lucide-react";

const helpItems = [
  { icon: Upload, title: "Préparer votre fichier Excel", desc: "Colonnes requises : EAN, nom produit, DLU, quantité, prix unitaire HTVA, état du lot. Le fichier est validé automatiquement à l'import." },
  { icon: Tag, title: "Fixer le bon prix", desc: "Proposez un prix attractif (généralement 30-60% sous le prix catalogue). Les acheteurs comparent avec les offres du marché." },
  { icon: Clock, title: "Date limite d'utilisation (DLU)", desc: "La DLU doit être supérieure à 1 mois. Les offres avec une DLU trop courte sont automatiquement refusées." },
  { icon: Truck, title: "Logistique", desc: "Deux options : enlèvement sur place par l'acheteur, ou forfait livraison MediKong. Le choix se fait lors de la confirmation." },
  { icon: Shield, title: "Commission", desc: "MediKong prélève 5% de commission sur chaque vente conclue. Aucun frais d'inscription ni d'abonnement." },
];

export default function RestockSellerHelp() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#EBF0FB]">
          <HelpCircle size={22} className="text-[#1C58D9]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1E252F]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Guide d'aide
          </h1>
          <p className="text-sm text-[#5C6470]">Tout ce qu'il faut savoir pour vendre sur ReStock</p>
        </div>
      </div>

      <div className="space-y-4">
        {helpItems.map((item, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#D0D5DC] p-5 shadow-[0_1px_3px_rgba(0,0,0,.06)]">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#EBF0FB] flex items-center justify-center shrink-0">
                <item.icon size={20} className="text-[#1C58D9]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#1E252F] mb-1">{item.title}</h3>
                <p className="text-sm text-[#5C6470] leading-relaxed">{item.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
