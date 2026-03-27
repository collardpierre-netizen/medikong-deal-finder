import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const messages = [
  "🚀 Investissez dans MediKong — Tax Shelter 45% — Levée de fonds Phase 2 ouverte",
  "💰 Dès 1 000 € — Valorisation 160 M€ — Réduction d'impôt immédiate",
  "📈 Investissez dans MediKong — Tax Shelter 45% — Levée de fonds Phase 2 ouverte",
  "💰 Dès 1 000 € — Valorisation 160 M€ — Réduction d'impôt immédiate",
];

export function AnnouncementBar() {
  return (
    <div className="bg-mk-navy border-b border-white/10 overflow-hidden relative h-9">
      <Link
        to="/invest"
        className="absolute inset-0 flex items-center animate-marquee whitespace-nowrap hover:opacity-80 transition-opacity"
      >
        {messages.map((msg, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 text-xs text-white/80 font-medium mx-12"
          >
            {msg}
            <ArrowRight size={12} className="text-mk-green" />
          </span>
        ))}
        {messages.map((msg, i) => (
          <span
            key={`dup-${i}`}
            className="inline-flex items-center gap-2 text-xs text-white/80 font-medium mx-12"
          >
            {msg}
            <ArrowRight size={12} className="text-mk-green" />
          </span>
        ))}
      </Link>
    </div>
  );
}
