import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, Building2, Tag, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { VCard } from "@/components/vendor/ui/VCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// ProductSubmissionDialog removed: vendors are routed to the dedicated /vendor/produits/proposer page
import { VendorSubmissionsList } from "@/components/vendor/catalog/VendorSubmissionsList";
import { VendorCatalogXlsxImport } from "@/components/vendor/catalog/VendorCatalogXlsxImport";
import { VendorCatalogCodeLookup } from "@/components/vendor/catalog/VendorCatalogCodeLookup";
import {
  VendorCatalogFilters,
  emptyCatalogFilters,
  type CatalogFilters,
} from "@/components/vendor/catalog/VendorCatalogFilters";
import { InterestToggleButton } from "@/components/vendor/catalog/InterestToggleButton";

type EntityType = "products" | "brands" | "manufacturers";
type ProductSort = "popularity" | "price_asc" | "price_desc" | "availability" | "newest";

const PAGE_SIZE = 30;

const PRODUCT_SORT_CONFIG: Record<ProductSort, { column: string; ascending: boolean }> = {
  popularity: { column: "popularity", ascending: false },
  price_asc: { column: "best_price_excl_vat", ascending: true },
  price_desc: { column: "best_price_excl_vat", ascending: false },
  availability: { column: "total_stock", ascending: false },
  newest: { column: "created_at", ascending: false },
};

