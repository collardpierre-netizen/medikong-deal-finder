import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export type CatalogFilters = {
  rootCategoryId: string | null;
  subCategoryId: string | null;
  brandId: string | null;
  manufacturerId: string | null;
};

export const emptyCatalogFilters: CatalogFilters = {
  rootCategoryId: null,
  subCategoryId: null,
  brandId: null,
  manufacturerId: null,
};

type Props = {
  value: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
  showProductFilters?: boolean; // brand + manufacturer
};

export function VendorCatalogFilters({ value, onChange, showProductFilters = true }: Props) {
  const { data: rootCategories = [] } = useQuery({
    queryKey: ["vendor-catalog-filters", "root-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_fr")
        .is("parent_id", null)
        .eq("is_active", true)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: subCategories = [] } = useQuery({
    queryKey: ["vendor-catalog-filters", "sub-categories", value.rootCategoryId],
    enabled: !!value.rootCategoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_fr")
        .eq("parent_id", value.rootCategoryId!)
        .eq("is_active", true)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["vendor-catalog-filters", "brands"],
    enabled: showProductFilters,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .eq("is_active", true)
        .order("product_count", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: manufacturers = [] } = useQuery({
    queryKey: ["vendor-catalog-filters", "manufacturers"],
    enabled: showProductFilters,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manufacturers")
        .select("id, name")
        .eq("is_active", true)
        .order("product_count", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const hasActive =
    value.rootCategoryId || value.subCategoryId || value.brandId || value.manufacturerId;

  const labelFor = (c: { name: string; name_fr: string | null }) => c.name_fr || c.name;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.rootCategoryId ?? "__all"}
        onValueChange={(v) =>
          onChange({
            ...value,
            rootCategoryId: v === "__all" ? null : v,
            subCategoryId: null,
          })
        }
      >
        <SelectTrigger className="h-9 w-[180px] text-xs">
          <SelectValue placeholder="Catégorie" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="__all">Toutes catégories</SelectItem>
          {rootCategories.map((c: any) => (
            <SelectItem key={c.id} value={c.id}>
              {labelFor(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.rootCategoryId && subCategories.length > 0 && (
        <Select
          value={value.subCategoryId ?? "__all"}
          onValueChange={(v) =>
            onChange({ ...value, subCategoryId: v === "__all" ? null : v })
          }
        >
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue placeholder="Sous-catégorie" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="__all">Toutes sous-catégories</SelectItem>
            {subCategories.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {labelFor(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showProductFilters && (
        <>
          <Select
            value={value.brandId ?? "__all"}
            onValueChange={(v) => onChange({ ...value, brandId: v === "__all" ? null : v })}
          >
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue placeholder="Marque" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__all">Toutes marques</SelectItem>
              {brands.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={value.manufacturerId ?? "__all"}
            onValueChange={(v) =>
              onChange({ ...value, manufacturerId: v === "__all" ? null : v })
            }
          >
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue placeholder="Fabricant" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__all">Tous fabricants</SelectItem>
              {manufacturers.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-xs gap-1"
          onClick={() => onChange(emptyCatalogFilters)}
        >
          <X className="h-3 w-3" /> Réinitialiser
        </Button>
      )}
    </div>
  );
}
