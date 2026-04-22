/**
 * Client de la nouvelle Edge Function `generate-contract-pdf`.
 *
 * La génération du PDF + l'upload Storage + l'insertion `seller_contracts`
 * sont désormais centralisés côté serveur :
 *  - source unique du template (mémoire MediKong defaults & articles),
 *  - empreinte SHA-256 calculée sur le PDF réellement stocké,
 *  - logs structurés visibles dans les Edge Function logs,
 *  - audit_logs en cas d'échec d'upload,
 *  - capture IP + User-Agent côté serveur (valeur juridique renforcée).
 *
 * Le client n'a plus à gérer la chaîne render → hash → upload → insert.
 */
import { supabase } from "@/integrations/supabase/client";
import { contractLogger, measureStage } from "@/lib/contract/contract-logger";
import type { ContractVendorData } from "@/lib/contract/mandat-facturation-template";

export interface SignContractServerArgs {
  vendorId: string;
  vendor: ContractVendorData;
  signatureDataUrl: string;
  signatureMethod: "canvas" | "typed_name";
  signerName: string;
  signerRole?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SignContractServerResponse {
  contractId: string;
  pdfPath: string;
  pdfUrl: string | null;
  signedAt: string;
  documentHash: string;
  contractVersion: string;
}

export class SignContractServerError extends Error {
  status?: number;
  issues?: unknown;
  constructor(message: string, opts?: { status?: number; issues?: unknown }) {
    super(message);
    this.name = "SignContractServerError";
    this.status = opts?.status;
    this.issues = opts?.issues;
  }
}

export async function signContractOnServer(
  args: SignContractServerArgs
): Promise<SignContractServerResponse> {
  return measureStage(
    "render_pdf",
    "edge-fn generate-contract-pdf",
    async () => {
      const { data, error } = await supabase.functions.invoke<SignContractServerResponse>(
        "generate-contract-pdf",
        {
          body: {
            vendorId: args.vendorId,
            vendor: args.vendor,
            signatureDataUrl: args.signatureDataUrl,
            signatureMethod: args.signatureMethod,
            signerName: args.signerName,
            signerRole: args.signerRole ?? null,
            metadata: args.metadata,
          },
        }
      );

      if (error) {
        // supabase.functions.invoke renvoie une FunctionsHttpError dont on
        // peut tenter d'extraire le body JSON (status + payload).
        let parsed: { error?: string; issues?: unknown; status?: number } | null = null;
        try {
          // @ts-expect-error - context.response exposé par la lib
          const resp = error.context?.response as Response | undefined;
          if (resp) {
            const text = await resp.text();
            parsed = text ? JSON.parse(text) : null;
            (parsed as any).status = resp.status;
          }
        } catch {
          /* swallow */
        }
        const status = parsed?.status;
        const message = parsed?.error || error.message || "edge function failed";
        contractLogger.error({
          stage: "render_pdf",
          message: "generate-contract-pdf returned error",
          vendorId: args.vendorId,
          context: { status, issues: parsed?.issues },
          error,
        });
        throw new SignContractServerError(message, { status, issues: parsed?.issues });
      }

      if (!data) {
        throw new SignContractServerError("empty_response");
      }

      return data;
    },
    { vendorId: args.vendorId }
  );
}
