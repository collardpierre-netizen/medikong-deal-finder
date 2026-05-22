import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GuaranteeVersion {
  id: string;
  version: number;
  title: string;
  body_md: string;
  bullet_points: string[];
  published_at: string | null;
  is_current: boolean;
}

/**
 * Lecture de la version courante (publiée, is_current=true) de la Garantie satisfaction
 * et remboursement marketplace. Tout vendeur signe cette version à l'onboarding.
 */
export function useCurrentGuarantee() {
  return useQuery({
    queryKey: ["marketplace-guarantee", "current"],
    queryFn: async (): Promise<GuaranteeVersion | null> => {
      const { data, error } = await supabase
        .from("marketplace_guarantee_versions" as any)
        .select("id, version, title, body_md, bullet_points, published_at, is_current")
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      return (data as GuaranteeVersion | null) ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Liste de toutes les versions (publiées + brouillons admin). RLS gère la visibilité.
 */
export function useAllGuaranteeVersions() {
  return useQuery({
    queryKey: ["marketplace-guarantee", "all"],
    queryFn: async (): Promise<GuaranteeVersion[]> => {
      const { data, error } = await supabase
        .from("marketplace_guarantee_versions" as any)
        .select("id, version, title, body_md, bullet_points, published_at, is_current")
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as GuaranteeVersion[];
    },
  });
}
