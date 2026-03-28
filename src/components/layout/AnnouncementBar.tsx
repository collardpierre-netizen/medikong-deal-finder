import { Link } from "react-router-dom";
import { ArrowRight, Rocket, TrendingUp, Coins } from "lucide-react";

const messages = [
  { icon: Rocket, text: "Investissez dans MediKong — Tax Shelter 45% — Levée de fonds Phase 2 ouverte" },
  { icon: Coins, text: "Dès 1 000 € — Tax Shelter 45% dès 5 000 € — Réduction d'impôt immédiate" },
  { icon: TrendingUp, text: "Investissez dans MediKong — Tax Shelter 45% — Levée de fonds Phase 2 ouverte" },
  { icon: Coins, text: "Dès 1 000 € — Tax Shelter 45% dès 5 000 € — Réduction d'impôt immédiate" },
];

export function AnnouncementBar() {
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
