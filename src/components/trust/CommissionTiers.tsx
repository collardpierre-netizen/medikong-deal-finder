import type { CommissionTierData } from "@/data/trust-process-data";
import { Check } from "lucide-react";

export function CommissionTiersCards({ tiers }: { tiers: CommissionTierData[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {tiers.map(tier => (
        <div
          key={tier.name}
          className={`border-2 rounded-2xl p-7 md:p-8 text-center hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ${
            tier.highlighted ? "border-mk-green" : "border-mk-line"
          }`}
        >
          <div className="text-4xl mb-4">{tier.icon}</div>
          <h3 className="text-lg font-bold text-mk-navy mb-1">{tier.name}</h3>
          <div className="text-3xl font-bold text-mk-green mb-1">{tier.rate}</div>
          <div className="text-xs text-muted-foreground mb-5">{tier.volumeRange}</div>
          <div className="text-left space-y-2">
            {tier.features.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-mk-navy">
                <Check size={13} className="text-mk-green shrink-0" /> {f}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
