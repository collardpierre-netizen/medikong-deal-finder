import { useMemo } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { MandatFacturationFlow } from "@/components/vendor/contract/MandatFacturationFlow";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONTRACT_VERSION, type ContractVendorData } from "@/lib/contract/mandat-facturation-template";

/**
 * Standalone screen mounting the Convention de mandat de facturation flow.
 *
 * Supports `?screen=read|sign` to deep-link a vendor directly to the
 * reading or signing step (used by the "Reprendre la signature" CTA in
 * the persistent contract banner).
 */
export default function VendorContractPage() {
  const [searchParams] = useSearchParams();
  const { data: vendor, isLoading } = useCurrentVendor();

  const requestedScreen = searchParams.get("screen");
  const initialScreen =
    requestedScreen === "sign" || requestedScreen === "read" ? requestedScreen : undefined;

  const vendorId = vendor?.id;

  // Detect any existing signed contract — the banner won't show a "resume"
  // CTA in that case, but a vendor could still land here via a stale link.
  const { data: existingContract } = useQuery({
    queryKey: ["seller-contract-current", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_contracts")
        .select("id, signed_at, contract_version, pdf_storage_path")
        .eq("vendor_id", vendorId!)
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const contractVendorData = useMemo<ContractVendorData | null>(() => {
    if (!vendor) return null;
    const v = vendor as Record<string, unknown>;
    return {
      company_name: (v.company_name as string) || (v.name as string) || "",
      legal_form: (v.legal_form as string) || null,
      address: [v.address_line_1, v.postal_code, v.city]
        .filter(Boolean)
        .join(", ") || null,
      bce: (v.bce_number as string) || null,
      vat: (v.vat_number as string) || null,
      representative_name:
        (v.representative_name as string) || (v.name as string) || "",
      representative_role: (v.representative_role as string) || null,
      signature_location: (v.city as string) || null,
    };
  }, [vendor]);

  if (isLoading || !vendor || !contractVendorData) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Chargement de votre convention…</span>
      </div>
    );
  }

  if (!vendorId) {
    return <Navigate to="/vendor/login" replace />;
  }

  const isSignedCurrent =
    existingContract?.signed_at &&
    existingContract.contract_version === CONTRACT_VERSION;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-4">
      <Link
        to="/vendor"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au portail vendeur
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Convention de mandat de facturation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Document légal obligatoire — article 53 §2 du Code TVA belge.
        </p>
      </div>

      <MandatFacturationFlow
        vendorId={vendorId}
        vendorEmail={(vendor as Record<string, unknown>).email as string | undefined}
        vendor={contractVendorData}
        readOnly={!!isSignedCurrent}
        existingSignedAt={existingContract?.signed_at ?? null}
        existingSignedVersion={existingContract?.contract_version ?? null}
        existingPdfStoragePath={existingContract?.pdf_storage_path ?? null}
        initialScreen={isSignedCurrent ? undefined : initialScreen}
      />
    </div>
  );
}
