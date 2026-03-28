import { Check } from "lucide-react";

const items = ["Produits certifiés CE", "Fournisseurs vérifiés", "Protection acheteur"];

export function TrustBar() {
  return (
    <div className="bg-mk-trust border-b border-mk-line py-2.5">
      <div className="mk-container flex items-center justify-center gap-4 md:gap-8 overflow-x-auto">
        {items.map(item => (
          <div key={item} className="flex items-center gap-1.5 text-xs md:text-sm text-mk-sec whitespace-nowrap">
            <Check size={14} className="text-mk-green shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
