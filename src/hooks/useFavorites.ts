import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useFavorites() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("*, products(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const isFavorite = (productId: string) =>
    favorites.some((f: any) => f.product_id === productId);

  const toggleFavorite = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error("Not authenticated");
      const existing = favorites.find((f: any) => f.product_id === productId);
      if (existing) {
        const { error } = await supabase.from("favorites").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("favorites").insert({ user_id: user.id, product_id: productId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites", user?.id] }),
  });

  return { favorites, isLoading, isFavorite, toggleFavorite };
}

export function useFavoriteLists() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["favorite_lists", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorite_lists")
        .select("*, favorite_list_items(id, product_id, products(*))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createList = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("favorite_lists").insert({ user_id: user.id, name, description });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorite_lists", user?.id] }),
  });

  const deleteList = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase.from("favorite_lists").delete().eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorite_lists", user?.id] }),
  });

  const addToList = useMutation({
    mutationFn: async ({ listId, productId }: { listId: string; productId: string }) => {
      const { error } = await supabase.from("favorite_list_items").insert({ list_id: listId, product_id: productId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorite_lists", user?.id] }),
  });

  const removeFromList = useMutation({
    mutationFn: async ({ listId, productId }: { listId: string; productId: string }) => {
      const { error } = await supabase.from("favorite_list_items").delete().eq("list_id", listId).eq("product_id", productId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorite_lists", user?.id] }),
  });

  return { lists, isLoading, createList, deleteList, addToList, removeFromList };
}

export function useRecentActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["recent_activity", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recent_activity")
        .select("*, products(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const trackActivity = useMutation({
    mutationFn: async ({ activityType, productId, metadata }: { activityType: string; productId?: string; metadata?: Record<string, any> }) => {
      if (!user) return;
      const { error } = await supabase.from("recent_activity").insert({
        user_id: user.id,
        activity_type: activityType,
        product_id: productId || null,
        metadata: metadata || {},
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recent_activity", user?.id] }),
  });

  return { activities, isLoading, trackActivity };
}
