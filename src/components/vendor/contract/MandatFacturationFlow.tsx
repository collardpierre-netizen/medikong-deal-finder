import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Gauge,
  Info,
  Loader2,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  CONTRACT_TYPE,
  CONTRACT_VERSION,
  ContractVendorData,
  getMissingVendorFields,
} from "@/lib/contract/mandat-facturation-template";
import { generateContractPdf, hashBlob } from "@/lib/contract/generate-pdf";
import { ContractDocument } from "./ContractDocument";
import { SignatureCanvas, generateTypedSignature } from "./SignatureCanvas";

export interface SignedContractResult {
  contractId: string;
  pdfPath: string;
  pdfUrl: string | null;
  signedAt: string;
}

interface MandatFacturationFlowProps {
  vendorId: string;
  vendorEmail?: string | null;
  vendor: ContractVendorData;
  onSigned?: (result: SignedContractResult) => void;
  /** Si true, montre uniquement la consultation (déjà signé). */
  readOnly?: boolean;
}

type Screen = "intro" | "read" | "sign" | "confirmation";

export function MandatFacturationFlow({
  vendorId,
  vendorEmail,
  vendor,
  onSigned,
  readOnly = false,
}: MandatFacturationFlowProps) {
  const [screen, setScreen] = useState<Screen>(readOnly ? "read" : "intro");
  const [readAck, setReadAck] = useState(false);
  const [tab, setTab] = useState<"draw" | "type">("draw");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [typedName, setTypedName] = useState(vendor.representative_name || "");
  const [signing, setSigning] = useState(false);
  const [result, setResult] = useState<SignedContractResult | null>(null);

  const missingFields = useMemo(() => getMissingVendorFields(vendor), [vendor]);
  const canSign = missingFields.length === 0;

  // Signature finale : canvas tracé OU nom tapé
  const finalSignature: string | null = useMemo(() => {
    if (tab === "draw") return signatureDataUrl;
    if (tab === "type" && typedName.trim().length >= 3) {
      return generateTypedSignature(typedName.trim());
    }
    return null;
  }, [tab, signatureDataUrl, typedName]);

  const handleSign = async () => {
    if (!finalSignature) {
      toast.error("Veuillez apposer votre signature avant de continuer.");
      return;
    }
    setSigning(true);
    try {
      const signedAt = new Date();

      // 1. Génération PDF
      const pdfBlob = await generateContractPdf({
        vendor,
        signedAt,
        signatureDataUrl: finalSignature,
        signatureMethod: tab === "draw" ? "canvas" : "typed_name",
        signerName: typedName.trim() || vendor.representative_name,
        signerRole: vendor.representative_role,
      });
      const docHash = await hashBlob(pdfBlob);

      // 2. Upload PDF dans Supabase Storage
      const path = `${vendorId}/${CONTRACT_TYPE}-${CONTRACT_VERSION}-${signedAt.getTime()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("seller-contracts")
        .upload(path, pdfBlob, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      // 3. Récupérer User-Agent (IP côté serveur idéalement, ici user_agent client)
      const userAgent = navigator.userAgent;

      // 4. Insertion seller_contracts
      const { data: contract, error: insertError } = await supabase
        .from("seller_contracts")
        .insert({
          vendor_id: vendorId,
          contract_type: CONTRACT_TYPE,
          contract_version: CONTRACT_VERSION,
          signed_at: signedAt.toISOString(),
          signature_data: finalSignature,
          signature_method: tab === "draw" ? "canvas" : "typed_name",
          signer_name: typedName.trim() || vendor.representative_name,
          signer_role: vendor.representative_role || null,
          pdf_storage_path: path,
          document_hash: docHash,
          user_agent: userAgent,
          metadata: {
            screen_size: `${window.screen.width}x${window.screen.height}`,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        })
        .select("id, pdf_storage_path")
        .single();
      if (insertError) throw insertError;

      // 5. Marquer le vendor comme ayant signé (champ existant)
      await supabase
        .from("vendors")
        .update({
          commissionnaire_agreement_accepted_at: signedAt.toISOString(),
          commissionnaire_agreement_version: CONTRACT_VERSION,
        })
        .eq("id", vendorId);

      // 6. URL signée pour téléchargement
      const { data: signed } = await supabase.storage
        .from("seller-contracts")
        .createSignedUrl(path, 60 * 60); // 1h

      // 7. Email vendeur (template à scaffolder ensuite)
      if (vendorEmail) {
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "vendor-contract-signed",
              recipientEmail: vendorEmail,
              idempotencyKey: `contract-signed-${contract.id}`,
              templateData: {
                vendorCompanyName: vendor.company_name,
                signerName: typedName.trim() || vendor.representative_name,
                signedAtFormatted: signedAt.toLocaleString("fr-BE"),
                contractVersion: CONTRACT_VERSION,
                downloadUrl: signed?.signedUrl ?? null,
              },
            },
          });
          // Notification interne admin
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "admin-contract-notification",
              recipientEmail: "admin@medikong.pro",
              idempotencyKey: `admin-contract-${contract.id}`,
              templateData: {
                vendorCompanyName: vendor.company_name,
                vendorEmail,
                signerName: typedName.trim() || vendor.representative_name,
                signedAtFormatted: signedAt.toLocaleString("fr-BE"),
                contractVersion: CONTRACT_VERSION,
              },
            },
          });
        } catch (e) {
          console.warn("Email notification failed (non-blocking):", e);
        }
      }

      const finalResult: SignedContractResult = {
        contractId: contract.id,
        pdfPath: path,
        pdfUrl: signed?.signedUrl ?? null,
        signedAt: signedAt.toISOString(),
      };
      setResult(finalResult);
      setScreen("confirmation");
      onSigned?.(finalResult);
      toast.success("Convention signée avec succès");
    } catch (e: any) {
      console.error("Sign error:", e);
      toast.error(e?.message || "Erreur lors de la signature de la convention.");
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadPreview = async () => {
    try {
      const blob = await generateContractPdf({
        vendor,
        signedAt: new Date(),
        signatureDataUrl: "",
        signatureMethod: "canvas",
        signerName: vendor.representative_name,
        signerRole: vendor.representative_role,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `convention-mandat-facturation-apercu.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Impossible de générer l'aperçu PDF.");
    }
  };

  /* ─── ÉCRAN 1 : INTRO ─── */
  if (screen === "intro") {
    return (
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Document légal obligatoire avant votre première vente</AlertTitle>
          <AlertDescription>
            Cette convention autorise MediKong à émettre des factures en votre nom et pour votre compte,
            conformément à l'<strong>article 53 §2 du Code TVA belge</strong>. Sans signature, vous ne
            pouvez pas activer vos produits ni recevoir de commandes.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KeyCard
            icon={<Scale className="w-5 h-5" />}
            title="Pourquoi"
            description="Autoriser MediKong à émettre vos factures de vente — base légale article 53 §2 CTVA."
          />
          <KeyCard
            icon={<Gauge className="w-5 h-5" />}
            title="Durée"
            description="Indéterminée. Résiliable à tout moment avec un préavis écrit de 30 jours."
          />
          <KeyCard
            icon={<Sparkles className="w-5 h-5" />}
            title="Gratuit"
            description="Aucun frais lié à la signature. Seule la commission de 20% HTVA s'applique aux ventes."
          />
        </div>

        {!canSign && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Profil incomplet</AlertTitle>
            <AlertDescription>
              Avant de signer, complétez les champs suivants dans votre profil :{" "}
              <strong>{missingFields.join(", ")}</strong>.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button size="lg" disabled={!canSign} onClick={() => setScreen("read")}>
            <FileText className="w-4 h-4 mr-2" />
            Consulter et signer la convention
          </Button>
        </div>
      </div>
    );
  }

  /* ─── ÉCRAN 2 : LECTURE ─── */
  if (screen === "read") {
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-card/95 backdrop-blur border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Document à valeur juridique — lisez attentivement</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadPreview}>
            <Download className="w-4 h-4 mr-1.5" />
            Aperçu PDF
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-auto rounded-lg border border-border p-5 bg-background">
          <ContractDocument vendor={vendor} highlightFilled />
        </div>

        {!readOnly && (
          <>
            <label className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30 cursor-pointer">
              <Checkbox checked={readAck} onCheckedChange={(v) => setReadAck(v === true)} className="mt-0.5" />
              <span className="text-sm">
                J'ai lu et je comprends l'ensemble des clauses de la présente convention de mandat de
                facturation.
              </span>
            </label>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setScreen("intro")}>
                Retour
              </Button>
              <Button disabled={!readAck} onClick={() => setScreen("sign")}>
                Passer à la signature
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ─── ÉCRAN 3 : SIGNATURE ─── */
  if (screen === "sign") {
    return (
      <div className="space-y-5">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Récapitulatif</AlertTitle>
          <AlertDescription>
            <ul className="text-sm space-y-0.5 mt-1">
              <li>• <strong>Société :</strong> {vendor.company_name}</li>
              <li>• <strong>Représentée par :</strong> {vendor.representative_name}{vendor.representative_role ? ` (${vendor.representative_role})` : ""}</li>
              <li>• <strong>Convention :</strong> Mandat de facturation {CONTRACT_VERSION}</li>
              <li>• <strong>Date :</strong> {new Date().toLocaleDateString("fr-BE", { year: "numeric", month: "long", day: "numeric" })}</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "draw" | "type")}>
          <TabsList className="grid grid-cols-2 w-full max-w-sm">
            <TabsTrigger value="draw">Tracer ma signature</TabsTrigger>
            <TabsTrigger value="type">Saisir mon nom</TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="space-y-2 pt-3">
            <SignatureCanvas onChange={setSignatureDataUrl} />
          </TabsContent>

          <TabsContent value="type" className="space-y-2 pt-3">
            <Label htmlFor="typed-name">Nom complet du signataire</Label>
            <Input
              id="typed-name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Prénom Nom"
            />
            {typedName.trim().length >= 3 && (
              <div className="rounded-lg border-2 border-dashed border-border bg-background p-4 text-center">
                <span
                  className="text-3xl text-foreground"
                  style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive", fontStyle: "italic" }}
                >
                  {typedName}
                </span>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground italic">
          En signant, j'accepte que cette signature électronique ait la même valeur juridique qu'une signature
          manuscrite (règlement eIDAS n°910/2014). Date, heure, navigateur et adresse IP sont enregistrés à
          des fins de valeur probante.
        </p>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => setScreen("read")} disabled={signing}>
            Retour
          </Button>
          <Button onClick={handleSign} disabled={!finalSignature || signing} size="lg">
            {signing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Génération du PDF...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Signer définitivement
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  /* ─── ÉCRAN 4 : CONFIRMATION ─── */
  return (
    <div className="text-center py-8 space-y-5">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-9 h-9 text-green-600" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-foreground">Convention signée avec succès</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Une copie PDF de votre convention vous a été envoyée par email. Vous pouvez également la télécharger
          ci-dessous.
        </p>
      </div>
      <div className="flex justify-center gap-3 flex-wrap">
        {result?.pdfUrl && (
          <Button variant="outline" asChild>
            <a href={result.pdfUrl} download target="_blank" rel="noreferrer">
              <Download className="w-4 h-4 mr-2" />
              Télécharger mon exemplaire PDF
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

function KeyCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
    </div>
  );
}
