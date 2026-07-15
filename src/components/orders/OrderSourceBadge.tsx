import { Globe, UserCog } from "lucide-react";

type Props = {
  source?: string | null;
  className?: string;
};

/**
 * Distingue les commandes créées en ligne (site) des commandes saisies
 * manuellement par un admin, pour prioriser le suivi des commandes online.
 */
export default function OrderSourceBadge({ source, className }: Props) {
  const isManual = source === "manual_admin";
  const label = isManual ? "Manuelle (admin)" : "En ligne";
  const Icon = isManual ? UserCog : Globe;
  const tone = isManual
    ? "bg-slate-100 text-slate-700 border-slate-200"
    : "bg-sky-50 text-sky-700 border-sky-200";
  const title = isManual
    ? "Commande saisie manuellement depuis l'admin"
    : "Commande passée en ligne par le client";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone} ${className ?? ""}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
