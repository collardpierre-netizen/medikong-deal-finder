import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fmtEur } from "@/lib/format-currency";
import { ArrowLeft, FileDown, Pencil, Copy, Link2, ExternalLink, Lock, Wallet } from "lucide-react";
import { lineMetrics, type ManualLineInput } from "@/lib/manual-order-metrics";
import { VendorsEmbedError } from "@/lib/vendors-embed-error";

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  confirmed: "Confirmée",
  processing: "En traitement",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};

const AdminCommandeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState<string>("");
  const [expiresInput, setExpiresInput] = useState<string>("");

  const { data: order, isLoading, error: orderError } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customer:customers(*), order_lines(*, products(name, gtin, cnk_code), vendors(company_name, name, vat_number, bank_name, iban, bic))")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;

      const persisted = (data as any)?.order_lines || [];
      const draftPayload = (data as any)?.draft_payload as any;
      const draftLines = Array.isArray(draftPayload?.lines) ? draftPayload.lines : [];

      if (persisted.length === 0 && draftLines.length > 0) {
        const productIds = Array.from(new Set(draftLines.map((l: any) => l.product_id).filter(Boolean))) as string[];
        const vendorIds = Array.from(new Set(draftLines.map((l: any) => l.vendor_id).filter(Boolean))) as string[];
        const [{ data: prods }, { data: vends }] = await Promise.all([
          productIds.length ? supabase.from("products").select("id, name, gtin, cnk_code").in("id", productIds) : Promise.resolve({ data: [] as any[] }),
          vendorIds.length ? supabase.from("vendors").select("id, name, company_name, vat_number, bank_name, iban, bic").in("id", vendorIds) : Promise.resolve({ data: [] as any[] }),
        ]);
        const productMap = new Map((prods || []).map((p: any) => [p.id, p]));
        const vendorMap = new Map((vends || []).map((v: any) => [v.id, v]));
        const hydrated = draftLines.map((l: any, i: number) => {
          const qty = Number(l.quantity) || 0;
          const unit = Number(l.unit_price_excl_vat) || 0;
          const vat = Number(l.vat_rate) || 0;
          const totalHt = qty * unit;
          return {
            id: l.id || `draft-${i}`,
            quantity: qty,
            unit_price_excl_vat: unit,
            vat_rate: vat,
            line_total_excl_vat: totalHt,
            manual_label: l.manual_label || l.offer_label,
            unit_cost_excl_vat: l.unit_cost_excl_vat ?? null,
            commission_rate: l.commission_rate ?? null,
            commission_amount: l.commission_amount ?? null,
            commission_basis: l.commission_basis ?? null,
            products: productMap.get(l.product_id) || (l.gtin || l.cnk_code ? { name: l.manual_label || l.offer_label, gtin: l.gtin, cnk_code: l.cnk_code } : null),
            vendors: vendorMap.get(l.vendor_id) || null,
          };
        });
        const subtotal = hydrated.reduce((a: number, l: any) => a + l.line_total_excl_vat, 0);
        const vat = hydrated.reduce((a: number, l: any) => a + (l.line_total_excl_vat * (l.vat_rate || 0)) / 100, 0);
        return {
          ...(data as any),
          order_lines: hydrated,
          subtotal_excl_vat: subtotal,
          vat_amount: vat,
          total_incl_vat: subtotal + vat,
          _hydrated_from_draft: true,
        };
      }

      // Merge commission/cost info from draft_payload onto persisted lines (by product+vendor)
      if (persisted.length > 0 && draftLines.length > 0) {
        const draftIdx = new Map<string, any>();
        for (const dl of draftLines) {
          const key = `${dl.product_id || ""}|${dl.vendor_id || ""}|${dl.unit_price_excl_vat ?? ""}`;
          if (!draftIdx.has(key)) draftIdx.set(key, dl);
        }
        for (const pl of persisted) {
          const key = `${pl.product_id || ""}|${pl.vendor_id || ""}|${pl.unit_price_excl_vat ?? ""}`;
          const dl = draftIdx.get(key);
          if (dl) {
            (pl as any).unit_cost_excl_vat = (pl as any).unit_cost_excl_vat ?? dl.unit_cost_excl_vat ?? null;
            (pl as any).commission_rate = (pl as any).commission_rate ?? dl.commission_rate ?? null;
            (pl as any).commission_amount = (pl as any).commission_amount ?? dl.commission_amount ?? null;
            (pl as any).commission_basis = (pl as any).commission_basis ?? dl.commission_basis ?? null;
          }
        }
      }

      return data as any;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (order) {
      setPinInput((order as any).public_access_pin || "");
      const exp = (order as any).public_access_expires_at;
      setExpiresInput(exp ? new Date(exp).toISOString().slice(0, 10) : "");
    }
  }, [order]);

  if (isLoading) return <div className="p-6 text-slate-500">Chargement…</div>;
  if (!order) return <div className="p-6 text-slate-500">Commande introuvable. <Link to="/admin/commandes" className="text-sky-600">Retour</Link></div>;




  const lines = order.order_lines || [];
  // Vendor bank info (take first line vendor with bank info)
  const vendorWithBank = lines.map((l: any) => l.vendors).find((v: any) => v && (v.iban || v.bank_name));

  const publicUrl = order.public_token ? `${window.location.origin}/commande/lien/${order.public_token}` : null;

  const generatePdf = async () => {
    setBusy("PDF");
    try {
      // Génère le token public en même temps que le PDF (idempotent)
      await supabase.rpc("admin_ensure_order_public_token" as any, { _order_id: id });
      const { data, error } = await supabase.functions.invoke("generate-order-pdf", { body: { order_id: id } });
      if (error) throw error;
      const url = (data as any)?.pdf_url;
      if (url) {
        setPdfUrl(url);
        window.open(url, "_blank");
        toast.success("PDF généré");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e: any) {
      toast.error(e?.message || "Échec génération PDF");
    } finally {
      setBusy(null);
    }
  };

  const generatePayoutPdf = async () => {
    setBusy("PAYOUT");
    try {
      const { data, error } = await supabase.functions.invoke("generate-vendor-payout-pdf", { body: { order_id: id } });
      if (error) throw error;
      const url = (data as any)?.pdf_url;
      if (url) {
        window.open(url, "_blank");
        toast.success(`Décompte fournisseur généré (${(data as any)?.vendors || 1} vendeur·s)`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Échec génération décompte");
    } finally {
      setBusy(null);
    }
  };

  const ensurePublicLink = async () => {
    setBusy("LINK");
    try {
      const { data, error } = await supabase.rpc("admin_ensure_order_public_token" as any, { _order_id: id });
      if (error) throw error;
      const token = data as unknown as string;
      const url = `${window.location.origin}/commande/lien/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Lien public copié");
      await queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e: any) {
      toast.error(e?.message || "Échec génération du lien");
    } finally {
      setBusy(null);
    }
  };

  const copyPdfLink = () => {
    if (!pdfUrl) return;
    navigator.clipboard.writeText(pdfUrl);
    toast.success("Lien PDF copié (valable 7 jours)");
  };

  const savePublicAccess = async () => {
    setBusy("ACCESS");
    try {
      const pin = pinInput.trim();
      if (pin && !/^[0-9]{4,8}$/.test(pin)) {
        toast.error("Le PIN doit faire 4 à 8 chiffres");
        setBusy(null);
        return;
      }
      const expiresAt = expiresInput ? new Date(expiresInput + "T23:59:59").toISOString() : null;
      const { error } = await supabase.rpc("admin_set_order_public_access" as any, {
        _order_id: id,
        _pin: pin || null,
        _expires_at: expiresAt,
      });
      if (error) throw error;
      toast.success("Protection mise à jour");
      await queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e: any) {
      toast.error(e?.message || "Échec");
    } finally {
      setBusy(null);
    }
  };


  return (
    <div>
      <AdminTopBar title={`Commande ${order.order_number}`} subtitle={`Statut : ${STATUS_LABEL[order.status] ?? order.status}`} />

      <div className="mb-4">
        <Link to="/admin/commandes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft size={14} /> Retour aux commandes
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border rounded-lg p-4" style={{ borderColor: "#E2E8F0" }}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[11px] uppercase text-slate-400 font-semibold mb-1">Acheteur</div>
                <div className="font-medium">{order.customer?.company_name || "—"}</div>
                <div className="text-xs text-slate-500">{order.customer?.email}</div>
                {order.customer?.vat_number && <div className="text-xs text-slate-500">TVA : {order.customer.vat_number}</div>}
              </div>
              <div>
                <div className="text-[11px] uppercase text-slate-400 font-semibold mb-1">Paiement</div>
                <div className="font-medium">{order.payment_method ?? "—"}</div>
                <div className="text-xs text-slate-500">Statut paiement : {order.payment_status ?? "—"}</div>
                {order.payment_due_date && <div className="text-xs text-slate-500">Échéance : {new Date(order.payment_due_date).toLocaleDateString("fr-BE")}</div>}
              </div>
            </div>
            {(order as any).fulfillment_mode && (
              <div className="mb-3 p-3 rounded border bg-slate-50" style={{ borderColor: "#E2E8F0" }}>
                <div className="text-[11px] uppercase text-slate-400 font-semibold mb-1">Mode logistique</div>
                <div className="font-medium text-sm">
                  {(order as any).fulfillment_mode === "pickup" ? "🏬 Picking — retrait sur place" : "📦 Livraison"}
                </div>
                {(order as any).fulfillment_mode === "delivery" && (order as any).shipping_address && (
                  <div className="mt-2 text-xs text-slate-600 leading-snug">
                    {(order as any).shipping_address.label && <div className="font-medium text-slate-800">{(order as any).shipping_address.label}</div>}
                    {(order as any).shipping_address.address_l1 && <div>{(order as any).shipping_address.address_l1}</div>}
                    {(order as any).shipping_address.address_l2 && <div>{(order as any).shipping_address.address_l2}</div>}
                    <div>
                      {(order as any).shipping_address.postal_code} {(order as any).shipping_address.city}
                      {(order as any).shipping_address.country_code ? ` (${(order as any).shipping_address.country_code})` : ""}
                    </div>
                  </div>
                )}
              </div>
            )}
            {order.notes && (
              <div className="bg-blue-50/60 border-l-2 border-blue-400 px-3 py-2 rounded text-sm italic text-slate-700">{order.notes}</div>
            )}
          </div>


          <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "#F8FAFC" }}>
                <tr>
                  <th className="text-left px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Article</th>
                  <th className="text-left px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Fournisseur</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Qté</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">PU HT</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">TVA</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">PU TTC</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any) => {
                  const puHt = Number(l.unit_price_excl_vat) || 0;
                  const vatR = Number(l.vat_rate ?? 0);
                  const puTtc = puHt * (1 + vatR / 100);
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-2">
                        <div>{l.manual_label || l.products?.name || "—"}</div>
                        {(l.products?.cnk_code || l.products?.gtin) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {l.products?.cnk_code && (
                              <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">CNK {l.products.cnk_code}</span>
                            )}
                            {l.products?.gtin && (
                              <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">EAN {l.products.gtin}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{l.vendors?.company_name || l.vendors?.name || l.qogita_seller_fid || "—"}</td>
                      <td className="px-3 py-2 text-right">{l.quantity}</td>
                      <td className="px-3 py-2 text-right">{fmtEur(puHt)} €</td>
                      <td className="px-3 py-2 text-right">{vatR.toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right text-slate-600">{fmtEur(puTtc)} €</td>
                      <td className="px-3 py-2 text-right font-medium">{fmtEur(Number(l.line_total_excl_vat) || 0)} €</td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400 text-sm">Aucune ligne</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t bg-slate-50/40">
                  <td colSpan={6} className="px-3 py-2 text-right text-slate-500">Total HT</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtEur(Number(order.subtotal_excl_vat) || 0)} €</td>
                </tr>
                <tr className="bg-slate-50/40">
                  <td colSpan={6} className="px-3 py-2 text-right text-slate-500">TVA</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtEur(Number(order.vat_amount) || 0)} €</td>
                </tr>
                <tr className="border-t" style={{ backgroundColor: "#1C58D9" }}>
                  <td colSpan={6} className="px-3 py-3 text-right text-white font-semibold">Total TTC</td>
                  <td className="px-3 py-3 text-right text-white font-bold text-base">{fmtEur(Number(order.total_incl_vat) || 0)} €</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Détail Net Vendeur — ce que chaque fournisseur va toucher */}
          {(() => {
            const groups = new Map<string, { vendor: any; lines: any[]; ca: number; commission: number; net: number; cost: number; hasCost: boolean; margin: number }>();
            for (const l of lines) {
              const vid = l.vendors?.id || l.vendor_id || "__unknown__";
              const m = lineMetrics({
                quantity: l.quantity,
                unit_price_excl_vat: l.unit_price_excl_vat,
                vat_rate: l.vat_rate,
                unit_cost_excl_vat: l.unit_cost_excl_vat,
                commission_rate: l.commission_rate,
                commission_amount: l.commission_amount,
                commission_basis: l.commission_basis,
              } as ManualLineInput);
              const g = groups.get(vid) || { vendor: l.vendors, lines: [], ca: 0, commission: 0, net: 0, cost: 0, hasCost: false, margin: 0 };
              g.lines.push({ ...l, _m: m });
              g.ca += m.ca;
              g.commission += m.commission;
              g.net += m.netVendor;
              if (m.hasCost) { g.hasCost = true; g.cost += m.cost; g.margin += m.netMargin; }
              groups.set(vid, g);
            }
            if (groups.size === 0) return null;
            const totalNet = Array.from(groups.values()).reduce((s, g) => s + g.net, 0);
            const totalCom = Array.from(groups.values()).reduce((s, g) => s + g.commission, 0);
            return (
              <div className="bg-white border rounded-lg p-4" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-emerald-600" />
                    <div className="text-sm font-semibold">Détail net vendeur</div>
                  </div>
                  <div className="text-[11px] text-slate-500">À reverser : <span className="font-mono font-semibold text-emerald-700">{fmtEur(totalNet)} €</span> · Commission MediKong : <span className="font-mono text-slate-700">{fmtEur(totalCom)} €</span></div>
                </div>
                <div className="space-y-3">
                  {Array.from(groups.entries()).map(([vid, g]) => {
                    const pct = g.ca > 0 ? (g.commission / g.ca) * 100 : 0;
                    return (
                      <div key={vid} className="border rounded p-3" style={{ borderColor: "#E2E8F0" }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">{g.vendor?.company_name || g.vendor?.name || "Fournisseur"}</div>
                          <div className="text-xs text-slate-500">{g.lines.length} ligne{g.lines.length > 1 ? "s" : ""}</div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div><div className="text-slate-500">CA HT</div><div className="font-mono font-semibold">{fmtEur(g.ca)} €</div></div>
                          <div><div className="text-slate-500">Commission MK</div><div className="font-mono text-slate-700">{fmtEur(g.commission)} € <span className="text-[10px] text-slate-400">({pct.toFixed(1)}%)</span></div></div>
                          {g.hasCost ? (
                            <>
                              <div><div className="text-slate-500">Coût HT</div><div className="font-mono text-slate-600">{fmtEur(g.cost)} €</div></div>
                              <div><div className="text-slate-500">Marge nette vendeur</div><div className="font-mono text-emerald-700">{fmtEur(g.margin)} €</div></div>
                            </>
                          ) : (
                            <div className="col-span-2 text-[11px] text-slate-400 italic self-end">Coût d'achat non renseigné</div>
                          )}
                        </div>
                        <div className="mt-2 pt-2 border-t flex items-center justify-between" style={{ borderColor: "#F1F5F9" }}>
                          <div className="text-xs text-slate-500">Net à reverser au vendeur (HT)</div>
                          <div className="font-mono font-bold text-emerald-700">{fmtEur(g.net)} €</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}



          {vendorWithBank && (
            <div className="bg-white border rounded-lg p-4" style={{ borderColor: "#E2E8F0" }}>
              <div className="text-[11px] uppercase text-slate-400 font-semibold mb-2">Informations de paiement — {vendorWithBank.company_name || vendorWithBank.name}</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {vendorWithBank.bank_name && (
                  <div><div className="text-xs text-slate-500">Banque</div><div className="font-medium">{vendorWithBank.bank_name}</div></div>
                )}
                {vendorWithBank.iban && (
                  <div className="col-span-2"><div className="text-xs text-slate-500">IBAN</div><div className="font-medium tracking-wide">{vendorWithBank.iban}</div></div>
                )}
                {vendorWithBank.bic && (
                  <div><div className="text-xs text-slate-500">BIC</div><div className="font-medium">{vendorWithBank.bic}</div></div>
                )}
                {vendorWithBank.vat_number && (
                  <div className="col-span-2"><div className="text-xs text-slate-500">TVA fournisseur</div><div className="font-medium">{vendorWithBank.vat_number}</div></div>
                )}
              </div>
              <div className="mt-3 text-xs text-slate-500">Communication : <span className="font-mono">{order.order_number}</span></div>
            </div>
          )}
        </div>


        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4 space-y-2" style={{ borderColor: "#E2E8F0" }}>
            <div className="text-sm font-semibold mb-2">Actions</div>
            <Button onClick={generatePdf} disabled={busy !== null} className="w-full justify-start" style={{ backgroundColor: "#1C58D9", color: "#fff" }}>
              <FileDown size={14} className="mr-2" /> {busy === "PDF" ? "Génération…" : "Générer le bon de commande PDF"}
            </Button>
            <Button onClick={generatePayoutPdf} disabled={busy !== null} className="w-full justify-start" style={{ backgroundColor: "#10B981", color: "#fff" }}>
              <Wallet size={14} className="mr-2" /> {busy === "PAYOUT" ? "Génération…" : "Décompte fournisseur PDF"}
            </Button>
            {pdfUrl && (
              <Button onClick={copyPdfLink} className="w-full justify-start" variant="outline">
                <Copy size={14} className="mr-2" /> Copier le lien PDF (7 jours)
              </Button>
            )}
            <Button onClick={ensurePublicLink} disabled={busy !== null} className="w-full justify-start" variant="outline">
              <Link2 size={14} className="mr-2" /> {busy === "LINK" ? "…" : (publicUrl ? "Copier le lien public" : "Générer le lien public")}
            </Button>
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noreferrer" className="block">
                <Button className="w-full justify-start" variant="ghost">
                  <ExternalLink size={14} className="mr-2" /> Ouvrir la page publique
                </Button>
              </a>
            )}
            {order.status !== "cancelled" && order.status !== "refunded" && (
              <Link
                to={order.status === "draft"
                  ? `/admin/commandes/nouvelle?draft=${order.id}`
                  : `/admin/commandes/nouvelle?edit=${order.id}`}
                className="block"
              >
                <Button className="w-full justify-start" variant="outline">
                  <Pencil size={14} className="mr-2" /> {order.status === "draft" ? "Modifier le brouillon" : "Modifier la commande"}
                </Button>
              </Link>
            )}
          </div>

          {publicUrl && (
            <div className="bg-white border rounded-lg p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Lock size={14} /> Protection du lien public
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Code PIN (4 à 8 chiffres, vide = désactivé)</label>
                <Input
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
                  placeholder="ex : 482915"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Expiration (vide = jamais)</label>
                <Input
                  type="date"
                  value={expiresInput}
                  onChange={(e) => setExpiresInput(e.target.value)}
                />
              </div>
              <Button onClick={savePublicAccess} disabled={busy !== null} className="w-full" style={{ backgroundColor: "#1C58D9", color: "#fff" }}>
                {busy === "ACCESS" ? "Enregistrement…" : "Enregistrer la protection"}
              </Button>
              <div className="text-[11px] text-slate-500">
                {(order as any).public_access_pin ? "🔒 PIN actif" : "⚠️ Aucun PIN — lien accessible avec le token seul"}
                {(order as any).public_access_expires_at && (
                  <> · Expire le {new Date((order as any).public_access_expires_at).toLocaleDateString("fr-BE")}</>
                )}
              </div>
            </div>
          )}


          {order.admin_notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
              <div className="font-semibold mb-1">Note interne</div>
              {order.admin_notes}
            </div>
          )}

          <div className="bg-white border rounded-lg p-4 text-xs text-slate-500 space-y-1" style={{ borderColor: "#E2E8F0" }}>
            <div>Créée le {new Date(order.created_at).toLocaleString("fr-BE")}</div>
            {order.updated_at && <div>Mise à jour : {new Date(order.updated_at).toLocaleString("fr-BE")}</div>}
            {order.is_forecast && <div className="text-violet-700 font-medium">Commande prévisionnelle</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCommandeDetail;
