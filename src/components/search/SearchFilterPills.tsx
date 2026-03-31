import { SlidersHorizontal } from "lucide-react";
import type { SearchFilters } from "@/pages/SearchResultsPage";

interface Props {
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
}

export default function SearchFilterPills({ filters, onChange }: Props) {
  const pills = [
    { key: "inStock" as const, label: "En stock", active: filters.inStock },
    { key: "mkOnly" as const, label: "MediKong uniquement", active: filters.mkOnly },
    { key: "delivery48h" as const, label: "Livraison 48h", active: filters.delivery48h },
  ];

  const toggle = (key: keyof SearchFilters) => {
    if (key === "minRating") {
      onChange({ ...filters, minRating: filters.minRating ? null : 4 });
    } else {
      onChange({ ...filters, [key]: !filters[key] });
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <SlidersHorizontal size={14} /> Filtres
      </span>
      {pills.map((p) => (
        <button
          key={p.key}
          onClick={() => toggle(p.key)}
          className={`px-3.5 py-1.5 text-xs rounded-md border transition-colors font-medium
            ${p.active
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground border-border hover:border-primary"
            }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
