import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, FileWarning } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
  invoiceType?: "order" | "commission";
  invoiceNumber?: string | null;
}

export default function PeppolCreditNotesDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceType = "order",
  invoiceNumber,
}: Props) {
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["peppol-credit-notes", invoiceType, invoiceId],
    enabled: open && !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peppol_credit_notes" as any)
        .select("*")
        .eq("invoice_id", invoiceId!)
        .eq("invoice_type", invoiceType)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historique des avoirs Peppol</DialogTitle>
          <DialogDescription>
            Facture {invoiceNumber || invoiceId}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
            <FileWarning className="mb-2 h-6 w-6" />
            Aucun avoir émis pour cette facture.
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto space-y-2">
            {notes.map((n) => (
              <div
                key={n.id}
                className="rounded-md border border-slate-200 p-3 text-[12px]"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-[13px]">
                    {new Date(n.created_at).toLocaleString("fr-BE")}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {n.falco_credit_note_id || "—"}
                  </span>
                </div>
                <div className="mb-1">
                  <span className="text-slate-500">Motif : </span>
                  <span className="text-slate-800">{n.reason || "—"}</span>
                </div>
                <div className="mb-1">
                  <span className="text-slate-500">Émis par : </span>
                  <span className="text-slate-800">
                    {n.issued_by_email || n.issued_by || "système"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Document Peppol d'origine : </span>
                  <span className="font-mono text-[11px] text-slate-800">
                    {n.falco_original_document_id || "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
