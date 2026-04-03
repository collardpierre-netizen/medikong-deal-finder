import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";

export interface ProfessionProfile {
  id: string;
  name: string;
  icon: string;
  default_category_ids: string[];
}

export interface VisibleCategoriesResult {
  /** IDs of categories visible to this user (null = all visible) */
  visibleCategoryIds: string[] | null;
  /** Whether the filter is active */
  isFiltered: boolean;
  /** The user's profession type info */
  professionType: ProfessionProfile | null;
  /** The filter mode from profile */
  filterMode: string;
  /** Loading state */
  isLoading: boolean;
  /** Helper to check if a category ID is visible */
  isCategoryVisible: (categoryId: string) => boolean;
}

export function useVisibleCategories(): VisibleCategoriesResult {
  const { user } = useAuth();

  // Fetch user profile with profession type
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profession-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("profession_type_id, category_preferences, filter_mode")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !profile) return null;

      let professionType: ProfessionProfile | null = null;
      if (profile.profession_type_id) {
        const { data: pt } = await supabase
          .from("profession_types")
          .select("id, name, icon, default_category_ids")
          .eq("id", profile.profession_type_id)
          .maybeSingle();
        if (pt) professionType = pt as ProfessionProfile;
      }

      return {
        filterMode: (profile.filter_mode as string) || "filtered",
        categoryPreferences: profile.category_preferences as Record<string, boolean> | null,
        professionType,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const result = useMemo((): VisibleCategoriesResult => {
    // No user or still loading → show all
    if (!user || profileLoading) {
      return {
        visibleCategoryIds: null,
        isFiltered: false,
        professionType: null,
        filterMode: "all",
        isLoading: profileLoading,
        isCategoryVisible: () => true,
      };
    }

    // No profile data or no profession type → show all
    if (!profileData || !profileData.professionType) {
      return {
        visibleCategoryIds: null,
        isFiltered: false,
        professionType: null,
        filterMode: profileData?.filterMode || "all",
        isLoading: false,
        isCategoryVisible: () => true,
      };
    }

    const { filterMode, categoryPreferences, professionType } = profileData;

    // "all" mode → show everything
    if (filterMode === "all") {
      return {
        visibleCategoryIds: null,
        isFiltered: false,
        professionType,
        filterMode,
        isLoading: false,
        isCategoryVisible: () => true,
      };
    }

    // Build visible IDs: start with defaults, apply overrides
    const defaultIds = new Set(professionType.default_category_ids || []);
    const overrides = categoryPreferences || {};

    // Apply overrides: if override exists, use it; otherwise keep default
    const visibleIds = new Set<string>();

    // Add defaults
    for (const id of defaultIds) {
      // Check if overridden to false
      if (overrides[id] === false) continue;
      visibleIds.add(id);
    }

    // Add any overrides set to true (even if not in defaults)
    for (const [id, visible] of Object.entries(overrides)) {
      if (visible) visibleIds.add(id);
    }

    const idsArray = Array.from(visibleIds);

    return {
      visibleCategoryIds: idsArray.length > 0 ? idsArray : null,
      isFiltered: idsArray.length > 0,
      professionType,
      filterMode,
      isLoading: false,
      isCategoryVisible: (categoryId: string) => {
        if (idsArray.length === 0) return true;
        return visibleIds.has(categoryId);
      },
    };
  }, [user, profileData, profileLoading]);

  return result;
}
