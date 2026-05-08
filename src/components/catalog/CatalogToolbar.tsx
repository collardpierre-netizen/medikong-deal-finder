import { Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import type { CatalogFilters } from "@/hooks/useCatalog";
import { CatalogViewToggle } from "@/components/catalog/CatalogViewToggle";
import type { CatalogView } from "@/hooks/useCatalogViewMode";
import { Skeleton } from "@/components/ui/skeleton";

export type CatalogViewMode = CatalogView;

interface Props {
  filters: CatalogFilters;
  setFilter: (key: string, value: any) => void;
  total: number;
  view: CatalogView;
  setView: (v: CatalogView) => void;
  /** Vrai pendant le tout premier chargement (pas de données encore). */
  isLoading?: boolean;
}

export function CatalogToolbar({ filters, setFilter, total, view, setView, isLoading = false }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div className="flex items-center gap-2 min-w-0">
        <Select value={filters.sort} onValueChange={v => setFilter("sort", v)} disabled={isLoading}>
          <SelectTrigger className="h-8 text-sm w-[150px] sm:w-[180px]">
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

      <div className="flex items-center gap-2 flex-wrap">
        {isLoading ? (
          <Skeleton
            aria-label="Chargement du nombre de résultats"
            className="hidden md:inline-block h-4 w-28 rounded-sm align-middle"
          />
        ) : (
          <span className="text-sm text-muted-foreground hidden md:inline">
            {t("catalog.productsCount", { count: total })}
          </span>
        )}

        <Select value={String(filters.perPage)} onValueChange={v => setFilter("per_page", v)} disabled={isLoading}>
          <SelectTrigger className="h-8 text-sm w-[100px] sm:w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[12, 24, 48, 96].map(n => (
              <SelectItem key={n} value={String(n)}>{t("catalog.perPage", { count: n })}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="hidden sm:block">
          <CatalogViewToggle view={view} setView={setView} />
        </div>

        <button className="hidden sm:inline-flex p-1.5 border border-border rounded-md text-muted-foreground hover:bg-muted" title={t("catalog.downloadCsv")}>
          <Download size={16} />
        </button>
      </div>
    </div>
  );
}