function useCatalogList(
  entity: EntityType,
  search: string,
  filters: CatalogFilters,
  productSort: ProductSort,
) {
  return useQuery({
    queryKey: ["vendor-catalog", entity, search, filters, productSort],
    queryFn: async () => {
      const term = search.trim();
      const effectiveCategoryId = filters.subCategoryId ?? filters.rootCategoryId;

      if (entity === "products") {
        const sort = PRODUCT_SORT_CONFIG[productSort];
        let q = supabase
          .from("products")
          .select("id, name, slug, gtin, cnk_code, image_url, brand_id, brand_name, category_id, category_name, best_price_excl_vat, total_stock")
          .eq("is_active", true)
          .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
          .limit(PAGE_SIZE);
        if (term) q = q.or(`name.ilike.%${term}%,gtin.ilike.%${term}%,cnk_code.ilike.%${term}%,brand_name.ilike.%${term}%`);
        if (effectiveCategoryId) q = q.eq("category_id", effectiveCategoryId);
        if (filters.brandId) q = q.eq("brand_id", filters.brandId);
        if (filters.manufacturerId) q = q.eq("manufacturer_id", filters.manufacturerId);
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
      }
      if (entity === "brands") {
        let q = supabase
          .from("brands")
          .select("id, name, slug, logo_url, product_count, main_category, manufacturer_id")
          .eq("is_active", true)
          .order("product_count", { ascending: false, nullsFirst: false })
          .limit(PAGE_SIZE);
        if (term) q = q.ilike("name", `%${term}%`);
        if (filters.manufacturerId) q = q.eq("manufacturer_id", filters.manufacturerId);
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
      }
      let q = supabase
        .from("manufacturers")
        .select("id, name, slug, logo_url, product_count, brand_count, country_of_origin")
        .eq("is_active", true)
        .order("product_count", { ascending: false, nullsFirst: false })
        .limit(PAGE_SIZE);
      if (term) q = q.ilike("name", `%${term}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export default function VendorCatalog() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [tab, setTab] = useState<EntityType>("products");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>(emptyCatalogFilters);
  const [productSort, setProductSort] = useState<ProductSort>("popularity");

  const { data = [], isLoading } = useCatalogList(tab, search, filters, productSort);

  const startOffer = (productId?: string) => {
    const target = productId
      ? `/vendor/offers?action=create&product=${productId}`
      : `/vendor/offers?action=create`;
    navigate(target);
  };

  const browseBrand = (slug?: string | null) => {
    if (!slug) return;
    navigate(`/marques/${slug}`);
  };

  const placeholderText = useMemo(() => {
    if (tab === "products") return t("vendorCatalogSearchProducts");
    if (tab === "brands") return t("vendorCatalogSearchBrands");
    return t("vendorCatalogSearchManufacturers");
  }, [tab, t]);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1D2530]">{t("vendorCatalogTitle")}</h1>
          <p className="text-[13px] text-[#616B7C] mt-0.5">
            {t("vendorCatalogSubtitle")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <VendorCatalogCodeLookup />
          <VendorCatalogXlsxImport />
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/vendor/produits/proposer">
              <Plus className="h-4 w-4" /> {t("proposeProduct")}
            </Link>
          </Button>
        </div>
      </header>

      <VCard className="p-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as EntityType)} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <TabsList>
              <TabsTrigger value="products" className="gap-2">
                <Package className="h-4 w-4" /> {t("vendorCatalogTabProducts")}
              </TabsTrigger>
              <TabsTrigger value="brands" className="gap-2">
                <Tag className="h-4 w-4" /> {t("vendorCatalogTabBrands")}
              </TabsTrigger>
              <TabsTrigger value="manufacturers" className="gap-2">
                <Building2 className="h-4 w-4" /> {t("vendorCatalogTabManufacturers")}
              </TabsTrigger>
            </TabsList>

            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholderText}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {tab !== "manufacturers" && (
            <VendorCatalogFilters
              value={filters}
              onChange={setFilters}
              showProductFilters={tab === "products"}
            />
          )}

          <TabsContent value="products" className="m-0">
            {isLoading ? (
              <ListLoader />
            ) : data.length === 0 ? (
              <EmptyState label={t("vendorCatalogEmptyProducts")} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {(data as any[]).map((p) => (
                  <div key={p.id} className="border rounded-lg p-3 flex gap-3 items-start hover:border-primary/40 transition">
                    <div className="w-14 h-14 rounded bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" loading="lazy" />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold line-clamp-2">{p.name}</p>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                        {p.brand_name && <span>{p.brand_name}</span>}
                        {p.cnk_code && <span>CNK {p.cnk_code}</span>}
                        {p.gtin && <span>GTIN {p.gtin}</span>}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        {p.category_name && (
                          <Badge variant="secondary" className="text-[10px] truncate max-w-[140px]">{p.category_name}</Badge>
                        )}
                        <div className="flex items-center gap-1">
                          {p.brand_id && (
                            <InterestToggleButton
                              target={{ kind: "brand", id: p.brand_id, label: p.brand_name }}
                            />
                          )}
                          <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => startOffer(p.id)}>
                            <Plus className="h-3 w-3" /> {t("vendorCatalogCreateOffer")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="brands" className="m-0">
            {isLoading ? (
              <ListLoader />
            ) : data.length === 0 ? (
              <EmptyState label={t("vendorCatalogEmptyBrands")} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {(data as any[]).map((b) => (
                  <div key={b.id} className="border rounded-lg p-3 flex gap-3 items-center hover:border-primary/40 transition">
                    <div className="w-12 h-12 rounded bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt={b.name} className="w-full h-full object-contain" loading="lazy" />
                      ) : (
                        <Tag className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{b.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {b.product_count ?? 0} {t("vendorCatalogProductsCount")}{b.main_category ? ` · ${b.main_category}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <InterestToggleButton
                        target={{ kind: "brand", id: b.id, label: b.name }}
                      />
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => browseBrand(b.slug)}>
                        {t("vendorCatalogView")}
                      </Button>
                      <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => startOffer()}>
                        <Plus className="h-3 w-3" /> {t("vendorCatalogShortOffer")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="manufacturers" className="m-0">
            {isLoading ? (
              <ListLoader />
            ) : data.length === 0 ? (
              <EmptyState label={t("vendorCatalogEmptyManufacturers")} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {(data as any[]).map((m) => (
                  <div key={m.id} className="border rounded-lg p-3 flex gap-3 items-center hover:border-primary/40 transition">
                    <div className="w-12 h-12 rounded bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                      {m.logo_url ? (
                        <img src={m.logo_url} alt={m.name} className="w-full h-full object-contain" loading="lazy" />
                      ) : (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{m.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {m.brand_count ?? 0} {t("vendorCatalogBrandsCount")} · {m.product_count ?? 0} {t("vendorCatalogProductsCount")}
                        {m.country_of_origin ? ` · ${m.country_of_origin}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <InterestToggleButton
                        target={{ kind: "manufacturer", id: m.id, label: m.name }}
                      />
                      <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => startOffer()}>
                        <Plus className="h-3 w-3" /> {t("vendorCatalogShortOffer")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </VCard>

      <VCard className="p-4">
        <div id="mes-propositions" className="flex items-center justify-between mb-3 gap-3 flex-wrap scroll-mt-20">
          <div>
            <h2 className="text-sm font-bold text-[#1D2530]">{t("vendorCatalogMySubmissionsTitle")}</h2>
            <p className="text-[12px] text-muted-foreground">
              {t("vendorCatalogMySubmissionsSubtitle")}
            </p>
          </div>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/vendor/produits/proposer">
              <Plus className="h-4 w-4" /> {t("proposeProduct")}
            </Link>
          </Button>
        </div>
        <VendorSubmissionsList />
      </VCard>
    </div>
  );
}

function ListLoader() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t("vendorCatalogLoading")}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      <Package className="h-8 w-8 mb-2 opacity-60" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
