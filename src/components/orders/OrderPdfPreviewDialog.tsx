import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, X } from "lucide-react";
import { fmtEur } from "@/lib/format-currency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PreviewLine = {
  quantity?: number | string | null;
  line_total_excl_vat?: number | string | null;
  unit_price_excl_vat?: number | string | null;
  vat_rate?: number | string | null;
  manual_label?: string | null;
  product_id?: string | null;
  products?: { name?: string | null; cnk_code?: string | null; gtin?: string | null } | null;
  cnk_code?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string;
  orderNumber: string;
  status: string;
  lines: PreviewLine[];
};

export default function OrderPdfPreviewDialog({ open, onOpenChange, orderId, orderNumber, status, lines }: Props) {
  const [downloading, setDownloading] = useState(false);
  const isDraft = status === "draft";

  const { rows, totals } = useMemo(() => {
    const map = new Map<string, { name: string; cnk: string | null; qty: number; ht: number; ttc: number }>();
    let sumHt = 0, sumTtc = 0, sumQty = 0;
    for (const l of lines || []) {
      const qty = Number(l.quantity) || 0;
      const ht = Number(l.line_total_excl_vat) || (Number(l.unit_price_excl_vat) || 0) * qty;
      const vat = Number(l.vat_rate);
      const rate = Number.isFinite(vat) && vat > 0 ? vat : 0.21;
      const ttc = ht * (1 + rate);
      const cnk = l.products?.cnk_code || (l as any).cnk_code || null;
      const name = l.manual_label || l.products?.name || "—";
      const key = l.product_id || cnk || `${name}::${l.products?.gtin || ""}`;
      const ex = map.get(key);
      if (ex) { ex.qty += qty; ex.ht += ht; ex.ttc += ttc; }
      else map.set(key, { name, cnk, qty, ht, ttc });
      sumHt += ht; sumTtc += ttc; sumQty += qty;
    }
    const sorted = Array.from(map.values()).sort((a, b) => b.ht - a.ht);
    return { rows: sorted, totals: { ht: sumHt, tva: Math.max(0, sumTtc - sumHt), ttc: sumTtc, qty: sumQty, uniques: sorted.length } };
  }, [lines]);

  const download = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-order-pdf", { body: { order_id: orderId } });
      if (error) throw error;
      const url = (data as any)?.pdf_url;
      if (url) window.open(url, "_blank");
      toast.success("PDF généré");
    } catch (err: any) {
      toast.error(err?.message || "Échec génération PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b" style={{ borderColor: "#E2E8F0", backgroundColor: "#1C58D9" }}>
          <DialogTitle className="text-white text-sm font-semibold">
            Aperçu PDF · Commande {orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-white max-h-[70vh] overflow-y-auto">
          {isDraft && (
            <>
              {/* Filigrane diagonal */}
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
                aria-hidden
              >
                <div
                  style={{
                    transform: "rotate(-30deg)",
                    fontSize: 96,
                    fontWeight: 900,
                    letterSpacing: 8,
                    color: "#1E252F",
                    opacity: 0.08,
                  }}
                >
                  BROUILLON
                </div>
              </div>
              {/* Pastille BROUILLON */}
              <div className="sticky top-0 z-10 flex justify-end px-5 pt-3">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-white shadow"
                  style={{ backgroundColor: "#DC2626" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  Brouillon
                </span>
              </div>
              {/* Bandeau bas de page */}
              <div className="sticky bottom-0 z-10 mx-5 my-2 rounded border text-center text-[10px] font-semibold uppercase tracking-wide py-1.5"
                style={{ backgroundColor: "#FEF2F2", borderColor: "#FCA5A5", color: "#B91C1C" }}
              >
                Document provisoire — Brouillon non confirmé
              </div>
            </>
          )}

          <div className="relative p-5 space-y-4">
            <div>
              <div className="text-[11px] uppercase font-semibold tracking-wide text-slate-500 mb-2">
                Synthèse des produits (agrégé)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Kpi label="Produits uniques" value={String(totals.uniques)} color="#1C58D9" bg="#EFF6FF" />
                <Kpi label="Quantité totale" value={String(totals.qty)} color="#15803D" bg="#F0FDF4" />
                <Kpi label="Total HTVA" value={`${fmtEur(totals.ht)} €`} color="#B45309" bg="#FEF3C7" />
                <Kpi label="Total TVA" value={`${fmtEur(totals.tva)} €`} color="#6D28D9" bg="#F5F3FF" />
                <Kpi label="Total TTC" value={`${fmtEur(totals.ttc)} €`} color="#1E252F" bg="#F1F5F9" />
              </div>
            </div>

            <div className="border rounded overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
              <table className="w-full text-[12px]">
                <thead style={{ backgroundColor: "#F8FAFC" }}>
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] uppercase font-semibold text-slate-500 w-8">#</th>
                    <th className="text-left px-3 py-2 text-[10px] uppercase font-semibold text-slate-500">CNK</th>
                    <th className="text-left px-3 py-2 text-[10px] uppercase font-semibold text-slate-500">Produit</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase font-semibold text-slate-500">Qté</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase font-semibold text-slate-500">HTVA</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase font-semibold text-slate-500">TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Aucune ligne</td></tr>
                  )}
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: "#F1F5F9" }}>
                      <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-600">{r.cnk || "—"}</td>
                      <td className="px-3 py-1.5">{r.name}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{r.qty}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtEur(r.ht)} €</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtEur(r.ttc)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-slate-400 italic">
              Aperçu à l'écran du récap qui sera intégré dans le PDF. La mise en page finale peut légèrement varier.
            </p>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-slate-50 flex-row justify-end gap-2" style={{ borderColor: "#E2E8F0" }}>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X size={14} className="mr-1" /> Fermer
          </Button>
          <Button size="sm" onClick={download} disabled={downloading} style={{ backgroundColor: "#1C58D9" }}>
            <FileDown size={14} className="mr-1" />
            {downloading ? "Génération…" : "Télécharger le PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div className="rounded border flex items-stretch overflow-hidden" style={{ borderColor: "#E2E8F0", backgroundColor: bg }}>
      <div style={{ width: 3, backgroundColor: color }} />
      <div className="flex-1 px-2 py-1.5 text-center">
        <div className="text-[13px] font-bold leading-tight" style={{ color }}>{value}</div>
        <div className="text-[9px] uppercase tracking-wide text-slate-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
}
