import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_MOV = 500;

/**
 * Resolves the effective MOV for each vendor in the cart.
 * Resolution order:
 *  1. offer_profile_rules (per-offer override) — not used here (would be per-item)
 *  2. vendor_profile_defaults (vendor-level default for buyer's profile + country)
 *  3. Global fallback (DEFAULT_MOV)
 */
export function useVendorMov(vendorIds: string[]) {
  const { user } = useAuth();

  // Get buyer's profile type and country
  const { data: customer } = useQuery({
    queryKey: ["cart-customer-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("customer_type, country_code")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Get vendor types to distinguish real vs qogita vendors
  const { data: vendorTypes } = useQuery({
    queryKey: ["cart-vendor-types", vendorIds],
    queryFn: async () => {
      if (vendorIds.length === 0) return [];
      const { data } = await supabase
        .from("vendors")
        .select("id, type, mov")
        .in("id", vendorIds);
      return (data || []) as { id: string; type: string; mov: number | null }[];
    },
    enabled: vendorIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Get vendor_profile_defaults only for real vendors
  const realVendorIds = useMemo(() => {
    if (!vendorTypes) return [];
    return vendorTypes.filter(v => v.type === "real").map(v => v.id);
  }, [vendorTypes]);

  const { data: vendorDefaults } = useQuery({
    queryKey: ["vendor-profile-defaults-cart", realVendorIds, customer?.customer_type, customer?.country_code],
    queryFn: async () => {
      if (realVendorIds.length === 0) return [];
      const { data } = await supabase
        .from("vendor_profile_defaults" as any)
        .select("*")
        .in("vendor_id", realVendorIds);
      return (data || []) as any[];
    },
    enabled: realVendorIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const getMovForVendor = (vendorId: string): number => {
    const vendorInfo = vendorTypes?.find(v => v.id === vendorId);

    // For Qogita vendors (virtual or qogita type), use the MOV from the offers/vendor table
    if (vendorInfo && vendorInfo.type !== "real") {
      return Number(vendorInfo.mov) || DEFAULT_MOV;
    }

    // For real vendors, resolve from vendor_profile_defaults
    if (!vendorDefaults || !customer) return DEFAULT_MOV;

    const profileType = customer.customer_type || "pharmacy";
    const countryCode = customer.country_code || "BE";

    // Try exact match: vendor + profile + country
    const exact = vendorDefaults.find(
      (d: any) => d.vendor_id === vendorId && d.profile_type === profileType && d.country_code === countryCode
    );
    if (exact) return Number(exact.default_mov) || 0;

    // Try vendor + profile (any country)
    const profileMatch = vendorDefaults.find(
      (d: any) => d.vendor_id === vendorId && d.profile_type === profileType
    );
    if (profileMatch) return Number(profileMatch.default_mov) || 0;

    // Try vendor default (any profile for this country)
    const countryMatch = vendorDefaults.find(
      (d: any) => d.vendor_id === vendorId && d.country_code === countryCode
    );
    if (countryMatch) return Number(countryMatch.default_mov) || 0;

    // Any rule for this vendor
    const anyRule = vendorDefaults.find((d: any) => d.vendor_id === vendorId);
    if (anyRule) return Number(anyRule.default_mov) || 0;

    return DEFAULT_MOV;
  };

  return { getMovForVendor, customerProfile: customer };
}
