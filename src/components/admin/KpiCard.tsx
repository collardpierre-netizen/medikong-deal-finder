import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  evolution?: { value: number; label: string };
  iconColor?: string;
  iconBg?: string;
}

const KpiCard = ({ icon: Icon, label, value, evolution, iconColor = "#1B5BDA", iconBg = "#EFF6FF" }: KpiCardProps) => {
  const isPositive = evolution && evolution.value >= 0;

  return (
    <div
      className="flex items-start gap-4 p-5 rounded-[10px]"
      style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}
    >
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        <Icon size={20} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>
          {label}
        </p>
        <p className="text-[22px] font-bold mt-0.5" style={{ color: "#1D2530" }}>
          {value}
        </p>
        {evolution && (
          <div className="flex items-center gap-1 mt-1">
            {isPositive ? (
              <TrendingUp size={13} style={{ color: "#059669" }} />
            ) : (
              <TrendingDown size={13} style={{ color: "#EF4343" }} />
            )}
            <span
              className="text-[11px] font-semibold"
              style={{ color: isPositive ? "#059669" : "#EF4343" }}
            >
              {isPositive ? "+" : ""}
              {evolution.value}%
            </span>
            <span className="text-[11px]" style={{ color: "#8B95A5" }}>
              {evolution.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default KpiCard;
