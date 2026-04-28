import { Link } from "react-router-dom";
import { ArrowRight, Rocket, TrendingUp, Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AnnouncementBar() {
  const { t } = useTranslation();

  const { data: config } = useQuery({
    queryKey: ["site_config", "announcement_bar"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_config")
        .select("investment_banner_enabled, investment_banner_text")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Si désactivé en BDD → on cache le bandeau
  if (config && config.investment_banner_enabled === false) return null;

  const customText = config?.investment_banner_text?.trim();
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

  return (
    <div className="bg-mk-blue border-b border-white/10 overflow-hidden relative h-9">
      <Link
        to="/invest"
        className="absolute inset-0 flex items-center animate-marquee whitespace-nowrap hover:opacity-80 transition-opacity"
      >
        {[...messages, ...messages].map((msg, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 text-xs text-white font-medium mx-12"
          >
            <msg.icon size={13} strokeWidth={2.5} className="text-white/70" />
            {msg.text}
            <ArrowRight size={12} className="text-white/60" />
          </span>
        ))}
      </Link>
    </div>
  );
}
