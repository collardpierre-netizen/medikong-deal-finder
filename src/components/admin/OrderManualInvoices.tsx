/**
 * Factures manuelles d'une commande (admin).
 * Upload d'un PDF dans le bucket privé `invoices`, enregistrement dans
 * order_invoices (type = 'manual'). Le client retrouve ces factures dans
 * son portail (/commande/:id) via get-invoice-signed-url.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileUp, Download, Trash2, FileText } from "lucide-react";

interface Props {
  orderId: string;
  orderNumber?: string | null;
  defaultExclVat?: number;
  defaultVat?: number;
  defaultInclVat?: number;
}

const MAX_BYTES = 10 * 1024 * 1024;

export function OrderManualInvoices({ orderId, orderNumber, defaultExclVat = 0, defaultVat = 0, defaultInclVat = 0 }: Props) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: invoices = [] } = useQuery({
    queryKey: ["order-manual-invoices", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_invoices")
        .select("id, invoice_number, pdf_path, created_at, amount_incl_vat, status")
        .eq("order_id", orderId)
        .eq("type", "manual")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Sélectionnez un fichier PDF");
      if (file.size > MAX_BYTES) throw new Error("Fichier trop lourd (max 10 Mo)");
      if (file.type && file.type !== "application/pdf") throw new Error("Seuls les PDF sont acceptés");
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orderId}/manual-${Date.now()}-${safe}`;
      const up = await supabase.storage.from("invoices").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (up.error) throw up.error;
      const { error } = await supabase.from("order_invoices").insert({
        order_id: orderId,
        type: "manual",
        status: "sent",
        invoice_number: invoiceNumber.trim() || `MANUEL-${orderNumber || orderId.slice(0, 8)}`,
        pdf_path: path,
        amount_excl_vat: defaultExclVat,
        vat_amount: defaultVat,
        amount_incl_vat: defaultInclVat,
        issued_at: new Date().toISOString(),
      } as any);
      if (error) {
        await supabase.storage.from("invoices").remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Facture ajoutée — visible par le client dans son portail");
      setFile(null);
      setInvoiceNumber("");
      qc.invalidateQueries({ queryKey: ["order-manual-invoices", orderId] });
    },
    onError: (e: any) => toast.error(e?.message || "Upload impossible"),
  });

  const handleDownload = async (id: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("get-invoice-signed-url", { body: { invoice_id: id } });
    setBusy(false);
    if (error || !data?.signed_url) { toast.error("Lien indisponible"); return; }
    window.open(data.signed_url, "_blank");
  };

  const handleDelete = async (id: string, path: string | null) => {
    if (!confirm("Supprimer cette facture ? Le client n'y aura plus accès.")) return;
    const { error } = await supabase.from("order_invoices").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (path) await supabase.storage.from("invoices").remove([path]);
    toast.success("Facture supprimée");
    qc.invalidateQueries({ queryKey: ["order-manual-invoices", orderId] });
  };

  return (
    <div className="bg-white border rounded-lg p-4" style={{ borderColor: "#E2E8F0" }}>
      <div className="flex items-center gap-2 mb-3">
        <FileUp size={16} className="text-mk-blue" />
        <div className="text-sm font-semibold">Factures manuelles</div>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_200px_auto] items-end">
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">Fichier PDF</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs border rounded px-2 py-1.5"
            style={{ borderColor: "#E2E8F0" }}
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 block mb-1">N° de facture (optionnel)</label>
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="ex. FA-2026-0042"
            className="block w-full text-xs border rounded px-2 py-1.5"
            style={{ borderColor: "#E2E8F0" }}
          />
        </div>
        <button
          onClick={() => upload.mutate()}
          disabled={!file || upload.isPending}
          className="text-xs px-3 py-2 rounded text-white disabled:opacity-50"
          style={{ backgroundColor: "#1C58D9" }}
        >
          {upload.isPending ? "Envoi…" : "Ajouter"}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {invoices.length === 0 && (
          <div className="text-[11px] text-slate-400 italic">Aucune facture manuelle sur cette commande.</div>
        )}
        {invoices.map((inv: any) => (
          <div key={inv.id} className="flex items-center justify-between border rounded px-2 py-1.5" style={{ borderColor: "#F1F5F9" }}>
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={14} className="text-slate-400 shrink-0" />
              <div className="truncate">
                <div className="text-xs font-medium truncate">{inv.invoice_number || "Facture"}</div>
                <div className="text-[10px] text-slate-400">
                  {new Date(inv.created_at).toLocaleDateString("fr-BE")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => handleDownload(inv.id)} disabled={busy} className="text-[11px] text-mk-blue flex items-center gap-1">
                <Download size={13} /> PDF
              </button>
              <button onClick={() => handleDelete(inv.id, inv.pdf_path)} className="text-[11px] text-red-600 flex items-center gap-1">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10px] text-slate-400">
        Les factures ajoutées ici apparaissent automatiquement dans le portail client de la commande.
      </div>
    </div>
  );
}
