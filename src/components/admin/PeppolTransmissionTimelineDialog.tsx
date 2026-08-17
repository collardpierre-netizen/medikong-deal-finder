import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface Props {
  orderInvoiceId: string | null;
  invoiceNumber?: string | null;
  onClose: () => void;
}

const FLOW_LABEL: Record<string, string> = {
  buyer_invoice: "Transmission acheteur",
  vendor_copy: "Double vendeur",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  submitted: "Soumise",
  sent: "Transmise",
  delivered: "Reçue par le destinataire",
  failed: "Échec",
  blocked_missing_id: "Bloquée — identifiant manquant",
  blocked_not_registered: "Bloquée — destinataire non inscrit",
  skipped: "Ignorée",
};

const STATUS_COLOR: Record<string, string> = {
  delivered: "#059669",
  sent: "#1B5BDA",
  submitted: "#1B5BDA",
  pending: "#8B95A5",
  failed: "#B91C1C",
  blocked_missing_id: "#B45309",
  blocked_not_registered: "#B45309",
  skipped: "#8B95A5",
};

/** Read-only timeline of every Peppol/email transmission attached to a sales invoice. */
export function PeppolTransmissionTimelineDialog({ orderInvoiceId, invoiceNumber, onClose }: Props) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["peppol-transmissions", orderInvoiceId],
    enabled: !!orderInvoiceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("peppol_transmissions")
        .select("*")
        .eq("order_invoice_id", orderInvoiceId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  if (!orderInvoiceId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Transmissions de la facture</h3>
            <p className="text-xs text-slate-500">{invoiceNumber || orderInvoiceId}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {isLoading && <div className="text-sm text-slate-500">Chargement…</div>}
          {!isLoading && rows.length === 0 && (
            <div className="text-sm text-slate-500">Aucune transmission enregistrée pour cette facture.</div>
          )}
          {rows.map((r) => (
            <div key={r.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  {FLOW_LABEL[r.flow] || r.flow} · {r.channel === "peppol" ? "Réseau Peppol" : "Email"}
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ backgroundColor: (STATUS_COLOR[r.status] || "#8B95A5") + "1A", color: STATUS_COLOR[r.status] || "#8B95A5" }}
                >
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 space-y-0.5">
                <div>
                  Destinataire : {r.receiver_name_snapshot || "—"}
                  {r.receiver_peppol_id ? ` · ${r.receiver_peppol_id}` : ""}
                </div>
                <div>Émetteur déclaré : {r.sender_name_snapshot || "—"}{r.sender_vat_snapshot ? ` · ${r.sender_vat_snapshot}` : ""}</div>
                <div>
                  Soumise : {r.submitted_at ? new Date(r.submitted_at).toLocaleString("fr-BE") : "—"}
                  {r.delivered_at ? ` · Reçue : ${new Date(r.delivered_at).toLocaleString("fr-BE")}` : ""}
                </div>
                {r.peppol_document_id && <div className="font-mono">Document Falco : {r.peppol_document_id}</div>}
                {(r.retry_count ?? 0) > 0 && <div>Tentatives : {r.retry_count}</div>}
                {r.payload_sha256 && <div className="font-mono truncate">Empreinte payload : {r.payload_sha256}</div>}
                {r.last_error && <div className="text-red-600">Dernière erreur : {r.last_error}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PeppolTransmissionTimelineDialog;
