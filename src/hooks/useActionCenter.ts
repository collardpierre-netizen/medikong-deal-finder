import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActionCenterScope = "admin" | "vendor" | "buyer";

export interface ActionCenterSection {
  key: string;
  label: string;
  count: number;
  href: string;
}

export interface ActionCenterItem {
  type: string;
  title: string;
  subtitle: string | null;
  href: string;
  created_at: string | null;
}

export interface ActionCenterPayload {
  total: number;
  sections: ActionCenterSection[];
  items: ActionCenterItem[];
}

const EMPTY: ActionCenterPayload = { total: 0, sections: [], items: [] };

export function useActionCenter(scope: ActionCenterScope, enabled = true) {
  return useQuery<ActionCenterPayload>({
    queryKey: ["action-center", scope],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_action_center", { _scope: scope });
      if (error) {
        console.warn("[action-center] rpc error", error);
        return EMPTY;
      }
      return (data as ActionCenterPayload) ?? EMPTY;
    },
  });
}
