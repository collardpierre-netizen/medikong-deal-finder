import { Truck, ShieldCheck, BadgeCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { shippingCopy } from "@/config/copy";


export function TrustBar() {
  const { t, i18n } = useTranslation();
  const items = [
    { icon: Truck, text: shippingCopy("short", i18n.language) },
    { icon: ShieldCheck, text: t("trustBar.authenticity", "100% Authenticité garantie") },
    { icon: BadgeCheck, text: t("trustBar.verifiedSuppliers") },
  ];

  return (
    <div className="bg-mk-navy py-2">
      <div className="mk-container flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:gap-6 md:gap-10 px-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px] sm:text-xs text-white/90">
            <item.icon size={14} className="text-white/70 shrink-0" />
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
