import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/impersonation";
import { useSearchParams } from "react-router-dom";

/**
 * Returns the current vendor record.
 * In impersonation (shadow) mode, fetches by target_vendor_id.
 * Otherwise, fetches by the logged-in user's auth id.
 */
export function useCurrentVendor() {
  const { user, loading } = useAuth();
  const { state: impState } = useImpersonation();
  const [searchParams] = useSearchParams();

  const impersonationVendorIdFromUrl = searchParams.get("impersonation_vendor_id");

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
    queryKey: ["current-vendor", vendorId ?? null, user?.id ?? null],
    queryFn: async () => {
      if (vendorId) {
        const { data, error } = await supabase
          .from("vendors")
          .select("*")
          .eq("id", vendorId)
          .maybeSingle();

        if (error) throw error;
        return data;
      }

      if (!user) return null;

      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) return data;

      const { data: memberships, error: membershipsError } = await supabase
        .from("account_memberships")
        .select("account_id")
        .eq("user_id", user.id)
        .eq("account_kind", "vendor")
        .eq("status", "active")
        .limit(1);

      if (membershipsError) throw membershipsError;
      const memberVendorId = memberships?.[0]?.account_id;
      if (!memberVendorId) return null;

      const { data: memberVendor, error: memberVendorError } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", memberVendorId)
        .maybeSingle();

      if (memberVendorError) throw memberVendorError;
      return memberVendor;
    },
    enabled: !loading && (!!vendorId || !!user),
  });
}
