import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PriceWatch {
  id: string;
  user_id: string;
  product_id: string;
  user_price_excl_vat: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  products?: {
    id: string;
    name: string;
    slug: string;
    best_price_excl_vat: number | null;
    best_price_incl_vat: number | null;
    image_urls: string[] | null;
    label: string | null;
    gtin: string | null;
    cnk_code: string | null;
  };
}

export function usePriceWatches() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: watches = [], isLoading } = useQuery({
    queryKey: ["price_watches", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_price_watches")
        .select("*, products(id, name, slug, best_price_excl_vat, best_price_incl_vat, image_urls, label, gtin, cnk_code)")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PriceWatch[];
    },
  });

  const getWatchForProduct = (productId: string) =>
    watches.find((w) => w.product_id === productId);

  const savePrice = useMutation({
    mutationFn: async ({ productId, price, notes }: { productId: string; price: number; notes?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("user_price_watches")
        .upsert(
          { user_id: user.id, product_id: productId, user_price_excl_vat: price, notes: notes || null },
          { onConflict: "user_id,product_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price_watches", user?.id] }),
  });

  const removeWatch = useMutation({
    mutationFn: async (watchId: string) => {
      const { error } = await supabase.from("user_price_watches").delete().eq("id", watchId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price_watches", user?.id] }),
  });

  return { watches, isLoading, getWatchForProduct, savePrice, removeWatch };
}

// Admin hook to read all user price watches for intelligence
export function useAdminPriceIntelligence() {
  const { data: allWatches = [], isLoading } = useQuery({
    queryKey: ["admin_price_intelligence"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_price_watches")
        .select("*, products(id, name, slug, best_price_excl_vat, best_price_incl_vat, label, gtin, cnk_code)")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as PriceWatch[];
    },
  });

  // Aggregate stats
  const productStats = allWatches.reduce((acc, w) => {
    const pid = w.product_id;
    if (!acc[pid]) {
      acc[pid] = {
        product: w.products,
        product_id: pid,
        userCount: 0,
        avgUserPrice: 0,
        minUserPrice: Infinity,
        maxUserPrice: 0,
        totalUserPrice: 0,
        bestMkPrice: w.products?.best_price_excl_vat || 0,
      };
    }
    acc[pid].userCount++;
    acc[pid].totalUserPrice += w.user_price_excl_vat;
    acc[pid].minUserPrice = Math.min(acc[pid].minUserPrice, w.user_price_excl_vat);
    acc[pid].maxUserPrice = Math.max(acc[pid].maxUserPrice, w.user_price_excl_vat);
    acc[pid].avgUserPrice = acc[pid].totalUserPrice / acc[pid].userCount;
    return acc;
  }, {} as Record<string, any>);

  const stats = Object.values(productStats).sort((a: any, b: any) => b.userCount - a.userCount);

  return { allWatches, stats, isLoading };
}
