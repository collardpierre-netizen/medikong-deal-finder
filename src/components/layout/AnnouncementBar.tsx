import { Link } from "react-router-dom";
import { ArrowRight, Rocket, TrendingUp, Coins } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AnnouncementBar() {
  const { t } = useTranslation();

  const messages = [
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
