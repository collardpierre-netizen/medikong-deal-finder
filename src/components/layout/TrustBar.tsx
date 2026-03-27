import { Check } from "lucide-react";

const items = ["Produits certifies CE", "Fournisseurs verifies", "Protection acheteur"];

export function TrustBar() {
  return (
    <div className="bg-mk-trust border-b border-mk-line py-2.5">
      <div className="mk-container flex items-center justify-center gap-8">
        {items.map(item => (
          <div key={item} className="flex items-center gap-1.5 text-sm text-mk-sec">
            <Check size={14} className="text-mk-green" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
