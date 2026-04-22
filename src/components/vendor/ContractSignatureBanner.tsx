import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";

/**
 * Sticky banner shown across all /vendor/* pages when the seller has not yet
 * signed the active "Convention de mandat de facturation".
 *
 * Anchors a CTA pointing to the onboarding wizard's contract step so the
 * vendor can unblock their account.
 */
export function ContractSignatureBanner() {
  const { data: vendor } = useCurrentVendor();
  const vendorId = vendor?.id;

  const { data: contract, isLoading } = useQuery({
    queryKey: ["seller-contract", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_contracts")
        .select("id, signed_at, contract_version")
        .eq("vendor_id", vendorId!)
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!vendorId || isLoading || contract) return null;

  return (
    <div className="bg-orange-500 text-white border-b border-orange-600">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm leading-snug">
            <span className="font-semibold">Convention non signée — </span>
            <span className="opacity-95">
              Vous devez signer la Convention de mandat de facturation pour
              débloquer la publication d'offres et la réception de commandes.
            </span>
          </div>
        </div>
        <Link
          to="/vendor/onboarding?step=contract"
          className="inline-flex items-center gap-1.5 bg-white text-orange-700 hover:bg-orange-50 transition-colors text-sm font-semibold px-3.5 py-1.5 rounded-md flex-shrink-0"
        >
          Signer maintenant
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
