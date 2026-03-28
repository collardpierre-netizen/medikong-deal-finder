import { Check, X } from "lucide-react";

const eligible = [
  "Résidents fiscaux belges (personnes physiques)",
  "Sociétés belges assujetties à l'impôt des sociétés",
  "Résidents UE sous conditions",
  "Investisseurs qualifiés (MiFID II)",
];

const notEligible = [
  "Résidents hors UE",
  "Mineurs (< 18 ans)",
  "Sociétés en liquidation",
  "Investisseurs institutionnels non agréés",
];

export function EligibilityGrid() {
  return (
    <div className="bg-[#F8FAFC] p-6 md:p-9 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h4 className="text-base font-bold text-[#059669] mb-4 flex items-center gap-2">
          <Check className="w-5 h-5" /> Éligible
        </h4>
        {eligible.map((item) => (
          <div key={item} className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Check className="w-4 h-4 text-[#059669] shrink-0" /> {item}
          </div>
        ))}
      </div>
      <div>
        <h4 className="text-base font-bold text-[#EF4444] mb-4 flex items-center gap-2">
          <X className="w-5 h-5" /> Non éligible
        </h4>
        {notEligible.map((item) => (
          <div key={item} className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <X className="w-4 h-4 text-[#EF4444] shrink-0" /> {item}
          </div>
        ))}
      </div>
    </div>
  );
}
