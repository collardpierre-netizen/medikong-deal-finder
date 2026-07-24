import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fmtEurFromCents } from "@/lib/format-currency";
import { formatUpdatedAt } from "@/lib/format-date";
import { ArrowLeft, Download, Send, RefreshCw, FileText, Coins, Receipt, Percent } from "lucide-react";

/**
 * /admin/commissions-revenus/:id
 * Détail d'une facture commission MediKong : entête + lignes + PDF + Peppol.
 */

const STATUS_LABEL: Record<string, string> = {
  to_invoice: "À facturer", invoiced: "Facturée", paid: "Payée",
  disputed: "En litige", cancelled: "Annulée",
};
const STATUS_COLOR: Record<string, string> = {
  to_invoice: "bg-orange-100 text-orange-800", invoiced: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800", disputed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-700",
};
const PEPPOL_COLOR: Record<string, string> = {
  accepted: "bg-green-100 text-green-800",
  delivered: "bg-green-100 text-green-800",
  sent: "bg-blue-100 text-blue-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  blocked_missing_id: "bg-red-100 text-red-800",
};

export default function AdminCommissionInvoiceDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();

  const invoiceQ = useQuery({
    queryKey: ["commission-invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_invoices")
        .select("*, vendors(name, company_name, vat_number, peppol_id, country_code), orders(order_number)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const linesQ = useQuery({
    queryKey: ["commission-invoice-lines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_invoice_lines")
        .select("*, orders(order_number)")
        .eq("commission_invoice_id", id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const generatePdfM = useMutation({
    mutationFn: async (force: boolean = false) => {
      const { data, error } = await supabase.functions.invoke("generate-commission-invoice-pdf", {
        body: { invoice_id: id, force },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "PDF generation failed");
      return data;
    },
    onSuccess: () => { toast.success("PDF généré"); qc.invalidateQueries({ queryKey: ["commission-invoice", id] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur PDF"),
  });

  const downloadPdfM = useMutation({
    mutationFn: async () => {
      let pdfPath = invoiceQ.data?.pdf_path;
      if (!pdfPath) {
        const res = await generatePdfM.mutateAsync(false);
        pdfPath = (res as any)?.pdf_path;
      }
      if (!pdfPath) throw new Error("PDF introuvable");
      const { data, error } = await supabase.storage.from("invoices").createSignedUrl(pdfPath, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    },
    onError: (e: any) => toast.error(e?.message),
  });

  const sendPeppolM = useMutation({
    mutationFn: async (force: boolean = false) => {
      const { data, error } = await supabase.functions.invoke("send-commission-invoice-peppol", {
        body: { invoice_id: id, force },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.ok) toast.success(`Envoyé Peppol (${data.peppol_status || "sent"})`);
      else toast.error(data?.error || "Envoi Peppol échoué");
      qc.invalidateQueries({ queryKey: ["commission-invoice", id] });
    },
    onError: (e: any) => toast.error(e?.message),
  });

  const inv = invoiceQ.data;
  const lines = linesQ.data ?? [];

  const kpis = useMemo(() => {
    if (!inv) return null;
    return {
      ht: inv.commission_excl_vat_cents ?? 0,
      vat: inv.vat_cents ?? 0,
      ttc: inv.total_incl_vat_cents ?? 0,
      base: inv.revenue_excl_vat_cents ?? 0,
      lines: inv.lines_count ?? lines.length,
    };
  }, [inv, lines]);

  if (invoiceQ.isLoading) return <div className="p-8">Chargement…</div>;
  if (!inv) return <div className="p-8">Facture introuvable.</div>;

  const vname = inv.vendors?.company_name || inv.vendors?.name || inv.vendor_id.slice(0, 8);
  const vendorIsBE = String(inv.vendors?.country_code || "").toUpperCase() === "BE";
  const peppolStatus = inv.peppol_status ?? "not_sent";

  return (
    <div>
      <AdminTopBar title={`Facture ${inv.invoice_number ?? "Sans numéro"}`} subtitle={`Vendeur : ${vname}`} />
      <div className="mb-4">
        <Link to="/admin/commissions-revenus" className="text-sm text-[#1B5BDA] hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Retour au dashboard commissions
        </Link>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Badge className={STATUS_COLOR[inv.status] || ""}>{STATUS_LABEL[inv.status] || inv.status}</Badge>
        <Badge className={inv.type === "trading" ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-800"}>
          {inv.type === "trading" ? "Trading (100% marge)" : "Marketplace (% CA)"}
        </Badge>
        <Badge variant="outline">{inv.sales_channel === "manual" ? "Vente manuelle" : inv.sales_channel === "online" ? "Vente en ligne" : "Mixte"}</Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadPdfM.mutate()} disabled={downloadPdfM.isPending || generatePdfM.isPending}>
            <Download className="w-3 h-3 mr-1" /> Télécharger PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => generatePdfM.mutate(true)} disabled={generatePdfM.isPending}>
            <RefreshCw className="w-3 h-3 mr-1" /> Régénérer PDF
          </Button>
          <Button
            size="sm"
            onClick={() => sendPeppolM.mutate(false)}
            disabled={sendPeppolM.isPending || (vendorIsBE && !inv.vendors?.peppol_id)}
            title={vendorIsBE && !inv.vendors?.peppol_id ? "Peppol ID vendeur manquant" : "Envoyer via Peppol"}
          >
            <Send className="w-3 h-3 mr-1" /> Envoyer Peppol
          </Button>
          {["accepted", "delivered", "sent"].includes(String(peppolStatus).toLowerCase()) && (
            <Button variant="outline" size="sm" onClick={() => sendPeppolM.mutate(true)}>
              Renvoyer (force)
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard icon={Coins} label="Base HTVA" value={fmtEurFromCents(kpis!.base)} />
        <KpiCard icon={Percent} label={`Commission (${(inv.vat_rate ?? 21)}% TVA)`} value={fmtEurFromCents(kpis!.ht)} />
        <KpiCard icon={Receipt} label="TVA" value={fmtEurFromCents(kpis!.vat)} />
        <KpiCard icon={Receipt} label="Total TTC" value={fmtEurFromCents(kpis!.ttc)} />
        <KpiCard icon={FileText} label="Lignes" value={String(kpis!.lines)} />
      </div>

      {/* Meta */}
      <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Field label="Numéro" value={inv.invoice_number ?? "—"} mono />
        <Field label="Créée le" value={formatUpdatedAt(inv.created_at)} />
        <Field label="Période" value={`${inv.period_start} → ${inv.period_end}`} />
        <Field label="Vendeur" value={vname} />
        <Field label="Pays" value={inv.vendor_country_code ?? "—"} />
        <Field label="TVA vendeur" value={inv.vendors?.vat_number ?? "—"} mono />
        <Field label="Peppol ID vendeur" value={inv.vendors?.peppol_id ?? "—"} mono />
        <Field label="Commande liée" value={
          inv.orders?.order_number ? (
            <Link to={`/admin/commandes/${inv.orders.order_number}`} className="text-[#1B5BDA] hover:underline">{inv.orders.order_number}</Link>
          ) : "—"
        } />
        <Field label="Facturée le" value={inv.invoiced_at ? formatUpdatedAt(inv.invoiced_at) : "—"} />
        <Field label="Échéance" value={inv.due_date ?? "—"} />
        <Field label="Payée le" value={inv.paid_at ? formatUpdatedAt(inv.paid_at) : "—"} />
        <Field label="Réf. paiement" value={inv.payment_reference ?? "—"} />
      </div>

      {/* Peppol block */}
      <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-5 mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Send className="w-4 h-4 text-[#1B5BDA]" /> Envoi Peppol</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Statut" value={
            <Badge className={PEPPOL_COLOR[String(peppolStatus).toLowerCase()] || "bg-gray-100 text-gray-700"}>
              {peppolStatus}
            </Badge>
          } />
          <Field label="Document ID" value={inv.peppol_document_id ?? "—"} mono />
          <Field label="Tentatives" value={String(inv.peppol_retry_count ?? 0)} />
          <Field label="Dernière tentative" value={inv.peppol_last_attempt_at ? formatUpdatedAt(inv.peppol_last_attempt_at) : "—"} />
          {inv.peppol_error && (
            <div className="col-span-full">
              <p className="text-xs uppercase text-[#616B7C] mb-1">Erreur</p>
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{inv.peppol_error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white border border-[#E2E8F0] rounded-[10px] overflow-x-auto">
        <div className="p-4 border-b border-[#F1F5F9] font-semibold text-sm">Lignes facturées ({lines.length})</div>
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-xs uppercase text-[#616B7C]">
            <tr>
              <th className="p-2 text-left">Commande</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Base commission</th>
              <th className="p-2 text-right">GMV TTC</th>
              <th className="p-2 text-right">CA HTVA</th>
              <th className="p-2 text-right">Taux</th>
              <th className="p-2 text-right">Commission HTVA</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l: any) => (
              <tr key={l.id} className="border-t border-[#F1F5F9]">
                <td className="p-2 text-xs">
                  {l.orders?.order_number ? (
                    <Link to={`/admin/commandes/${l.orders.order_number}`} className="text-[#1B5BDA] hover:underline font-mono">{l.orders.order_number}</Link>
                  ) : <span className="font-mono">{l.order_id?.slice(0, 8)}</span>}
                </td>
                <td className="p-2">
                  <Badge className={l.type === "trading" ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-800"} variant="outline">
                    {l.type}
                  </Badge>
                </td>
                <td className="p-2 text-xs">{l.commission_basis ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{fmtEurFromCents(l.gmv_incl_vat_cents)}</td>
                <td className="p-2 text-right tabular-nums">{fmtEurFromCents(l.revenue_excl_vat_cents)}</td>
                <td className="p-2 text-right tabular-nums text-xs">{l.commission_rate != null ? `${(Number(l.commission_rate) * (Number(l.commission_rate) < 1 ? 100 : 1)).toFixed(2)}%` : "—"}</td>
                <td className="p-2 text-right tabular-nums font-semibold">{fmtEurFromCents(l.commission_excl_vat_cents)}</td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-[#8B95A5]">Aucune ligne rattachée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase text-[#616B7C] mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
