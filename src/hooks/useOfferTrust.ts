import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OfferTrust {
  found: boolean;
  vendor_id?: string;
  display_code?: string | null;
  name?: string | null;
  company_name?: string | null;
  show_real_name?: boolean | null;
  country_code?: string | null;
  is_authorized_distributor: boolean;
  billing_mandate_signed: boolean;
  mandate_signed_at?: string | null;
  is_kyc_verified: boolean;
  vendor_since?: string | null;
  brand_authorization?: {
    id: string;
    authorization_type: string;
    document_reference: string | null;
    valid_from: string | null;
    valid_until: string | null;
  } | null;
  guarantee_label: string;
}

/**
 * Signaux de confiance résolus côté serveur (RPC `resolve_offer_trust`).
 * Anonymisation vendeur : l'affichage du nom réel doit rester géré par
 * `resolveVendorLabel` + `vendor_visibility_rules` en amont.
 */
export function useOfferTrust(
  offerId: string | null | undefined,
  brandId?: string | null,
) {
  return useQuery({
    queryKey: ["offer-trust", offerId, brandId ?? null],
    enabled: !!offerId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<OfferTrust | null> => {
      const { data, error } = await (supabase as any).rpc("resolve_offer_trust", {
        _offer_id: offerId,
        _brand_id: brandId ?? null,
      });
      if (error) throw error;
      if (!data || (data as any).found === false) return null;
      return data as OfferTrust;
    },
  });
}
