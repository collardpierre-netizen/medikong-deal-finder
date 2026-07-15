import { CheckCircle2, Clock, XCircle, AlertTriangle, MinusCircle, ShieldAlert } from "lucide-react";

type PeppolStatus = "sent" | "submitted" | "failed" | "rejected" | "blocked_missing_id" | null | undefined;

interface Props {
  status: PeppolStatus;
  error?: string | null;
  retryCount?: number;
}

/** Peppol dispatch status pill, updated in real-time via Falco webhook. */
const PeppolStatusBadge = ({ status, error, retryCount }: Props) => {
  if (status === "blocked_missing_id") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
        style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
        title="Peppol ID manquant pour ce vendeur — compléter sa fiche."
      >
        <ShieldAlert size={10} /> ⚠️ Peppol ID manquant
      </span>
    );
  }
  const map: Record<string, { label: string; bg: string; color: string; Icon: any }> = {
    sent:      { label: "Peppol envoyé",   bg: "#ECFDF5", color: "#059669", Icon: CheckCircle2 },
    submitted: { label: "Peppol en cours", bg: "#FFFBEB", color: "#B45309", Icon: Clock },
    failed:    { label: "Peppol échec",    bg: "#FEF2F2", color: "#B91C1C", Icon: XCircle },
    rejected:  { label: "Peppol rejeté",   bg: "#FEF2F2", color: "#B91C1C", Icon: AlertTriangle },
  };
  const cfg = status ? map[status] : null;
  if (!cfg) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
        style={{ backgroundColor: "#F1F5F9", color: "#8B95A5" }}
        title="Pas encore envoyé vers Peppol"
      >
        <MinusCircle size={10} /> Non envoyé
      </span>
    );
  }
  const Icon = cfg.Icon;
  const title =
    (status === "failed" || status === "rejected") && error
      ? `${cfg.label}${retryCount ? ` (tentative ${retryCount}/3)` : ""} — ${error}`
      : cfg.label;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
      title={title}
    >
      <Icon size={10} /> {cfg.label}
      {(status === "failed" || status === "rejected") && retryCount ? ` (${retryCount}/3)` : ""}
    </span>
  );
};

export default PeppolStatusBadge;

