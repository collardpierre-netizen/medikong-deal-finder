import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "react-router-dom";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { formatPrice } from "@/data/mock";
import { useOrderDetail } from "@/hooks/useOrders";
import { ORDER_WORKFLOW_STEPS, getOrderStatusMeta, formatOrderDateTime } from "@/lib/order-status";
import { useVendorLabels } from "@/hooks/useVendorLabels";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function OrderDetailPage() {
  const { id } = useParams();
  const { data: order, isLoading } = useOrderDetail(id || "");

  const meta = getOrderStatusMeta(order?.status);
  const currentStep = meta.step; // -1 si hors workflow
  const items: any[] = (order as any)?.items || [];
  const subtotal = Number((order as any)?.subtotal_excl_vat || 0);
  const vat = Number((order as any)?.vat_amount || 0);
  const shipping = Number((order as any)?.shipping_cost || 0);
  const total = Number((order as any)?.total_incl_vat || 0);
  const shippingAddr: any = (order as any)?.shipping_address || {};

  const orderNumber = (order as any)?.order_number || id || "commande";

  const buildRows = () =>
    items.map((it: any) => {
      const qty = Number(it.quantity || 0);
      const unit = Number(it.unit_price_excl_vat || 0);
      // 🔒 Anonymisation : libellé public uniquement, jamais vendor_name brut.
      const vendorLabel = getVendorPublicName({ display_code: it.vendor_display_code });
      return {
        name: it.product_name || it.name || "—",
        ean: it.product_gtin || "",
        cnk: it.product_cnk || "",
        sku: it.product_sku || "",
        vendor: vendorLabel,
        qty,
        unit,
        total: unit * qty,
      };
    });

  const handleExportCSV = () => {
    const rows = buildRows();
    const header = ["Produit", "EAN", "CNK", "SKU", "Vendeur", "Quantité", "Prix unitaire HTVA (EUR)", "Montant HTVA (EUR)"];
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(";")];
    rows.forEach(r => lines.push([r.name, r.ean, r.cnk, r.sku, r.vendor, r.qty, r.unit.toFixed(2), r.total.toFixed(2)].map(escape).join(";")));
    lines.push("");
    lines.push(["", "", "", "", "", "", "Sous-total HTVA", subtotal.toFixed(2)].map(escape).join(";"));
    if (shipping > 0) lines.push(["", "", "", "", "", "", "Livraison", shipping.toFixed(2)].map(escape).join(";"));
    lines.push(["", "", "", "", "", "", "TVA", vat.toFixed(2)].map(escape).join(";"));
    lines.push(["", "", "", "", "", "", "Total TTC", total.toFixed(2)].map(escape).join(";"));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `commande-${orderNumber}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const rows = buildRows();
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Commande #${orderNumber}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Date : ${formatOrderDateTime((order as any)?.created_at) || "—"}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Produit", "EAN", "CNK", "SKU", "Vendeur", "Qté", "Prix HTVA", "Montant HTVA"]],
      body: rows.map(r => [r.name, r.ean, r.cnk, r.sku, r.vendor, r.qty, `${r.unit.toFixed(2)} EUR`, `${r.total.toFixed(2)} EUR`]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [28, 88, 217] },
      foot: [
        ["", "", "", "", "", "", "Sous-total HTVA", `${subtotal.toFixed(2)} EUR`],
        ...(shipping > 0 ? [["", "", "", "", "", "", "Livraison", `${shipping.toFixed(2)} EUR`]] : []),
        ["", "", "", "", "", "", "TVA", `${vat.toFixed(2)} EUR`],
        ["", "", "", "", "", "", "Total TTC", `${total.toFixed(2)} EUR`],
      ],
      footStyles: { fillColor: [245, 247, 250], textColor: 30, fontStyle: "bold" },
    });
    doc.save(`commande-${orderNumber}.pdf`);
  };

  return (
    <Layout>
      <div className="mk-container py-6 md:py-8">
        <div className="text-xs text-mk-sec mb-4">
          <Link to="/" className="hover:text-mk-blue">Accueil</Link> &gt;{" "}
          <Link to="/compte?tab=commandes" className="hover:text-mk-blue">Mon compte</Link> &gt; Commandes &gt; #{orderNumber}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-3">
          <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy">Commande #{orderNumber}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleExportCSV} disabled={!items.length} className="border border-mk-line text-sm px-3 py-2 rounded-md text-mk-sec flex items-center gap-1.5 disabled:opacity-50">
              <FileSpreadsheet size={14} /> Export CSV
            </button>
            <button onClick={handleExportPDF} disabled={!items.length} className="border border-mk-line text-sm px-3 py-2 rounded-md text-mk-sec flex items-center gap-1.5 disabled:opacity-50">
              <FileText size={14} /> Export PDF
            </button>
            <button className="border border-mk-line text-sm px-4 py-2 rounded-md text-mk-sec flex items-center gap-1.5">
              <Download size={14} /> Télécharger facture
            </button>
          </div>
        </div>

        {/* Date + statut */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-sm text-mk-sec">Passée le {formatOrderDateTime((order as any)?.created_at)}</span>
          <span className={`text-xs font-medium px-2.5 py-1 rounded ${meta.badgeClass}`}>{meta.label}</span>
          {(order as any)?.updated_at && (order as any).updated_at !== (order as any)?.created_at && (
            <span className="text-sm text-mk-sec">· Statut mis à jour le {formatOrderDateTime((order as any).updated_at)}</span>
          )}
        </div>

        {((order as any)?.tracking_url || (order as any)?.tracking_number || (order as any)?.tracking_carrier || (order as any)?.status === "delivered") && (
          <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-[11px] uppercase text-indigo-700 font-semibold">Suivi d'expédition</div>
              {(order as any)?.status === "delivered" && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Livrée</span>
              )}
            </div>
            {(order as any)?.delivered_at && (
              <div className="text-xs text-emerald-700 font-medium">Livrée le {formatOrderDateTime((order as any).delivered_at)}</div>
            )}
            {(order as any)?.shipped_at && !(order as any)?.delivered_at && (
              <div className="text-xs text-mk-sec">Expédiée le {formatOrderDateTime((order as any).shipped_at)}</div>
            )}
            {(order as any)?.tracking_carrier && (
              <div className="text-sm text-mk-navy mt-1"><strong>Transporteur :</strong> {(order as any).tracking_carrier}</div>
            )}
            {(order as any)?.tracking_number && (
              <div className="text-sm text-mk-navy"><strong>N° de colis :</strong> <span className="font-mono">{(order as any).tracking_number}</span></div>
            )}
            {(order as any)?.tracking_url && (
              <a href={(order as any).tracking_url} target="_blank" rel="noreferrer" className="inline-block mt-2 bg-mk-blue text-white text-sm font-semibold px-4 py-2 rounded">
                Suivre mon colis →
              </a>
            )}
          </div>
        )}


        {/* Timeline dynamique */}
        {currentStep >= 0 ? (
          <div className="bg-mk-alt rounded-lg p-4 md:p-6 mb-8 overflow-x-auto">
            <div className="flex items-center justify-between min-w-[520px]">
              {ORDER_WORKFLOW_STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2 md:gap-3">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs md:text-sm font-bold ${i <= currentStep ? "bg-mk-green text-white" : "bg-mk-line text-mk-sec"}`}>
                    {i + 1}
                  </div>
                  <span className={`text-xs md:text-sm ${i <= currentStep ? "font-bold text-mk-navy" : "text-mk-sec"}`}>{s.label}</span>
                  {i < ORDER_WORKFLOW_STEPS.length - 1 && (
                    <div className={`w-6 md:w-12 h-0.5 ${i < currentStep ? "bg-mk-green" : "bg-mk-line"}`} />
                  )}
                </div>
              ))}
            </div>
            {currentStep === 0 && (
              <p className="text-xs text-mk-sec mt-3">
                ⏳ Votre commande est confirmée et a été transmise au vendeur. En attente d'acceptation.
              </p>
            )}
          </div>
        ) : (
          <div className={`rounded-lg p-4 mb-8 ${meta.badgeClass}`}>
            <p className="text-sm font-medium">{meta.label}</p>
          </div>
        )}

        {/* Articles */}
        <div className="border border-mk-line rounded-lg overflow-x-auto mb-6">
          <div className="grid grid-cols-6 gap-3 px-4 py-2 bg-mk-alt text-xs font-semibold text-mk-sec min-w-[760px]">
            <span>Produit</span><span>Vendeur</span><span>Quantité</span><span>Prix/u HTVA</span><span>Montant HTVA</span><span>Statut / Suivi</span>
          </div>
          {isLoading ? (
            <div className="px-4 py-6 text-sm text-mk-sec">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-6 text-sm text-mk-sec">Aucun article</div>
          ) : items.map((it, idx) => {
            // 🔒 Anonymisation : libellé public uniquement, jamais it.vendor_name brut.
            const vLabel = getVendorPublicName({ display_code: it.vendor_display_code });
            const lineStatus = (it.fulfillment_status as string) || "pending";
            const lineStatusMeta: Record<string, { label: string; cls: string }> = {
              pending: { label: "En attente vendeur", cls: "bg-amber-100 text-amber-800" },
              processing: { label: "En préparation", cls: "bg-blue-100 text-blue-800" },
              forwarded: { label: "Transmis fournisseur", cls: "bg-blue-100 text-blue-800" },
              shipped: { label: "Expédié", cls: "bg-indigo-100 text-indigo-800" },
              delivered: { label: "Livré", cls: "bg-green-100 text-green-800" },
              cancelled: { label: "Annulé", cls: "bg-red-100 text-red-700" },
            };
            const meta = lineStatusMeta[lineStatus] || lineStatusMeta.pending;
            const qtyShipped = Number(it.quantity_shipped || 0);
            const isPartial = qtyShipped > 0 && qtyShipped < Number(it.quantity || 0) && lineStatus !== "delivered" && lineStatus !== "cancelled";
            return (
            <div key={it.id || idx} className="grid grid-cols-6 gap-3 px-4 py-3 border-t border-mk-line text-sm items-start min-w-[760px]">
              <div>
                <div className="font-medium text-mk-navy">{it.product_name || it.name || "—"}</div>
                <div className="text-[11px] text-mk-sec mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {it.product_gtin && <span>EAN: {it.product_gtin}</span>}
                  {it.product_cnk && <span>CNK: {it.product_cnk}</span>}
                  {it.product_sku && <span>SKU: {it.product_sku}</span>}
                </div>
              </div>
              {it.vendor_display_code ? (
                <a href={`/vendeur/${it.vendor_display_code}`} className="text-mk-primary hover:underline text-xs">
                  {vLabel}
                </a>
              ) : (
                <span className="text-mk-sec text-xs">{vLabel}</span>
              )}
              <span className="text-mk-sec">
                {it.quantity}
                {qtyShipped > 0 && (
                  <div className="text-[11px] text-mk-sec mt-0.5">Expédié : {qtyShipped}/{it.quantity}</div>
                )}
              </span>
              <span className="text-mk-sec">{formatPrice(Number(it.unit_price_excl_vat || 0))} EUR</span>
              <span className="font-bold text-mk-navy">{formatPrice(Number(it.unit_price_excl_vat || 0) * Number(it.quantity || 0))} EUR</span>
              <div className="flex flex-col gap-1">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded inline-block w-fit ${meta.cls}`}>{meta.label}</span>
                {isPartial && (
                  <span className="text-[10px] text-amber-700">Reliquat à venir</span>
                )}
                {it.tracking_number && (
                  it.tracking_url ? (
                    <a href={it.tracking_url} target="_blank" rel="noreferrer" className="text-[11px] text-mk-primary hover:underline">
                      Suivi : {it.tracking_number} →
                    </a>
                  ) : (
                    <span className="text-[11px] text-mk-sec">Suivi : {it.tracking_number}</span>
                  )
                )}
                {it.cancellation_reason && (
                  <span className="text-[10px] text-red-700">Motif : {it.cancellation_reason}</span>
                )}
              </div>
            </div>
          );})}
          <div className="border-t border-mk-line bg-mk-alt px-4 py-3 text-sm space-y-1 min-w-[760px]">
            <div className="flex justify-between"><span className="text-mk-sec">Sous-total HTVA</span><span className="text-mk-navy">{formatPrice(subtotal)} EUR</span></div>
            {shipping > 0 && <div className="flex justify-between"><span className="text-mk-sec">Livraison</span><span className="text-mk-navy">{formatPrice(shipping)} EUR</span></div>}
            <div className="flex justify-between"><span className="text-mk-sec">TVA</span><span className="text-mk-navy">{formatPrice(vat)} EUR</span></div>
            <div className="flex justify-between pt-1 border-t border-mk-line"><span className="font-bold text-mk-navy">Total TTC</span><span className="font-bold text-mk-navy">{formatPrice(total)} EUR</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="border border-mk-line rounded-lg p-5">
            <p className="text-xs text-mk-sec mb-1">Adresse de livraison</p>
            <p className="text-sm text-mk-navy">
              {shippingAddr.line1 || "—"}
              {shippingAddr.postal_code || shippingAddr.city ? <><br />{shippingAddr.postal_code} {shippingAddr.city}</> : null}
              {shippingAddr.country ? <><br />{shippingAddr.country}</> : null}
            </p>
          </div>
          <div className="border border-mk-line rounded-lg p-5">
            <p className="text-xs text-mk-sec mb-1">Paiement</p>
            <p className="text-sm text-mk-navy capitalize">{(order as any)?.payment_method || "—"}</p>
            <p className="text-sm font-bold text-mk-navy mt-1">{formatPrice(total)} EUR</p>
          </div>
        </div>

        <button className="border border-mk-red text-mk-red text-sm px-4 py-2 rounded-md">Signaler un problème</button>
      </div>
    </Layout>
  );
}
