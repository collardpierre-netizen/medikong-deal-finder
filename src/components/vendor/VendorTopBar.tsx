import { Search, Bell, MessageSquare, Globe } from "lucide-react";
import { useI18n, type Lang } from "@/contexts/I18nContext";
import { vendorProfile } from "@/lib/vendor-tokens";

const langs: Lang[] = ["fr", "nl", "de"];

export function VendorTopBar() {
  const { lang, setLang, t } = useI18n();

  return (
    <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center gap-4 px-5 shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
        <input
          type="text"
          placeholder={t("search") || "Rechercher produits, commandes, acheteurs..."}
          className="w-full pl-9 pr-4 py-2 text-[13px] rounded-md border border-[#E2E8F0] bg-[#F1F5F9] text-[#1D2530] placeholder:text-[#8B95A5] focus:outline-none focus:ring-1 focus:ring-[#1B5BDA] focus:bg-white transition-colors"
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Lang switcher */}
        <div className="flex gap-0.5 bg-[#F1F5F9] rounded-md p-0.5">
          {langs.map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase transition-all ${
                lang === l ? "bg-white text-[#1D2530] shadow-sm" : "text-[#8B95A5] hover:text-[#616B7C]"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-md hover:bg-[#F1F5F9] transition-colors">
          <Bell size={18} className="text-[#616B7C]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4343]" />
        </button>

        {/* Messages */}
        <button className="relative p-2 rounded-md hover:bg-[#F1F5F9] transition-colors">
          <MessageSquare size={18} className="text-[#616B7C]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4343]" />
        </button>

        {/* Separator */}
        <div className="w-px h-7 bg-[#E2E8F0]" />

        {/* Avatar */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ backgroundColor: "#1B5BDA" }}>
            PM
          </div>
          <div className="hidden md:block">
            <p className="text-[13px] font-semibold text-[#1D2530] leading-tight">{vendorProfile.name}</p>
            <p className="text-[10px] text-[#8B95A5]">{vendorProfile.level} · {vendorProfile.score}/100</p>
          </div>
        </div>
      </div>
    </header>
  );
}
