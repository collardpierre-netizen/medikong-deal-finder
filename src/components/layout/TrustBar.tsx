import { Truck, ShieldCheck, BadgeCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export function TrustBar() {
  const { t } = useTranslation();
  const items = [
    { icon: Truck, text: t("trustBar.freeDelivery", "Livraison gratuite — sous 10 jours ouvrés") },
    { icon: ShieldCheck, text: t("trustBar.authenticity", "100% Authenticité garantie") },
    { icon: BadgeCheck, text: t("trustBar.verifiedSuppliers") },
  ];

  return (
    <div className="bg-mk-navy py-2">
      <div className="mk-container flex items-center justify-center gap-6 md:gap-10">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-white/90 whitespace-nowrap">
            <item.icon size={14} className="text-white/70 shrink-0" />
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
