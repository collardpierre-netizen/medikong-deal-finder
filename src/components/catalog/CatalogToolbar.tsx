import { Grid, List, Columns3, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CatalogFilters } from "@/hooks/useCatalog";

export type CatalogViewMode = "grid" | "list" | "trivago";

interface Props {
  filters: CatalogFilters;
  setFilter: (key: string, value: any) => void;
  total: number;
  view: CatalogViewMode;
  setView: (v: CatalogViewMode) => void;
}

export function CatalogToolbar({ filters, setFilter, total, view, setView }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <Select value={filters.sort} onValueChange={v => setFilter("sort", v)}>
          <SelectTrigger className="h-8 text-sm w-[180px]">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Pertinence</SelectItem>
            <SelectItem value="price_asc">Prix croissant</SelectItem>
            <SelectItem value="price_desc">Prix décroissant</SelectItem>
            <SelectItem value="name_asc">Nom A-Z</SelectItem>
            <SelectItem value="name_desc">Nom Z-A</SelectItem>
            <SelectItem value="newest">Nouveautés</SelectItem>
            <SelectItem value="stock_desc">Stock décroissant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground hidden sm:inline"><span className="text-sm text-muted-foreground hidden sm:inline">{total.toLocaleString("de-DE")} produits</span></span>

        <Select value={String(filters.perPage)} onValueChange={v => setFilter("per_page", v)}>
          <SelectTrigger className="h-8 text-sm w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[12, 24, 48, 96].map(n => (
              <SelectItem key={n} value={String(n)}>{n} par page</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex border border-border rounded-md overflow-hidden">
          <button onClick={() => setView("grid")} title="Grille" className={`p-1.5 ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <Grid size={16} />
          </button>
          <button onClick={() => setView("list")} title="Liste" className={`p-1.5 ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <List size={16} />
          </button>
          <button onClick={() => setView("trivago")} title="Comparateur" className={`p-1.5 ${view === "trivago" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <Columns3 size={16} />
          </button>
        </div>

        <button className="p-1.5 border border-border rounded-md text-muted-foreground hover:bg-muted" title="Télécharger CSV">
          <Download size={16} />
        </button>
      </div>
    </div>
  );
}
