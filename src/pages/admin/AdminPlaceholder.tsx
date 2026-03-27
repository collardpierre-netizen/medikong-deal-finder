import AdminTopBar from "@/components/admin/AdminTopBar";
import { useI18n } from "@/contexts/I18nContext";
import { Construction } from "lucide-react";

interface AdminPlaceholderProps {
  titleKey: string;
}

const AdminPlaceholder = ({ titleKey }: AdminPlaceholderProps) => {
  const { t } = useI18n();

  return (
    <div>
      <AdminTopBar title={t(titleKey)} />
      <div
        className="flex flex-col items-center justify-center py-24 rounded-[10px]"
        style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ backgroundColor: "#EFF6FF" }}
        >
          <Construction size={28} style={{ color: "#1B5BDA" }} />
        </div>
        <h2 className="text-[18px] font-bold mb-2" style={{ color: "#1D2530" }}>
          {t("pageUnderConstruction")}
        </h2>
        <p className="text-[13px]" style={{ color: "#8B95A5" }}>
          {t("comingSoon")}
        </p>
      </div>
    </div>
  );
};

export default AdminPlaceholder;
