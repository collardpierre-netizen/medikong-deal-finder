import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useActionCenter, type ActionCenterScope } from "@/hooks/useActionCenter";
import { cn } from "@/lib/utils";

interface Props {
  scope: ActionCenterScope;
  /** "dark" for dark sidebars/headers, "light" for white navbar */
  variant?: "light" | "dark";
  enabled?: boolean;
}

export function NotificationsBell({ scope, variant = "light", enabled = true }: Props) {
  const { data } = useActionCenter(scope, enabled);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const sections = data?.sections ?? [];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const isDark = variant === "dark";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative p-2 rounded-full transition-colors",
          isDark ? "hover:bg-white/10 text-white" : "hover:bg-muted text-foreground"
        )}
      >
        <Bell size={20} aria-hidden="true" />
        {total > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center"
            aria-label={`${total} action(s) en attente`}
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] bg-white rounded-lg shadow-xl border border-border z-[60] overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Actions à traiter</p>
            <span className="text-[11px] text-muted-foreground">{total} en attente</span>
          </div>

          {sections.length > 0 && (
            <div className="px-3 py-2 border-b border-border flex flex-wrap gap-1.5">
              {sections.map((s) => (
                <Link
                  key={s.key}
                  to={s.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-full border transition-colors",
                    s.count > 0
                      ? "border-[#EF4444]/30 bg-[#EF4444]/5 text-[#B91C1C] hover:bg-[#EF4444]/10"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {s.label} {s.count > 0 && <span className="font-semibold">· {s.count}</span>}
                </Link>
              ))}
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Aucune action en attente.
              </p>
            ) : (
              items.map((it, i) => (
                <Link
                  key={i}
                  to={it.href}
                  onClick={() => setOpen(false)}
                  className="flex flex-col gap-0.5 px-4 py-2.5 hover:bg-muted/60 border-b border-border/50 last:border-0"
                >
                  <p className="text-[13px] font-medium text-foreground line-clamp-1">{it.title}</p>
                  {it.subtitle && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{it.subtitle}</p>
                  )}
                  {it.created_at && (
                    <p className="text-[10px] text-muted-foreground/70">
                      {new Date(it.created_at).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
