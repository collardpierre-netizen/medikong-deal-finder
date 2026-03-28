import type { Tier } from "@/data/entreprise-data";

export function CommissionTiers({ tiers }: { tiers: Tier[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {tiers.map((t) => (
        <div
          key={t.name}
          className={`p-6 rounded-[14px] border text-center hover:translate-y-[-2px] hover:shadow-md transition-all ${
            t.highlighted ? "border-[#E70866] bg-[#FFF5FA]" : "border-border bg-white"
          }`}
        >
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{t.name}</p>
          <p className="text-[32px] font-bold text-[#1E293B] mb-1">{t.rate}</p>
          <p className="text-xs text-muted-foreground">{t.range}</p>
        </div>
      ))}
    </div>
  );
}
