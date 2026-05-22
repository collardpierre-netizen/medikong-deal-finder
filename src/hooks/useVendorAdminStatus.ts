import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONTRACT_VERSION } from "@/lib/contract/mandat-facturation-template";

/**
 * Vérifie la complétude administrative d'un vendeur selon 4 axes :
 *  - Identité légale (raison sociale, BCE/TVA, adresse)
 *  - Représentant légal (nom, rôle, ville de signature)
 *  - KYC validé par MediKong (validation_status ∈ {accepted, approved})
 *  - Convention de mandat de facturation signée (contract_version courant)
 *
 * Renvoie un statut global (`complete`/`incomplete`) + le détail des champs
 * manquants pour pouvoir guider le vendeur depuis le header.
 */
export interface VendorAdminStatusGroup {
  key: "legal" | "representative" | "kyc" | "contract";
  label: string;
  ok: boolean;
  missing: string[];
}

export interface VendorAdminStatus {
  isComplete: boolean;
  totalMissing: number;
  groups: VendorAdminStatusGroup[];
}

export function useVendorAdminStatus(vendorId: string | undefined) {
  return useQuery<VendorAdminStatus>({
    queryKey: ["vendor-admin-status", vendorId, CONTRACT_VERSION],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data: vendor, error: vErr } = await supabase
        .from("vendors")
        .select(
          "company_name, vat_number, bce_number, address_line1, city, representative_name, representative_role, validation_status"
        )
        .eq("id", vendorId!)
        .maybeSingle();
      if (vErr) throw vErr;

      const { data: contract, error: cErr } = await supabase
        .from("seller_contracts")
        .select("id, contract_version, signed_at")
        .eq("vendor_id", vendorId!)
        .eq("contract_version", CONTRACT_VERSION)
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cErr) throw cErr;

      const v = (vendor ?? {}) as Record<string, string | null>;
      const has = (val: string | null | undefined) =>
        typeof val === "string" && val.trim().length > 0;

      const legalMissing: string[] = [];
      if (!has(v.company_name)) legalMissing.push("Raison sociale");
      if (!has(v.vat_number)) legalMissing.push("Numéro de TVA");
      if (!has(v.bce_number) && !has(v.vat_number)) legalMissing.push("Numéro BCE");
      if (!has(v.address_line1)) legalMissing.push("Adresse postale");
      if (!has(v.city)) legalMissing.push("Ville");

      const repMissing: string[] = [];
      if (!has(v.representative_name)) repMissing.push("Nom du représentant légal");
      if (!has(v.representative_role)) repMissing.push("Fonction du représentant");
      if (!has(v.city)) repMissing.push("Lieu de signature (ville)");

      const kycOk =
        v.validation_status === "accepted" || v.validation_status === "approved";
      const kycMissing = kycOk ? [] : ["Validation KYC par MediKong"];

      const contractOk = !!contract?.signed_at;
      const contractMissing = contractOk
        ? []
        : [`Convention de mandat de facturation (${CONTRACT_VERSION})`];

      const groups: VendorAdminStatusGroup[] = [
        { key: "legal", label: "Identité légale", ok: legalMissing.length === 0, missing: legalMissing },
        { key: "representative", label: "Représentant légal", ok: repMissing.length === 0, missing: repMissing },
        { key: "kyc", label: "KYC MediKong", ok: kycOk, missing: kycMissing },
        { key: "contract", label: "Mandat de facturation", ok: contractOk, missing: contractMissing },
      ];

      const totalMissing = groups.reduce((n, g) => n + g.missing.length, 0);
      return { isComplete: totalMissing === 0, totalMissing, groups };
    },
    staleTime: 60_000,
  });
}
