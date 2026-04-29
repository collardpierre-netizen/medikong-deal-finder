import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useToast } from "@/hooks/use-toast";

export type InterestScope = "brand" | "manufacturer" | "category";

export type InterestTarget =
  | { kind: "brand"; id: string; label?: string }
  | { kind: "manufacturer"; id: string; label?: string }
  | { kind: "category"; id: string; label?: string };

export type InterestRow = {
  id: string;
  vendor_id: string;
  brand_id: string | null;
  manufacturer_id: string | null;
  category_id: string | null;
  notify_new_brand: boolean;
  notify_new_product: boolean;
  created_at?: string;
  // Computed (front-side enrichment)
  scope?: InterestScope;
  label?: string;
};

const KEY = (vendorId?: string) => ["vendor-catalog-interests", vendorId];

/**
 * Hook principal : liste les intérêts du vendeur courant + helpers `isFollowing` / `toggle`.
 * Compat : accepte un `vendorId` optionnel (legacy signature).
 * Renvoie également `data` (alias de `interests`) pour compat avec les anciens callers.
 */
export function useVendorCatalogInterests(vendorIdArg?: string) {
  const { data: vendor } = useCurrentVendor();
  const vendorId = vendorIdArg ?? vendor?.id;
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: KEY(vendorId),
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_catalog_interests")
        .select(`
          id, vendor_id, brand_id, manufacturer_id, category_id,
          notify_new_brand, notify_new_product, created_at,
          brand:brands(name),
          manufacturer:manufacturers(name),
          category:categories(name)
        `)
        .eq("vendor_id", vendorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r): InterestRow => {
        const scope: InterestScope = r.brand_id ? "brand" : r.manufacturer_id ? "manufacturer" : "category";
        const label: string =
          (scope === "brand" && r.brand?.name) ||
          (scope === "manufacturer" && r.manufacturer?.name) ||
          (scope === "category" && r.category?.name) ||
          "—";
        return {
          id: r.id,
          vendor_id: r.vendor_id,
          brand_id: r.brand_id,
          manufacturer_id: r.manufacturer_id,
          category_id: r.category_id,
          notify_new_brand: r.notify_new_brand,
          notify_new_product: r.notify_new_product,
          created_at: r.created_at,
          scope,
          label,
        };
      });
    },
    staleTime: 60_000,
  });

  const interests = query.data ?? [];

  const isFollowing = (target: InterestTarget): InterestRow | undefined => {
    return interests.find((row) => {
      if (target.kind === "brand") {
        return row.brand_id === target.id && !row.manufacturer_id && !row.category_id;
      }
      if (target.kind === "manufacturer") {
        return row.manufacturer_id === target.id && !row.brand_id && !row.category_id;
      }
      return row.category_id === target.id && !row.brand_id && !row.manufacturer_id;
    });
  };

  const toggleMutation = useMutation({
    mutationFn: async (target: InterestTarget) => {
      if (!vendorId) throw new Error("Vendeur introuvable");
      const existing = isFollowing(target);
      if (existing) {
        const { error } = await supabase
          .from("vendor_catalog_interests")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return { action: "removed" as const, target };
      }
      const payload: Partial<InterestRow> = {
        vendor_id: vendorId,
        brand_id: target.kind === "brand" ? target.id : null,
        manufacturer_id: target.kind === "manufacturer" ? target.id : null,
        category_id: target.kind === "category" ? target.id : null,
        notify_new_brand: true,
        notify_new_product: true,
      };
      const { error } = await supabase.from("vendor_catalog_interests").insert(payload as any);
      if (error) throw error;
      return { action: "added" as const, target };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: KEY(vendorId) });
      const labelMap = { brand: "marque", manufacturer: "fabricant", category: "catégorie" };
      const verb = res.action === "added" ? "Ajouté à votre veille" : "Retiré de votre veille";
      toast({
        title: verb,
        description: res.target.label
          ? `${labelMap[res.target.kind]} : ${res.target.label}`
          : `Vous serez notifié des nouveautés sur cette ${labelMap[res.target.kind]}.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Action impossible",
        description: err?.message ?? "Réessayez dans un instant.",
        variant: "destructive",
      });
    },
  });

  return {
    // Legacy compat
    data: interests,
    isLoading: query.isLoading,
    // New API
    interests,
    isFollowing,
    toggle: (target: InterestTarget) => toggleMutation.mutate(target),
    isPending: toggleMutation.isPending,
  };
}

/**
 * Ajoute un centre d'intérêt arbitraire (brand / manufacturer / category) avec flags personnalisés.
 */
export function useAddVendorCatalogInterest(vendorIdArg?: string) {
  const { data: vendor } = useCurrentVendor();
  const vendorId = vendorIdArg ?? vendor?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      scope: InterestScope;
      target_id: string;
      notify_new_product?: boolean;
      notify_new_brand?: boolean;
    }) => {
      if (!vendorId) throw new Error("Vendeur introuvable");
      const payload = {
        vendor_id: vendorId,
        brand_id: input.scope === "brand" ? input.target_id : null,
        manufacturer_id: input.scope === "manufacturer" ? input.target_id : null,
        category_id: input.scope === "category" ? input.target_id : null,
        notify_new_product: input.notify_new_product ?? true,
        notify_new_brand: input.notify_new_brand ?? true,
      };
      const { data, error } = await supabase
        .from("vendor_catalog_interests")
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data as InterestRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(vendorId) });
    },
  });
}

export function useDeleteVendorCatalogInterest(vendorIdArg?: string) {
  const { data: vendor } = useCurrentVendor();
  const vendorId = vendorIdArg ?? vendor?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vendor_catalog_interests")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(vendorId) });
    },
  });
}

export function useUpdateVendorCatalogInterest(vendorIdArg?: string) {
  const { data: vendor } = useCurrentVendor();
  const vendorId = vendorIdArg ?? vendor?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      notify_new_product?: boolean;
      notify_new_brand?: boolean;
    }) => {
      const { id, ...patch } = input;
      const { data, error } = await supabase
        .from("vendor_catalog_interests")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as InterestRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(vendorId) });
    },
  });
}
