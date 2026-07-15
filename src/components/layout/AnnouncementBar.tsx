import { Link } from "react-router-dom";
import { ArrowRight, Rocket, TrendingUp, Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AnnouncementBar() {
  const { t, i18n } = useTranslation();

  const { data: config } = useQuery({
    queryKey: ["site_config", "announcement_bar"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_config")
        .select(
          "investment_banner_enabled, investment_banner_text, investment_banner_text_nl, investment_banner_text_en, investment_banner_text_de, crowdfunding_enabled"
        )
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Si désactivé en BDD → on cache le bandeau
  if (config && config.investment_banner_enabled === false) return null;

  const crowdfundingActive = (config as any)?.crowdfunding_enabled !== false;

  // Pick the localized text for the current language ONLY.
  // If empty, fall back to i18n translations rather than the FR DB text,
  // otherwise EN/NL/DE users would see French copy.
  const lang = i18n.language?.substring(0, 2) || "fr";
  const localizedMap: Record<string, string | null | undefined> = {
    fr: config?.investment_banner_text,
    nl: (config as any)?.investment_banner_text_nl,
    en: (config as any)?.investment_banner_text_en,
    de: (config as any)?.investment_banner_text_de,
  };
  const customText = localizedMap[lang]?.trim() ?? "";
  const messages = customText
    ? [
        { icon: Rocket, text: customText },
        { icon: Coins, text: customText },
        { icon: TrendingUp, text: customText },
        { icon: Coins, text: customText },
      ]
    : [
        { icon: Rocket, text: t("investBanner.msg1") },
        { icon: Coins, text: t("investBanner.msg2") },
        { icon: TrendingUp, text: t("investBanner.msg1") },
        { icon: Coins, text: t("investBanner.msg2") },
      ];


  const innerContent = (
    <>
      {[...messages, ...messages].map((msg, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-white font-medium mx-5 sm:mx-12"
        >
          <msg.icon size={13} strokeWidth={2.5} className="text-white/70" />
          {msg.text}
          {crowdfundingActive && <ArrowRight size={12} className="text-white/60" />}
        </span>
      ))}
    </>
  );

  return (
    <div className="bg-mk-blue border-b border-white/10 overflow-hidden relative h-9">
      {crowdfundingActive ? (
        <Link
          to="/invest"
          className="absolute inset-0 flex items-center animate-marquee whitespace-nowrap hover:opacity-80 transition-opacity"
        >
          {innerContent}
        </Link>
      ) : (
        <div className="absolute inset-0 flex items-center animate-marquee whitespace-nowrap">
          {innerContent}
        </div>
      )}
    </div>
  );
}
