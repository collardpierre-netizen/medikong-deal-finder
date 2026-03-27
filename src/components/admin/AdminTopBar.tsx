import { useI18n, Lang } from "@/contexts/I18nContext";
import { Bell, Search } from "lucide-react";

interface AdminTopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const langLabels: Record<Lang, string> = { fr: "FR", nl: "NL", de: "DE" };

const AdminTopBar = ({ title, subtitle, actions }: AdminTopBarProps) => {
  const { lang, setLang } = useI18n();

  return (
    <header className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: "#1D2530" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] mt-0.5" style={{ color: "#616B7C" }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px]"
          style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}
        >
          <Search size={14} style={{ color: "#8B95A5" }} />
          <span style={{ color: "#8B95A5" }}>Rechercher...</span>
        </div>
        {/* Notifications */}
        <button
          className="relative w-9 h-9 flex items-center justify-center rounded-md"
          style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}
        >
          <Bell size={16} style={{ color: "#616B7C" }} />
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] text-white flex items-center justify-center font-bold"
            style={{ backgroundColor: "#EF4343" }}
          >
            6
          </span>
        </button>
        {/* Lang switcher */}
        <div
          className="flex rounded-md overflow-hidden"
          style={{ border: "1px solid #E2E8F0" }}
        >
          {(Object.keys(langLabels) as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
              style={{
                backgroundColor: lang === l ? "#1B5BDA" : "#fff",
                color: lang === l ? "#fff" : "#616B7C",
              }}
            >
              {langLabels[l]}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

export default AdminTopBar;
