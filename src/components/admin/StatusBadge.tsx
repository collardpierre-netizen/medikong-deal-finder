interface StatusConfig {
  label: string;
  bg: string;
  text: string;
  dot: string;
}

const defaultStatusMap: Record<string, StatusConfig> = {
  active: { label: "Actif", bg: "#F0FDF4", text: "#059669", dot: "#059669" },
  delivered: { label: "Livré", bg: "#F0FDF4", text: "#059669", dot: "#059669" },
  shipped: { label: "Expédié", bg: "#EFF6FF", text: "#1B5BDA", dot: "#1B5BDA" },
  processing: { label: "En cours", bg: "#EFF6FF", text: "#1B5BDA", dot: "#1B5BDA" },
  pending: { label: "En attente", bg: "#FFFBEB", text: "#D97706", dot: "#F59E0B" },
  cancelled: { label: "Annulé", bg: "#FEF2F2", text: "#DC2626", dot: "#EF4343" },
  urgent: { label: "Urgent", bg: "#FEF2F2", text: "#DC2626", dot: "#EF4343" },
  warning: { label: "Attention", bg: "#FFFBEB", text: "#D97706", dot: "#F59E0B" },
  info: { label: "Info", bg: "#EFF6FF", text: "#1B5BDA", dot: "#1B5BDA" },
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  statusMap?: Record<string, StatusConfig>;
}

const StatusBadge = ({ status, label, statusMap }: StatusBadgeProps) => {
  const map = statusMap || defaultStatusMap;
  const config = map[status] || { label: status, bg: "#F1F5F9", text: "#616B7C", dot: "#8B95A5" };
  const displayLabel = label || config.label;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.dot }}
      />
      {displayLabel}
    </span>
  );
};

export default StatusBadge;
