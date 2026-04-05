import { Grid, List, Columns3, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <Select value={filters.sort} onValueChange={v => setFilter("sort", v)}>
          <SelectTrigger className="h-8 text-sm w-[180px]">
            <SelectValue placeholder={t("catalog.sortBy")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">{t("catalog.relevance")}</SelectItem>
            <SelectItem value="price_asc">{t("catalog.priceAsc")}</SelectItem>
            <SelectItem value="price_desc">{t("catalog.priceDesc")}</SelectItem>
            <SelectItem value="name_asc">{t("catalog.nameAsc")}</SelectItem>
            <SelectItem value="name_desc">{t("catalog.nameDesc")}</SelectItem>
            <SelectItem value="newest">{t("catalog.newest")}</SelectItem>
            <SelectItem value="stock_desc">{t("catalog.stockDesc")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {t("catalog.productsCount", { count: total })}
        </span>

        <Select value={String(filters.perPage)} onValueChange={v => setFilter("per_page", v)}>
          <SelectTrigger className="h-8 text-sm w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[12, 24, 48, 96].map(n => (
              <SelectItem key={n} value={String(n)}>{t("catalog.perPage", { count: n })}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex border border-border rounded-md overflow-hidden">
          <button onClick={() => setView("grid")} title={t("catalog.grid")} className={`p-1.5 ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <Grid size={16} />
          </button>
          <button onClick={() => setView("list")} title={t("catalog.list")} className={`p-1.5 ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <List size={16} />
          </button>
          <button onClick={() => setView("trivago")} title={t("catalog.comparator")} className={`p-1.5 ${view === "trivago" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <Columns3 size={16} />
          </button>
        </div>

        <button className="p-1.5 border border-border rounded-md text-muted-foreground hover:bg-muted" title={t("catalog.downloadCsv")}>
          <Download size={16} />
        </button>
      </div>
    </div>
  );
}
