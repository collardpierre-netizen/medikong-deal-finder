import { cn } from "@/lib/utils";

interface VBadgeProps {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  className?: string;
}

export function VBadge({ children, color = "#616B7C", bg, className }: VBadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold leading-tight whitespace-nowrap", className)}
      style={{ color, backgroundColor: bg || color + "18" }}
    >
      {children}
    </span>
  );
}

// Pre-built status variants
const statusMap: Record<string, { color: string; bg?: string }> = {
  active: { color: "#059669" },
  inactive: { color: "#616B7C" },
  rupture: { color: "#EF4343" },
  pending: { color: "#F59E0B" },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = statusMap[status] || statusMap.inactive;
  return <VBadge color={s.color} bg={s.bg}>{label || status}</VBadge>;
}
