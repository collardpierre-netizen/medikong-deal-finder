import { icons, TrendingUp, TrendingDown } from "lucide-react";

interface VStatProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: keyof typeof icons;
  color: string;
  trend?: number;
  trendVal?: string;
}

export function VStat({ label, value, sub, icon, color, trend, trendVal }: VStatProps) {
  const Icon = icons[icon];
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: color + "14" }}>
        {Icon && <Icon size={20} style={{ color }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">{label}</p>
        <p className="text-[22px] font-bold text-[#1D2530] leading-tight mt-0.5">{value}</p>
        <div className="flex items-center gap-2 mt-1">
          {trend !== undefined && (
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${trend >= 0 ? "text-[#059669]" : "text-[#EF4343]"}`}>
              {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trendVal || `${trend > 0 ? "+" : ""}${trend}%`}
            </span>
          )}
          {sub && <span className="text-[11px] text-[#8B95A5]">{sub}</span>}
        </div>
      </div>
    </div>
  );
}
