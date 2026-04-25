import { Mail, Phone, CalendarDays, User as UserIcon, ExternalLink } from "lucide-react";

export interface DemoDelegate {
  first_name: string;
  last_name: string;
  job_title?: string;
  email?: string;
  phone?: string;
  booking_url?: string;
  photo_url?: string;
  isPrimary?: boolean;
}

interface Props {
  delegate: DemoDelegate;
  variant?: "card" | "inline";
}

/**
 * Version démo non-connectée du composant VendorDelegateCompact.
 * Utilisée uniquement sur /demo/delegues pour valider le design.
 * Garde le markup et les classes IDENTIQUES à la version production.
 */
export default function VendorDelegateCompactDemo({ delegate: d, variant = "card" }: Props) {
  const containerClass =
    variant === "card"
      ? "rounded-lg border border-border bg-accent/30 p-3"
      : "p-2";

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {d.isPrimary ? "★ Votre référent dédié" : "Votre contact"}
        </span>
      </div>
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
          {d.photo_url ? (
            <img
              src={d.photo_url}
              alt={`${d.first_name} ${d.last_name}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <UserIcon size={16} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate inline-flex items-center gap-1">
            {d.first_name} {d.last_name}
            <ExternalLink size={10} className="opacity-60" />
          </span>
          {d.job_title && (
            <div className="text-[10px] text-muted-foreground truncate">{d.job_title}</div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {d.email && (
              <a
                href={`mailto:${d.email}`}
                className="inline-flex items-center gap-1 text-foreground hover:text-primary"
              >
                <Mail size={11} />
                <span className="truncate max-w-[140px]">{d.email}</span>
              </a>
            )}
            {d.phone && (
              <a
                href={`tel:${d.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1 text-foreground hover:text-primary"
              >
                <Phone size={11} />
                <span>{d.phone}</span>
              </a>
            )}
            {d.booking_url && (
              <a
                href={d.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary text-primary-foreground hover:opacity-90 text-[10px] font-semibold"
              >
                <CalendarDays size={10} />
                Prendre RDV
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
