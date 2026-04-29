import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useVendorNotifications(vendorId?: string, limit = 50) {
  return useQuery({
    queryKey: ["vendor-notifications", vendorId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_notifications")
        .select("*")
        .eq("vendor_id", vendorId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!vendorId,
  });
}

export function useVendorUnreadNotificationsCount(vendorId?: string) {
  return useQuery({
    queryKey: ["vendor-notifications-unread-count", vendorId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("vendor_notifications")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", vendorId!)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!vendorId,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead(vendorId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vendor_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-notifications", vendorId] });
      qc.invalidateQueries({ queryKey: ["vendor-notifications-unread-count", vendorId] });
    },
  });
}

export function useMarkAllNotificationsRead(vendorId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("vendor_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("vendor_id", vendorId!)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-notifications", vendorId] });
      qc.invalidateQueries({ queryKey: ["vendor-notifications-unread-count", vendorId] });
    },
  });
}
