import type { PricingCardData } from "@/data/trust-process-data";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

export function PricingCards({ cards }: { cards: PricingCardData[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {cards.map(card => (
        <div key={card.title} className={`relative border-2 rounded-2xl p-8 md:p-9 text-center ${card.featured ? "border-mk-blue" : "border-mk-line"}`}>
          {card.featured && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-mk-blue text-white px-4 py-1 rounded-full text-xs font-bold">Populaire</span>
          )}
          <h3 className="text-lg font-bold text-mk-navy mb-2">{card.title}</h3>
          <div className="text-4xl font-bold text-mk-blue mb-1">{card.price}</div>
          <div className="text-xs text-muted-foreground mb-6">{card.priceSub}</div>
          <div className="space-y-2.5 mb-8 text-left">
            {card.features.map(f => (
              <div key={f} className="flex items-center gap-2.5 py-1 text-sm text-mk-navy">
                <Check size={14} className="text-mk-green shrink-0" /> {f}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/onboarding")}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${
              card.cta.variant === "pink"
                ? "bg-[#E70866] hover:bg-[#C70758] text-white"
                : "bg-mk-navy hover:bg-mk-navy/90 text-white"
            }`}
          >
            {card.cta.label}
          </button>
        </div>
      ))}
    </div>
  );
}
