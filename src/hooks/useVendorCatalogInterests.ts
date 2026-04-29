import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useToast } from "@/hooks/use-toast";

export type InterestTarget =
  | { kind: "brand"; id: string; label?: string }
  | { kind: "manufacturer"; id: string; label?: string }
  | { kind: "category"; id: string; label?: string };

type InterestRow = {
  id: string;
  vendor_id: string;
  brand_id: string | null;
  manufacturer_id: string | null;
  category_id: string | null;
  notify_new_brand: boolean;
  notify_new_product: boolean;
};

const KEY = (vendorId?: string) => ["vendor-catalog-interests", vendorId];

export function useVendorCatalogInterests() {
  const { data: vendor } = useCurrentVendor();
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: KEY(vendor?.id),
    enabled: !!vendor?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_catalog_interests")
        .select("id, vendor_id, brand_id, manufacturer_id, category_id, notify_new_brand, notify_new_product")
        .eq("vendor_id", vendor!.id);
      if (error) throw error;
      return (data ?? []) as InterestRow[];
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

  const toggle = useMutation({
    mutationFn: async (target: InterestTarget) => {
      if (!vendor?.id) throw new Error("Vendeur introuvable");
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
        vendor_id: vendor.id,
        brand_id: target.kind === "brand" ? target.id : null,
        manufacturer_id: target.kind === "manufacturer" ? target.id : null,
        category_id: target.kind === "category" ? target.id : null,
        notify_new_brand: true,
        notify_new_product: true,
      };
      const { error } = await supabase
        .from("vendor_catalog_interests")
        .insert(payload as any);
      if (error) throw error;
      return { action: "added" as const, target };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: KEY(vendor?.id) });
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
    interests,
    isLoading: query.isLoading,
    isFollowing,
    toggle: (target: InterestTarget) => toggle.mutate(target),
    isPending: toggle.isPending,
  };
}
