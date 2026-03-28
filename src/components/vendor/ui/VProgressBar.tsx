interface VProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}

export function VProgressBar({ value, max = 100, color = "#1B5BDA", height = 8 }: VProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full rounded-full overflow-hidden bg-[#E2E8F0]" style={{ height }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
