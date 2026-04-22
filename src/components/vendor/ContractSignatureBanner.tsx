import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { getContractDraft, type ContractDraftMarker } from "@/lib/contract/draft-marker";

/**
 * Sticky banner shown across all /vendor/* pages when the seller has not yet
 * signed the active "Convention de mandat de facturation".
 *
 * - Default: CTA "Signer maintenant" → /vendor/contract
 * - When a draft (read or sign screen previously opened) is detected:
 *     CTA "Reprendre la signature" → /vendor/contract?screen=sign
 *   so the vendor lands directly on the signature step with the document
 *   preloaded and ready to finalize.
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

  // Track in-progress draft state (cross-tab & in-session)
  const [draft, setDraft] = useState<ContractDraftMarker | null>(() => getContractDraft(vendorId));

  useEffect(() => {
    if (!vendorId) {
      setDraft(null);
      return;
    }
    setDraft(getContractDraft(vendorId));

    const refresh = () => setDraft(getContractDraft(vendorId));
    window.addEventListener("storage", refresh);
    window.addEventListener("mk:contract-draft-changed", refresh as EventListener);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("mk:contract-draft-changed", refresh as EventListener);
    };
  }, [vendorId]);

  if (!vendorId || isLoading || contract) return null;

  const isInProgress = !!draft;
  const ctaTo = isInProgress
    ? `/vendor/contract?screen=${draft!.screen === "sign" ? "sign" : "sign"}`
    : "/vendor/contract";

  const ctaLabel = isInProgress ? "Reprendre la signature" : "Signer maintenant";
  const CtaIcon = isInProgress ? RotateCcw : ArrowRight;

  const messageLead = isInProgress
    ? "Convention en cours — "
    : "Convention non signée — ";

  const messageBody = isInProgress
    ? "Vous avez commencé la signature de la Convention de mandat de facturation. Reprenez là où vous vous êtes arrêté."
    : "Vous devez signer la Convention de mandat de facturation pour débloquer la publication d'offres et la réception de commandes.";

  return (
    <div className="bg-mk-amber text-white border-b border-mk-amber/80 font-sans">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm leading-snug">
            <span className="font-semibold">{messageLead}</span>
            <span className="opacity-95">{messageBody}</span>
          </div>
        </div>
        <Link
          to={ctaTo}
          className="inline-flex items-center gap-1.5 bg-white text-mk-amber hover:bg-mk-alt transition-colors text-sm font-semibold px-3.5 py-1.5 rounded-md flex-shrink-0"
        >
          {ctaLabel}
          <CtaIcon className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
