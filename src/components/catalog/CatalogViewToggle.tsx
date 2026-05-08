import { Grid, Columns3 } from "lucide-react";
import type { CatalogView } from "@/hooks/useCatalogViewMode";

interface Props {
  view: CatalogView;
  setView: (v: CatalogView) => void;
  className?: string;
}

/**
 * Toggle compact entre vue grille et vue comparative (Trivago).
 * Accessible : role="radiogroup", flèches gauche/droite, focus visible.
 */
export function CatalogViewToggle({ view, setView, className = "" }: Props) {
  const options: { value: CatalogView; Icon: typeof Grid; label: string }[] = [
    { value: "grid", Icon: Grid, label: "Vue grille" },
    { value: "trivago", Icon: Columns3, label: "Vue comparative" },
  ];

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const idx = options.findIndex((o) => o.value === view);
      const next = options[(idx + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length];
      setView(next.value);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Mode d'affichage du catalogue"
      onKeyDown={onKey}
      className={`inline-flex border border-border rounded-md overflow-hidden ${className}`}
    >
      {options.map(({ value, Icon, label }) => {
        const active = view === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            tabIndex={active ? 0 : -1}
            onClick={() => setView(value)}
            className={`px-2.5 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}
