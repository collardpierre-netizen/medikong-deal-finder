import { AnimatedCounter } from "./AnimatedCounter";

interface StatCell {
  value: number;
  suffix?: string;
  label: string;
}

export function StatsRow({ stats }: { stats: StatCell[] }) {
  return (
    <div className="rounded-2xl border border-border shadow-sm bg-white grid grid-cols-2 md:grid-cols-5">
      {stats.map((s, i) => (
        <div
          key={i}
          className={`py-8 md:py-9 px-4 text-center ${
            i < stats.length - 1 ? "border-b md:border-b-0 md:border-r border-border" : ""
          } ${i === stats.length - 1 && stats.length % 2 !== 0 ? "col-span-2 md:col-span-1" : ""}`}
        >
          <div className="text-3xl md:text-4xl font-bold text-[#1E293B]">
            <AnimatedCounter target={s.value} suffix={s.suffix} />
          </div>
          <div className="text-sm text-muted-foreground font-medium mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
