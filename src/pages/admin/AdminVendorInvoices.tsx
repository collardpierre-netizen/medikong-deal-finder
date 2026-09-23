import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Loader2, Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import EpcPaymentQr from "@/components/payments/EpcPaymentQr";
import { formatUpdatedAt } from "@/lib/format-date";
import DocLanguageSelect from "@/components/documents/DocLanguageSelect";
import type { DocLang } from "@/lib/doc-i18n";
import {
  buildVendorInvoicePdf,
  downloadVendorInvoicePdf,
  vendorInvoiceKindLabel,
  type VendorInvoicePdfInput,
} from "@/lib/vendor-invoice-pdf";

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  type: string | null;
  status: string | null;
  amount_excl_vat: number | null;
  vat_amount: number | null;
  amount_incl_vat: number | null;
  issued_at: string | null;
  due_date: string | null;
  created_at: string;
  sent_at: string | null;
  sent_to: string | null;
  pdf_path: string | null;
  vendor_id: string | null;
  order: { order_number: string | null } | null;
  vendor: {
    id: string;
    name: string | null;
    company_name: string | null;
    email: string | null;
    contact_email: string | null;
    vat_number: string | null;
    address_line1: string | null;
    postal_code: string | null;
    city: string | null;
    country_code: string | null;
  } | null;
}

const eur = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(Number(n) || 0);

const TypeBadge = ({ type }: { type: string | null }) => {
  const cfg =
    type === "commission"
      ? { label: "Commission MediKong", bg: "#EEF2FF", text: "#4338CA" }
      : type === "self_billing"
        ? { label: "Au nom et pour le compte", bg: "#F0FDF4", text: "#059669" }
        : { label: type || "Autre", bg: "#F1F5F9", text: "#616B7C" };
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
};

