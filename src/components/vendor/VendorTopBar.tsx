import { Search, Bell, MessageSquare, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n, type Lang } from "@/contexts/I18nContext";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useCompetitorAlertsCount } from "@/hooks/useVendorCompetitorAlerts";
import { commissionRates } from "@/lib/vendor-tokens";

const langs: Lang[] = ["fr", "nl", "de"];

function getLevel(score: number) {
  return commissionRates.find(r => score >= r.minScore && score <= r.maxScore) ?? commissionRates[0];
}

interface VendorTopBarProps {
  onMenuClick?: () => void;
}

export function VendorTopBar({ onMenuClick }: VendorTopBarProps) {
  const { lang, setLang, t } = useI18n();
  const { data: vendor } = useCurrentVendor();
  const navigate = useNavigate();
  const { data: alertsCount = 0 } = useCompetitorAlertsCount(vendor?.id);

  const name = vendor?.company_name || vendor?.name || "Vendeur";
  const score = (vendor as any)?.score ?? 0;
  const level = getLevel(score);
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center gap-2 md:gap-4 px-3 md:px-5 shrink-0">
      {onMenuClick && (
        <button onClick={onMenuClick} className="p-2 rounded-md hover:bg-[#F1F5F9] md:hidden">
          <Menu size={20} className="text-[#1D2530]" />
        </button>
      )}
      <div className="flex-1 max-w-md relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
        <input
          type="text"
          placeholder={t("search") || "Rechercher produits, commandes, acheteurs..."}
          className="w-full pl-9 pr-4 py-2 text-[13px] rounded-md border border-[#E2E8F0] bg-[#F1F5F9] text-[#1D2530] placeholder:text-[#8B95A5] focus:outline-none focus:ring-1 focus:ring-[#1B5BDA] focus:bg-white transition-colors"
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
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

        <button
          onClick={() => navigate("/vendor/competitor-alerts")}
          aria-label={t("competitorAlerts") || "Alertes concurrents"}
          className="relative p-2 rounded-md hover:bg-[#F1F5F9] transition-colors"
        >
          <Bell size={18} className="text-[#616B7C]" />
          {alertsCount > 0 && (
            <span className="absolute top-0 right-0 min-w-[16px] h-[16px] px-1 rounded-full bg-[#EF4343] text-white text-[9px] font-bold flex items-center justify-center">
              {alertsCount > 9 ? "9+" : alertsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate("/vendor/messages")}
          aria-label={t("messages") || "Messages"}
          className="relative p-2 rounded-md hover:bg-[#F1F5F9] transition-colors"
        >
          <MessageSquare size={18} className="text-[#616B7C]" />
        </button>

        <div className="w-px h-7 bg-[#E2E8F0]" />

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ backgroundColor: "#1B5BDA" }}>
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-[13px] font-semibold text-[#1D2530] leading-tight">{name}</p>
            <p className="text-[10px] text-[#8B95A5]">{level.level} · {score}/100</p>
          </div>
        </div>
      </div>
    </header>
  );
}
