import { useState, useCallback } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Receipt, CheckCircle2, AlertTriangle, Send, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface SendcloudLine {
  parcel_id?: string;
  tracking_number?: string;
  cost?: number;
  carrier?: string;
  date?: string;
}

interface VendorInvoiceDraft {
  vendor_id: string;
  vendor_name: string;
  shipment_count: number;
  base_cost: number;
  margin_pct: number;
  margin_amount: number;
  total: number;
  lines: SendcloudLine[];
}

const AdminReconciliation = () => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [drafts, setDrafts] = useState<VendorInvoiceDraft[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  // Get whitelabel vendors with their shipments
  const { data: vendors = [] } = useQuery({
    queryKey: ["reconciliation-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, company_name, name, shipping_mode, whitelabel_margin_percentage")
        .eq("shipping_mode", "medikong_whitelabel")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["reconciliation-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_invoices")
        .select("*, vendors(company_name, name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (rows.length === 0) { toast.error("Fichier vide"); setUploading(false); return; }

      // Parse sendcloud lines — detect column names flexibly
      const parsed: SendcloudLine[] = rows.map(r => {
        const parcelId = r["parcel_id"] || r["Parcel ID"] || r["ID"] || "";
        const tracking = r["tracking_number"] || r["Tracking"] || r["tracking"] || "";
        const cost = parseFloat(String(r["cost"] || r["Cost"] || r["price"] || r["Price"] || r["amount"] || "0").replace(",", ".")) || 0;
        const carrier = r["carrier"] || r["Carrier"] || "";
        const date = r["date"] || r["Date"] || r["created"] || "";
        return { parcel_id: String(parcelId), tracking_number: String(tracking), cost, carrier: String(carrier), date: String(date) };
      });

      // Match each line to a shipment via parcel_id or tracking_number
      const { data: shipments } = await supabase
        .from("shipments")
        .select("id, vendor_id, sendcloud_parcel_id, tracking_number, base_cost_cents, margin_cents")
        .in("sendcloud_parcel_id", parsed.map(p => p.parcel_id).filter(Boolean));

      const shipmentMap = new Map<string, any>();
      (shipments || []).forEach(s => {
        if (s.sendcloud_parcel_id) shipmentMap.set(String(s.sendcloud_parcel_id), s);
      });

      // Also try matching by tracking_number for lines not matched
      const unmatchedTracking = parsed.filter(p => !shipmentMap.has(p.parcel_id || "")).map(p => p.tracking_number).filter(Boolean);
      if (unmatchedTracking.length > 0) {
        const { data: trackingMatches } = await supabase
          .from("shipments")
          .select("id, vendor_id, sendcloud_parcel_id, tracking_number, base_cost_cents, margin_cents")
          .in("tracking_number", unmatchedTracking);
        (trackingMatches || []).forEach(s => {
          if (s.tracking_number) shipmentMap.set(s.tracking_number, s);
        });
      }

      // Group by vendor
      const vendorMap = new Map<string, { lines: SendcloudLine[]; baseCost: number }>();
      for (const line of parsed) {
        const matched = shipmentMap.get(line.parcel_id || "") || shipmentMap.get(line.tracking_number || "");
        if (!matched) continue;
        const vendorId = matched.vendor_id;
        if (!vendorMap.has(vendorId)) vendorMap.set(vendorId, { lines: [], baseCost: 0 });
        const entry = vendorMap.get(vendorId)!;
        entry.lines.push(line);
        entry.baseCost += line.cost || 0;
      }

      // Build drafts
      const vendorLookup = new Map(vendors.map(v => [v.id, v]));
      const newDrafts: VendorInvoiceDraft[] = [];
      for (const [vendorId, data] of vendorMap.entries()) {
        const v = vendorLookup.get(vendorId);
        const marginPct = v?.whitelabel_margin_percentage ?? 15;
        const marginAmount = data.baseCost * (marginPct / 100);
        newDrafts.push({
          vendor_id: vendorId,
          vendor_name: v?.company_name || v?.name || vendorId,
          shipment_count: data.lines.length,
          base_cost: Math.round(data.baseCost * 100) / 100,
          margin_pct: marginPct,
          margin_amount: Math.round(marginAmount * 100) / 100,
          total: Math.round((data.baseCost + marginAmount) * 100) / 100,
          lines: data.lines,
        });
      }

      if (newDrafts.length === 0) {
        toast.warning("Aucune correspondance trouvée entre le fichier et les expéditions.");
      } else {
        toast.success(`${newDrafts.length} vendeur(s) identifié(s), ${parsed.length} lignes traitées`);
      }

      setDrafts(newDrafts);
    } catch (err: any) {
      toast.error(err.message || "Erreur de traitement du fichier");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [vendors]);

  const sendInvoice = async (draft: VendorInvoiceDraft) => {
    setSending(draft.vendor_id);
    try {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const { error } = await supabase.from("vendor_invoices").insert({
        vendor_id: draft.vendor_id,
        period,
        base_cost_cents: Math.round(draft.base_cost * 100),
        margin_cents: Math.round(draft.margin_amount * 100),
        total_cents: Math.round(draft.total * 100),
        status: "sent",
        shipment_count: draft.shipment_count,
      });
      if (error) throw error;
      toast.success(`Facture envoyée à ${draft.vendor_name}`);
      setDrafts(prev => prev.filter(d => d.vendor_id !== draft.vendor_id));
      queryClient.invalidateQueries({ queryKey: ["reconciliation-invoices"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(null);
    }
  };

  const totalBase = drafts.reduce((s, d) => s + d.base_cost, 0);
  const totalMargin = drafts.reduce((s, d) => s + d.margin_amount, 0);
  const totalInvoiced = drafts.reduce((s, d) => s + d.total, 0);
  const fmt = (n: number) => `€${n.toLocaleString("fr-BE", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <AdminTopBar title="Réconciliation" subtitle="Rapprochement des factures Sendcloud pour les vendeurs whitelabel" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Receipt} label="Vendeurs whitelabel" value={String(vendors.length)} />
        <KpiCard icon={FileText} label="Factures envoyées" value={String(invoices.filter((i: any) => i.status === "sent" || i.status === "paid").length)} iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={AlertTriangle} label="En attente" value={String(invoices.filter((i: any) => i.status === "draft").length)} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={Receipt} label="Marge totale" value={fmt(invoices.reduce((s: number, i: any) => s + (i.margin_cents || 0) / 100, 0))} iconColor="#7C3AED" iconBg="#F5F3FF" />
      </div>

      {/* Upload */}
      <div className="bg-white rounded-lg border p-6 mb-6" style={{ borderColor: "#E2E8F0" }}>
        <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}>
          <Upload size={16} /> Importer la facture Sendcloud mensuelle
        </h3>
        <p className="text-[12px] mb-4" style={{ color: "#8B95A5" }}>
          Uploadez le fichier CSV ou XLSX exporté depuis Sendcloud. Le système matchera automatiquement chaque ligne à une expédition via le parcel_id.
        </p>
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-bold text-white cursor-pointer transition-opacity hover:opacity-90" style={{ backgroundColor: "#1B5BDA" }}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "Traitement…" : "Sélectionner un fichier"}
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {/* Drafts */}
      {drafts.length > 0 && (
        <div className="bg-white rounded-lg border mb-6 overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>
              Brouillons de factures ({drafts.length})
            </h3>
            <div className="flex gap-4 text-[12px]" style={{ color: "#616B7C" }}>
              <span>Base: <strong>{fmt(totalBase)}</strong></span>
              <span>Marge: <strong style={{ color: "#059669" }}>{fmt(totalMargin)}</strong></span>
              <span>Total: <strong>{fmt(totalInvoiced)}</strong></span>
            </div>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Vendeur", "Expéditions", "Coût de base", "Marge %", "Montant marge", "Total facturé", "Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drafts.map(d => (
                <tr key={d.vendor_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "#1D2530" }}>{d.vendor_name}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{d.shipment_count}</td>
                  <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#1D2530" }}>{fmt(d.base_cost)}</td>
                  <td className="px-4 py-3 text-[12px] font-semibold" style={{ color: "#7C3AED" }}>{d.margin_pct}%</td>
                  <td className="px-4 py-3 text-[12px] font-mono font-semibold" style={{ color: "#059669" }}>{fmt(d.margin_amount)}</td>
                  <td className="px-4 py-3 text-[12px] font-mono font-bold" style={{ color: "#1D2530" }}>{fmt(d.total)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => sendInvoice(d)}
                      disabled={sending === d.vendor_id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: "#059669" }}
                    >
                      {sending === d.vendor_id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      Envoyer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice history */}
      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
          <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Historique des factures</h3>
        </div>
        {invoices.length === 0 ? (
          <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune facture générée</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Vendeur", "Période", "Base", "Marge", "Total", "Statut", "Date"].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => {
                const vendor = inv.vendors as any;
                return (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td className="px-4 py-3 text-[12px] font-medium" style={{ color: "#1D2530" }}>
                      {vendor?.company_name || vendor?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#616B7C" }}>{inv.period}</td>
                    <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#1D2530" }}>{fmt((inv.base_cost_cents || 0) / 100)}</td>
                    <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#059669" }}>{fmt((inv.margin_cents || 0) / 100)}</td>
                    <td className="px-4 py-3 text-[12px] font-mono font-bold" style={{ color: "#1D2530" }}>{fmt((inv.total_cents || 0) / 100)}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3 text-[11px]" style={{ color: "#8B95A5" }}>
                      {new Date(inv.created_at).toLocaleDateString("fr-BE")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminReconciliation;
