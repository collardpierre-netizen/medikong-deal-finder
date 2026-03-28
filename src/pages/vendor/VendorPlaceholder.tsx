import { useI18n } from "@/contexts/I18nContext";
import { VEmptyState } from "@/components/vendor/ui/VEmptyState";

export default function VendorPlaceholder({ pageKey }: { pageKey: string }) {
  const { t } = useI18n();
  return (
    <div>
      <h1 className="text-xl font-bold text-[#1D2530] mb-6">{t(pageKey)}</h1>
      <VEmptyState icon="Construction" title={t("pageUnderConstruction") || "Page en construction"} sub={t("comingSoon") || "Cette section sera bientôt disponible."} />
    </div>
  );
}
