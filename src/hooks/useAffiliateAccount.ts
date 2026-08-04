// Compte apporteur du visiteur connecté (+ mode admin "Voir comme").
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";

export type AffiliateAccount = {
  id: string;
  affiliate_code: string;
  display_name: string;
  company_name: string | null;
  email: string;
  status: "invited" | "active" | "suspended" | "terminated";
  vat_number: string | null;
  iban_masked: string | null;
  default_campaign_id: string | null;
};

/**
 * Résout le compte apporteur courant.
 * - apporteur connecté : son propre compte (RPC affiliate_my_account)
 * - admin avec ?as=<id> : lecture du compte visé (RPC affiliate_admin_account)
 * Toutes les RPC du portail acceptent le paramètre optionnel `_affiliate_id`
 * (ignoré si l'appelant n'est pas admin).
 */
export function useAffiliateAccount() {
  const [params] = useSearchParams();
  const { isAdmin, loading: adminLoading } = useAdminAuth();
  const asId = params.get("as");
  const impersonating = Boolean(asId) && isAdmin;

  const query = useQuery({
    queryKey: ["affiliate-account", impersonating ? asId : "self"],
    enabled: !adminLoading,
    queryFn: async () => {
      const sb = supabase as any;
      if (impersonating) {
        const { data, error } = await sb.rpc("affiliate_admin_account", { _affiliate_id: asId });
        if (error) throw error;
        return (data as AffiliateAccount) ?? null;
      }
      const { data, error } = await sb.rpc("affiliate_my_account");
      if (error) throw error;
      return (data as AffiliateAccount) ?? null;
    },
  });

  return {
    account: query.data ?? null,
    /** Passé à toutes les RPC du portail (null en mode apporteur). */
    asAffiliateId: impersonating ? asId : null,
    impersonating,
    isAdmin,
    loading: adminLoading || query.isLoading,
    error: query.error as Error | null,
  };
}

/** Argument commun des RPC du portail. */
export function affiliateArgs(asAffiliateId: string | null): Record<string, unknown> {
  return asAffiliateId ? { _affiliate_id: asAffiliateId } : {};
}
