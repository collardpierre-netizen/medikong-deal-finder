import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InterestScope = "manufacturer" | "brand" | "category";

export interface VendorCatalogInterest {
  id: string;
  vendor_id: string;
  manufacturer_id: string | null;
  brand_id: string | null;
  category_id: string | null;
  notify_new_product: boolean;
  notify_new_brand: boolean;
  created_at: string;
  // Hydrated fields (joined client-side)
  label?: string;
  scope?: InterestScope;
}

export function useVendorCatalogInterests(vendorId?: string) {
  return useQuery({
    queryKey: ["vendor-catalog-interests", vendorId],
    queryFn: async (): Promise<VendorCatalogInterest[]> => {
      const { data, error } = await supabase
        .from("vendor_catalog_interests")
        .select("*")
        .eq("vendor_id", vendorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = data ?? [];
      const manufacturerIds = rows.map((r) => r.manufacturer_id).filter(Boolean) as string[];
      const brandIds = rows.map((r) => r.brand_id).filter(Boolean) as string[];
      const categoryIds = rows.map((r) => r.category_id).filter(Boolean) as string[];

      const [{ data: manufacturers = [] }, { data: brands = [] }, { data: categories = [] }] = await Promise.all([
        manufacturerIds.length
          ? supabase.from("manufacturers").select("id, name").in("id", manufacturerIds)
          : Promise.resolve({ data: [] as any[] }),
        brandIds.length
          ? supabase.from("brands").select("id, name").in("id", brandIds)
          : Promise.resolve({ data: [] as any[] }),
        categoryIds.length
          ? supabase.from("categories").select("id, name").in("id", categoryIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const mMap = new Map((manufacturers ?? []).map((x: any) => [x.id, x.name]));
      const bMap = new Map((brands ?? []).map((x: any) => [x.id, x.name]));
      const cMap = new Map((categories ?? []).map((x: any) => [x.id, x.name]));

      return rows.map((r) => {
        let scope: InterestScope = "category";
        let label = "—";
        if (r.manufacturer_id) {
          scope = "manufacturer";
          label = (mMap.get(r.manufacturer_id) as string) || "Fabricant inconnu";
        } else if (r.brand_id) {
          scope = "brand";
          label = (bMap.get(r.brand_id) as string) || "Marque inconnue";
        } else if (r.category_id) {
          scope = "category";
          label = (cMap.get(r.category_id) as string) || "Catégorie inconnue";
        }
        return { ...r, scope, label };
      });
    },
    enabled: !!vendorId,
  });
}

export function useAddVendorCatalogInterest(vendorId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      scope: InterestScope;
      target_id: string;
      notify_new_product?: boolean;
      notify_new_brand?: boolean;
    }) => {
      if (!vendorId) throw new Error("Vendor non identifié");
      const row: Record<string, any> = {
        vendor_id: vendorId,
        manufacturer_id: null,
        brand_id: null,
        category_id: null,
        notify_new_product: params.notify_new_product ?? true,
        notify_new_brand: params.notify_new_brand ?? true,
      };
      if (params.scope === "manufacturer") row.manufacturer_id = params.target_id;
      if (params.scope === "brand") row.brand_id = params.target_id;
      if (params.scope === "category") row.category_id = params.target_id;

      const { error } = await supabase.from("vendor_catalog_interests").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-catalog-interests", vendorId] });
    },
  });
}

export function useUpdateVendorCatalogInterest(vendorId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; notify_new_product?: boolean; notify_new_brand?: boolean }) => {
      const { id, ...patch } = params;
      const { error } = await supabase.from("vendor_catalog_interests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-catalog-interests", vendorId] });
    },
  });
}

export function useDeleteVendorCatalogInterest(vendorId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_catalog_interests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-catalog-interests", vendorId] });
    },
  });
}
