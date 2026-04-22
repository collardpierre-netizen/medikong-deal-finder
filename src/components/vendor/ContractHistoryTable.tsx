import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  FileText,
  Loader2,
  Download,
  ShieldCheck,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface ContractHistoryTableProps {
  vendorId: string | undefined;
  /** When true, exposes admin-only columns (IP, user agent). */
  adminView?: boolean;
}

interface SellerContract {
  id: string;
  contract_type: string;
  contract_version: string;
  signed_at: string;
  signature_method: string;
  signer_name: string;
  signer_role: string | null;
  pdf_storage_path: string | null;
  document_hash: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  mandat_facturation: "Convention de mandat de facturation",
};

const METHOD_LABELS: Record<string, string> = {
  canvas: "Signature tracée",
  typed_name: "Nom saisi",
};

/**
 * Consultable history of seller-contract signatures (date, status, document hash).
 * Used in vendor billing screen and admin vendor detail view.
 * RLS ensures vendors only see their own contracts; admins see all.
 */
export function ContractHistoryTable({ vendorId, adminView = false }: ContractHistoryTableProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["seller-contracts-history", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_contracts")
        .select(
          "id, contract_type, contract_version, signed_at, signature_method, signer_name, signer_role, pdf_storage_path, document_hash, ip_address, user_agent, metadata, created_at"
        )
        .eq("vendor_id", vendorId!)
        .order("signed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SellerContract[];
    },
  });

  const handleDownload = async (contract: SellerContract) => {
    if (!contract.pdf_storage_path) {
      toast.error("Aucun PDF associé à cette signature.");
      return;
    }
    setDownloadingId(contract.id);
    try {
      // Short-lived signed URL (5 min) — vendor/admin direct download
      const { data, error } = await supabase.storage
        .from("seller-contracts")
        .createSignedUrl(contract.pdf_storage_path, 300);
      if (error || !data?.signedUrl) throw error ?? new Error("No URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Téléchargement indisponible. Réessayez plus tard.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      toast.success("Empreinte SHA-256 copiée");
      setTimeout(() => setCopiedHash(null), 1500);
    } catch {
      toast.error("Impossible de copier l'empreinte");
    }
  };

  if (!vendorId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#8B95A5]">
        <Loader2 size={18} className="animate-spin mr-2" />
        <span className="text-[13px]">Chargement de l'historique…</span>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-[#E2E8F0] rounded-lg bg-[#FAFBFC]">
        <FileText size={40} className="text-[#CBD5E1] mx-auto mb-3" />
        <p className="text-[13px] text-[#8B95A5]">Aucune signature enregistrée</p>
        <p className="text-[12px] text-[#8B95A5] mt-1">
          La convention de mandat de facturation n'a pas encore été signée.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
            <th className="text-left py-2.5 px-3 font-medium">Date de signature</th>
            <th className="text-left py-2.5 px-3 font-medium">Document</th>
            <th className="text-left py-2.5 px-3 font-medium">Signataire</th>
            <th className="text-left py-2.5 px-3 font-medium">Méthode</th>
            <th className="text-left py-2.5 px-3 font-medium">Statut</th>
            <th className="text-left py-2.5 px-3 font-medium">Empreinte (SHA-256)</th>
            {adminView && (
              <th className="text-left py-2.5 px-3 font-medium">IP</th>
            )}
            <th className="text-right py-2.5 px-3 font-medium">PDF</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => {
            const typeLabel = TYPE_LABELS[c.contract_type] ?? c.contract_type;
            const methodLabel = METHOD_LABELS[c.signature_method] ?? c.signature_method;
            const shortHash = c.document_hash
              ? `${c.document_hash.slice(0, 10)}…${c.document_hash.slice(-6)}`
              : "—";
            return (
              <tr key={c.id} className="border-b border-[#F1F5F9] hover:bg-[#FAFBFC] align-top">
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="font-medium text-[#1D2530]">
                    {format(new Date(c.signed_at), "dd MMM yyyy", { locale: fr })}
                  </div>
                  <div className="text-[11px] text-[#8B95A5]">
                    {format(new Date(c.signed_at), "HH:mm", { locale: fr })}
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-medium text-[#1D2530]">{typeLabel}</div>
                  <div className="text-[11px] text-[#8B95A5]">v{c.contract_version}</div>
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-medium text-[#1D2530]">{c.signer_name}</div>
                  {c.signer_role && (
                    <div className="text-[11px] text-[#8B95A5]">{c.signer_role}</div>
                  )}
                </td>
                <td className="py-2.5 px-3 text-[#616B7C]">{methodLabel}</td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E6F4EA] text-[#0F7A3A] text-[11px] font-semibold">
                    <ShieldCheck size={11} />
                    Signée
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  {c.document_hash ? (
                    <button
                      onClick={() => handleCopyHash(c.document_hash!)}
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#616B7C] hover:text-[#1B5BDA] group"
                      title={c.document_hash}
                    >
                      <span>{shortHash}</span>
                      {copiedHash === c.document_hash ? (
                        <Check size={12} className="text-[#0F7A3A]" />
                      ) : (
                        <Copy size={12} className="opacity-50 group-hover:opacity-100" />
                      )}
                    </button>
                  ) : (
                    <span className="text-[#CBD5E1]">—</span>
                  )}
                </td>
                {adminView && (
                  <td className="py-2.5 px-3 text-[11px] font-mono text-[#616B7C]">
                    {c.ip_address ?? "—"}
                  </td>
                )}
                <td className="py-2.5 px-3 text-right">
                  <button
                    onClick={() => handleDownload(c)}
                    disabled={!c.pdf_storage_path || downloadingId === c.id}
                    className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#616B7C] hover:text-[#1B5BDA] disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Télécharger le PDF signé"
                  >
                    {downloadingId === c.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Download size={15} />
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
