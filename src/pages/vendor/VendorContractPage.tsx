import { useMemo } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Loader2, ArrowLeft, BookOpen, PenLine, CheckCircle2, RefreshCw } from "lucide-react";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { MandatFacturationFlow } from "@/components/vendor/contract/MandatFacturationFlow";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONTRACT_VERSION, type ContractVendorData } from "@/lib/contract/mandat-facturation-template";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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

    // En Belgique, le numéro d'entreprise (BCE) correspond aux chiffres du
    // numéro de TVA (format `BExxxx.xxx.xxx`). On dérive donc le BCE depuis
    // `vat_number` quand un champ `bce_number` dédié n'existe pas en DB.
    // Cela évite que Zod côté serveur reçoive `bce: null` et renvoie un 400.
    const rawVat = (v.vat_number as string | null) || null;
    const rawBce = (v.bce_number as string | null) || null;
    const derivedBce =
      rawBce ||
      (rawVat
        ? rawVat
            .replace(/^BE\s*/i, "")
            .replace(/\s+/g, "")
            .trim() || null
        : null);

    // Adresse postale : les colonnes DB sont `address_line1` / `address_line2`
    // (sans underscore avant le chiffre). Le code précédent lisait
    // `address_line_1`, toujours `undefined`, ce qui produisait `address: null`.
    const addressParts = [
      v.address_line1 ?? v.address_line_1,
      v.address_line2 ?? v.address_line_2,
      v.postal_code,
      v.city,
    ].filter((p) => typeof p === "string" && p.trim().length > 0);
    const address = addressParts.length > 0 ? addressParts.join(", ") : null;

    // Représentant légal : aucune colonne dédiée en DB → on retombe sur
    // `contact_name` puis `contact_person` puis le nom commercial du vendor.
    const representativeName =
      (v.representative_name as string) ||
      (v.contact_name as string) ||
      (v.contact_person as string) ||
      (v.name as string) ||
      "";

    return {
      company_name: (v.company_name as string) || (v.name as string) || "",
      legal_form: (v.legal_form as string) || null,
      address,
      bce: derivedBce,
      vat: rawVat,
      representative_name: representativeName,
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

      {!isSignedCurrent && (
        <Card className="border-sky-200 bg-sky-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-700" />
              Mini guide — 3 étapes pour signer
            </CardTitle>
            <CardDescription>Comptez environ 5 minutes. Vos informations légales sont pré-remplies.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <div className="rounded-full bg-sky-100 text-sky-800 w-6 h-6 flex items-center justify-center text-xs font-semibold shrink-0">1</div>
                <div>
                  <p className="font-medium flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Lecture du mandat</p>
                  <p className="text-muted-foreground">Parcourez les clauses (article 53 §2 du Code TVA belge). Vérifiez que vos coordonnées légales et celles du représentant sont exactes.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="rounded-full bg-sky-100 text-sky-800 w-6 h-6 flex items-center justify-center text-xs font-semibold shrink-0">2</div>
                <div>
                  <p className="font-medium flex items-center gap-1.5"><PenLine className="w-3.5 h-3.5" /> Signature électronique</p>
                  <p className="text-muted-foreground">Cochez les cases d'acceptation, saisissez votre nom et rôle, puis cliquez sur « Signer ». Le PDF est généré et horodaté côté serveur.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="rounded-full bg-sky-100 text-sky-800 w-6 h-6 flex items-center justify-center text-xs font-semibold shrink-0">3</div>
                <div>
                  <p className="font-medium flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Confirmation &amp; archivage</p>
                  <p className="text-muted-foreground">Vous recevez le PDF signé par email. Il reste consultable à tout moment dans l'onglet « Contrat » de vos paramètres vendeur.</p>
                </div>
              </li>
            </ol>

            <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-white/70 p-3 text-xs text-sky-900">
              <RefreshCw className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p>
                <span className="font-medium">Astuce :</span> si la page ne reflète pas votre statut juste après la signature, rafraîchissez-la simplement
                (<kbd className="px-1 py-0.5 rounded bg-sky-100 border border-sky-300 text-[10px]">Ctrl/Cmd + Shift + R</kbd>).
                Inutile de vider le cache du navigateur.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
