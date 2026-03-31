import { LayoutGrid, AlignJustify, Columns3 } from "lucide-react";
import type { ViewMode } from "@/pages/SearchResultsPage";
import type { SortOption } from "@/hooks/useSearchProducts";

interface Props {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  total: number;
  vendors: number;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
}

const views: { id: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { id: "grid", icon: LayoutGrid, label: "Grille" },
  { id: "list", icon: AlignJustify, label: "Liste" },
  { id: "trivago", icon: Columns3, label: "Comparateur" },
];

export default function SearchResultsBar({ view, setView, total, vendors, sortBy, onSortChange }: Props) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{total}</span> produits trouvés
        {vendors > 0 && <> sur <span className="font-semibold text-foreground">{vendors}</span> fournisseurs</>}
      </p>
      <div className="flex items-center gap-3">
        {/* View toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {views.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              title={label}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r last:border-r-0
                border-border transition-colors
                ${view === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
                }`}
            >
              <Icon size={14} /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="px-3 py-1.5 border border-border rounded-md text-xs bg-background"
        >
          <option value="relevance">Pertinence</option>
          <option value="price_asc">Prix croissant</option>
          <option value="price_desc">Prix décroissant</option>
          <option value="offers">Nb. offres</option>
        </select>
      </div>
    </div>
  );
}
