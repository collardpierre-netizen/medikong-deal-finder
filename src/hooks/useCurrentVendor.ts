import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/impersonation";

/**
 * Returns the current vendor record.
 * In impersonation (shadow) mode, fetches by target_vendor_id.
 * Otherwise, fetches by the logged-in user's auth id.
 */
export function useCurrentVendor() {
  const { user } = useAuth();
  const { state: impState } = useImpersonation();

  const impersonationVendorIdFromUrl =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("impersonation_vendor_id")
      : null;

  const isImpersonatingVendor =
    (impState.isImpersonating &&
      impState.session?.target_type === "vendor" &&
      !!impState.session?.target_vendor_id) ||
    !!impersonationVendorIdFromUrl;

  const vendorId = impersonationVendorIdFromUrl || (
    isImpersonatingVendor
      ? impState.session?.target_vendor_id
      : undefined
  );

  return useQuery({
    queryKey: ["current-vendor", vendorId || user?.id],
    queryFn: async () => {
      if (vendorId) {
        // Impersonation: fetch by vendor id directly
        const { data } = await supabase
          .from("vendors")
          .select("*")
          .eq("id", vendorId)
          .maybeSingle();
        return data;
      }
      // Normal: fetch by auth user id
      if (!user) return null;
      const { data } = await supabase
        .from("vendors")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!vendorId || !!user,
  });
}
