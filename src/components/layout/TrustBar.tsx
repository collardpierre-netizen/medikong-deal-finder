import { Truck, ShieldCheck, BadgeCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { shippingCopy } from "@/config/copy";


export function TrustBar() {
  const { t, i18n } = useTranslation();
  const items = [
    { icon: Truck, text: shippingCopy("short", i18n.language) },
    { icon: ShieldCheck, text: t("trustBar.authenticity") },
    { icon: BadgeCheck, text: t("trustBar.verifiedSuppliers") },
  ];

  return (
    <div className="bg-mk-navy py-1.5 sm:py-2">
      <div className="mk-container flex items-center justify-start sm:justify-center gap-x-3 sm:gap-6 md:gap-10 px-3 overflow-x-auto scrollbar-hide whitespace-nowrap">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10.5px] sm:text-xs text-slate-100 shrink-0">
            <item.icon size={13} className="text-slate-200 shrink-0" aria-hidden="true" />
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