const AdminVendorInvoices = () => {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [docLang, setDocLang] = useState<DocLang>("fr");

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ["admin-vendor-invoices"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_invoices")
        .select(
          "id, invoice_number, type, status, amount_excl_vat, vat_amount, amount_incl_vat, issued_at, due_date, created_at, sent_at, sent_to, pdf_path, vendor_id, order:orders!order_invoices_order_id_fkey(order_number), vendor:vendors!order_invoices_vendor_id_fkey(id, name, company_name, email, contact_email, vat_number, address_line1, postal_code, city, country_code)",
        )
        .not("vendor_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceRow[];
    },
  });

  const vendors = useMemo(() => {
    const map = new Map<
      string,
      { id: string; label: string; email: string | null; count: number; total: number }
    >();
    for (const inv of invoices ?? []) {
      if (!inv.vendor_id) continue;
      const entry = map.get(inv.vendor_id) ?? {
        id: inv.vendor_id,
        label: inv.vendor?.company_name || inv.vendor?.name || "Fournisseur",
        email: inv.vendor?.email || inv.vendor?.contact_email || null,
        count: 0,
        total: 0,
      };
      entry.count += 1;
      entry.total += Number(inv.amount_incl_vat) || 0;
      map.set(inv.vendor_id, entry);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [invoices]);

  const activeVendor = selectedVendor ?? vendors[0]?.id ?? null;
  const vendorInvoices = (invoices ?? []).filter((i) => i.vendor_id === activeVendor);
  const current =
    vendorInvoices.find((i) => i.id === selectedInvoice) ?? vendorInvoices[0] ?? null;

  const toPdfInput = (inv: InvoiceRow): VendorInvoicePdfInput => ({
    kind: inv.type || "manual",
    invoiceNumber: inv.invoice_number || inv.id.slice(0, 8).toUpperCase(),
    issuedAt: inv.issued_at || inv.created_at,
    dueDate: inv.due_date,
    status: inv.status,
    orderNumber: inv.order?.order_number ?? null,
    vendor: {
      name: inv.vendor?.name || "Fournisseur",
      companyName: inv.vendor?.company_name,
      vatNumber: inv.vendor?.vat_number,
      addressLine1: inv.vendor?.address_line1,
      postalCode: inv.vendor?.postal_code,
      city: inv.vendor?.city,
      countryCode: inv.vendor?.country_code,
      email: inv.vendor?.email || inv.vendor?.contact_email,
    },
    amountExclVat: Number(inv.amount_excl_vat) || 0,
    vatAmount: Number(inv.vat_amount) || 0,
    amountInclVat: Number(inv.amount_incl_vat) || 0,
    lang: docLang,
  });

  const download = async (inv: InvoiceRow) => {
    setBusy(inv.id);
    try {
      await downloadVendorInvoicePdf(toPdfInput(inv));
    } catch (e: any) {
      toast.error("Génération du PDF impossible", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const sendByEmail = async (inv: InvoiceRow) => {
    const recipient = inv.vendor?.email || inv.vendor?.contact_email;
    if (!recipient) {
      toast.error("Aucune adresse e-mail pour ce fournisseur", {
        description: "Renseignez son e-mail dans sa fiche avant l'envoi.",
      });
      return;
    }
    setBusy(inv.id);
    try {
      const input = toPdfInput(inv);
      const { blob } = await buildVendorInvoicePdf(input);
      const path = `vendor-invoices/${inv.vendor_id}/${input.invoiceNumber.replace(/[^\w.-]+/g, "-")}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("invoices")
        .upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;

      const { data, error } = await supabase.functions.invoke("send-vendor-invoice-email", {
        body: { invoice_id: inv.id, pdf_path: path, recipient_email: recipient },
      });
      if (error) throw error;
      toast.success("Facture envoyée", { description: `À ${(data as any)?.recipient || recipient}` });
      void refetch();
    } catch (e: any) {
      toast.error("Envoi impossible", { description: e?.message || String(e) });
    } finally {
      setBusy(null);
    }
  };

  if (authLoading) {
    return (
      <div className="p-10 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={16} /> Chargement…
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/admin/login" replace />;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-xl font-bold text-[#1E252F]">Factures fournisseurs</h1>
        <p className="text-sm text-muted-foreground">
          Factures de commission MediKong et factures émises au nom et pour le compte des
          fournisseurs, avec les coordonnées bancaires MediKong et le QR de paiement SEPA.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={16} /> Chargement des factures…
        </div>
      ) : vendors.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune facture fournisseur pour le moment.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Fournisseurs */}
          <aside className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-white h-fit">
            <div className="px-3 py-2 text-[11px] uppercase font-semibold text-muted-foreground border-b border-[#E2E8F0]">
              Fournisseurs
            </div>
            <ul>
              {vendors.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => {
                      setSelectedVendor(v.id);
                      setSelectedInvoice(null);
                    }}
                    className={`w-full text-left px-3 py-2.5 border-b border-[#F1F5F9] hover:bg-[#F8FAFC] ${
                      activeVendor === v.id ? "bg-[#F0F6FF]" : ""
                    }`}
                  >
                    <div className="text-sm font-medium text-[#1E252F]">{v.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {v.count} facture{v.count > 1 ? "s" : ""} · {eur(v.total)}
                    </div>
                    {!v.email && (
                      <div className="text-[11px] text-[#B91C1C]">pas d'e-mail enregistré</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="space-y-4">
            <div className="flex justify-end">
              <DocLanguageSelect value={docLang} onChange={setDocLang} label="Langue du PDF" />
            </div>
            {/* Liste des factures du fournisseur */}
            <div className="border border-[#E2E8F0] rounded-xl bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Facture</th>
                    <th className="text-left px-3 py-2">Nature</th>
                    <th className="text-right px-3 py-2">TVAC</th>
                    <th className="text-left px-3 py-2">Envoi</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {vendorInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`border-t border-[#F1F5F9] ${current?.id === inv.id ? "bg-[#F0F6FF]" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setSelectedInvoice(inv.id)}
                          className="font-medium text-[#1C58D9] hover:underline"
                        >
                          {inv.invoice_number || inv.id.slice(0, 8)}
                        </button>
                        <div className="text-[11px] text-muted-foreground">
                          {inv.order?.order_number ? `Commande ${inv.order.order_number} · ` : ""}
                          {formatUpdatedAt(inv.issued_at || inv.created_at)}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <TypeBadge type={inv.type} />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{eur(inv.amount_incl_vat)}</td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">
                        {inv.sent_at ? `Envoyée ${formatUpdatedAt(inv.sent_at)}` : "Pas encore envoyée"}
                        {inv.sent_to ? <div>{inv.sent_to}</div> : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => download(inv)}
                            disabled={busy === inv.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#E2E8F0] text-[12px] font-medium hover:bg-[#F8FAFC] disabled:opacity-50"
                          >
                            {busy === inv.id ? (
                              <Loader2 className="animate-spin" size={13} />
                            ) : (
                              <Download size={13} />
                            )}
                            PDF
                          </button>
                          <button
                            onClick={() => sendByEmail(inv)}
                            disabled={busy === inv.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#1C58D9] text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
                          >
                            {busy === inv.id ? (
                              <Loader2 className="animate-spin" size={13} />
                            ) : (
                              <Send size={13} />
                            )}
                            Envoyer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Aperçu du document sélectionné */}
            {current && (
              <div className="border border-[#E2E8F0] rounded-xl bg-white p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1E252F]">
                      <FileText size={15} /> {vendorInvoiceKindLabel(current.type || "")} —{" "}
                      {current.invoice_number || current.id.slice(0, 8)}
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-1">
                      {current.vendor?.company_name || current.vendor?.name}
                      {current.vendor?.vat_number ? ` · TVA ${current.vendor.vat_number}` : ""}
                    </p>
                    <p className="text-[12px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Mail size={12} />
                      {current.vendor?.email || current.vendor?.contact_email || "aucun e-mail"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">HTVA {eur(current.amount_excl_vat)}</div>
                    <div className="text-[11px] text-muted-foreground">TVA {eur(current.vat_amount)}</div>
                    <div className="text-lg font-bold text-[#1E252F]">{eur(current.amount_incl_vat)}</div>
                  </div>
                </div>

                <EpcPaymentQr
                  amountEur={Number(current.amount_incl_vat) || 0}
                  reference={current.invoice_number || current.id.slice(0, 8)}
                />

                <p className="text-[11px] text-muted-foreground italic">
                  {current.type === "self_billing"
                    ? "Facture émise au nom et pour le compte du fournisseur, en vertu du mandat de facturation signé lors de son inscription. Le compte de paiement est celui de MediKong."
                    : "Facture de commission émise par Balooh SRL (MediKong), payable sur le compte MediKong avec la communication indiquée."}
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default AdminVendorInvoices;
