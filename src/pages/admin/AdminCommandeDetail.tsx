import { Fragment, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fmtEur } from "@/lib/format-currency";
import { ArrowLeft, FileDown, Pencil, Copy, Link2, ExternalLink, Lock, Wallet, ShieldCheck, AlertTriangle, CheckCircle2, Truck, Send } from "lucide-react";
import OrderInvoiceStatusPanel from "@/components/orders/OrderInvoiceStatusPanel";
import OrderProductsSummary from "@/components/orders/OrderProductsSummary";
import DeliveryNotesPanel from "@/components/orders/DeliveryNotesPanel";

import StripePaymentStatusBadge from "@/components/orders/StripePaymentStatusBadge";
import OrderSourceBadge from "@/components/orders/OrderSourceBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { lineMetrics, type ManualLineInput } from "@/lib/manual-order-metrics";
import { VendorsEmbedError } from "@/lib/vendors-embed-error";
import GeneratePaymentLinkButton from "@/components/admin/GeneratePaymentLinkButton";

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

/**
 * Valide une URL de tracking externe.
 * - Doit parser comme URL absolue
 * - Protocole obligatoire : https
 * - Hôte requis avec au moins un point (pas de localhost / IP interne)
 * - Longueur max 2048
 * Retourne null si valide, sinon un message d'erreur FR.
 */
function validateTrackingUrl(raw: string): string | null {
  const v = (raw || "").trim();
  if (!v) return null; // champ optionnel — vide = pas d'URL
  if (v.length > 2048) return "URL trop longue (max 2048 caractères).";
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return "URL invalide — doit commencer par https://";
  }
  if (u.protocol !== "https:") return "L'URL doit utiliser https:// (http et autres protocoles refusés).";
  if (!u.hostname || !u.hostname.includes(".")) return "Nom de domaine invalide.";
  if (/^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/i.test(u.hostname)) return "Domaine local/interne interdit.";
  return null;
}

const AdminCommandeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState<string>("");
  const [expiresInput, setExpiresInput] = useState<string>("");
  const [coherence, setCoherence] = useState<any | null>(null);
  const [coherenceOpen, setCoherenceOpen] = useState(false);
  // Suivi d'expédition (niveau commande)
  const [trackUrl, setTrackUrl] = useState("");
  const [trackCarrier, setTrackCarrier] = useState("");
  const [trackNumber, setTrackNumber] = useState("");
  // Suivi par ligne — édition admin
  const [lineTracks, setLineTracks] = useState<Record<string, { url: string; number: string }>>({});
  const [testEmail, setTestEmail] = useState<string>("collardpierre@gmail.com");
  const [testUseRealToken, setTestUseRealToken] = useState<boolean>(false);



  const { data: order, isLoading, error: orderError } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || "");
      const query = supabase
        .from("orders")
        .select("*, customer:customers(*), order_lines(*, products(name, gtin, cnk_code), vendors(company_name, name, vat_number, bank_name, iban, bic))");
      const { data, error } = await (isUuid ? query.eq("id", id!) : query.eq("order_number", id!)).maybeSingle();
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
      setTrackUrl((order as any).tracking_url || "");
      setTrackCarrier((order as any).tracking_carrier || "");
      setTrackNumber((order as any).tracking_number || "");
      const map: Record<string, { url: string; number: string }> = {};
      for (const l of ((order as any).order_lines || [])) {
        map[l.id] = { url: l.tracking_url || "", number: l.tracking_number || "" };
      }
      setLineTracks(map);
    }
  }, [order]);

  const { data: splitSummary, refetch: refetchSplit, isFetching: splitLoading } = useQuery({
    queryKey: ["admin-order-split", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_order_split_summary" as any, { _order_id: id });
      if (error) throw error;
      return data as any;
    },
    enabled: !!id && !!order,
  });

  const { data: deliveryEmailLogs, refetch: refetchDeliveryEmailLogs, isFetching: emailLogsLoading } = useQuery({
    queryKey: ["admin-order-delivery-email-logs", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_list_order_delivery_confirmation_test_emails" as any,
        { _order_id: id },
      );
      if (error) throw error;
      return (data ?? []) as Array<{
        message_id: string;
        recipient_email: string;
        status: string;
        error_message: string | null;
        last_event_at: string;
        is_test: boolean;
      }>;
    },
    enabled: !!id && !!order && order.status === "delivered",
    refetchInterval: 15000,
  });


  const reprocessFanout = async () => {
    if (!confirm("Relancer le split en sous-commandes vendeur ?\n\nL'opération est idempotente : aucun doublon ne sera créé, seuls les vendeurs manquants seront ajoutés.")) return;
    setBusy("REPROCESS");
    try {
      const { data, error } = await supabase.rpc("admin_reprocess_order_fanout" as any, { _order_id: id });
      if (error) throw error;
      const summary: any = data;
      toast.success(`Split relancé · ${summary?.actual_sub_order_count || 0} sous-commande(s) au total (${summary?.dispatched_rows || 0} traitée(s))`);
      await refetchSplit();
      await queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e: any) {
      toast.error(e?.message || "Échec relance split");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <div className="p-6 text-slate-500">Chargement…</div>;
  if (orderError) return <div className="p-6"><VendorsEmbedError error={orderError} /></div>;
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

  const checkCoherence = async () => {
    setBusy("COHERENCE");
    try {
      const { data, error } = await supabase.rpc("admin_check_vendor_payout_coherence" as any, { _order_id: id });
      if (error) throw error;
      setCoherence(data);
      setCoherenceOpen(true);
      const g = (data as any)?.global;
      if (g?.overall_status === "ok") toast.success(`Cohérence OK (${g.ok_count}/${g.vendor_count} vendeur·s)`);
      else if (g?.overall_status === "mismatch") toast.warning(`${g.mismatch_count} écart(s) détecté(s)`);
      else toast.info("Aucun vendeur à vérifier");
    } catch (e: any) {
      toast.error(e?.message || "Échec du contrôle de cohérence");
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

  const saveTracking = async (opts: { notify: boolean; markShipped: boolean }) => {
    const urlErr = validateTrackingUrl(trackUrl);
    if (urlErr) {
      toast.error(urlErr);
      return;
    }
    setBusy("TRACKING");
    try {
      const patch: Record<string, any> = {
        tracking_url: trackUrl.trim() || null,
        tracking_carrier: trackCarrier.trim() || null,
        tracking_number: trackNumber.trim() || null,
      };
      if (opts.markShipped) {
        patch.status = "shipped";
        patch.shipped_at = new Date().toISOString();
      }
      const { error } = await supabase.from("orders").update(patch as any).eq("id", id!);
      if (error) throw error;
      if (opts.notify) {
        const { data: notifyRes, error: notifyErr } = await supabase.functions.invoke("notify-order-shipped", {
          body: { orderId: id, appOrigin: window.location.origin },
        });
        if (notifyErr) {
          toast.warning("Suivi enregistré — email non envoyé : " + (notifyErr.message || "erreur"));
        } else {
          toast.success(`Suivi enregistré · email envoyé à ${(notifyRes as any)?.recipient || "l'acheteur"}`);
        }
      } else {
        toast.success("Suivi enregistré");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e: any) {
      toast.error(e?.message || "Échec enregistrement suivi");
    } finally {
      setBusy(null);
    }
  };

  const dryRunNotify = async () => {
    setBusy("TRACKING");
    try {
      const { data, error } = await supabase.functions.invoke("notify-order-shipped", {
        body: { orderId: id, appOrigin: window.location.origin, dryRun: true },
      });
      if (error) throw error;
      const res: any = data;
      const logs: any[] = res?.existingLogs ?? [];
      const activeCount = logs.filter((r) => ["sent", "pending"].includes(String(r.status))).length;
      const msg = res?.alreadySent
        ? `✅ Test OK — ${activeCount} envoi(s) déjà logué(s) pour clé "${res.idempotencyKey}". Un vrai clic NE créerait PAS de doublon.`
        : `✅ Test OK — aucun envoi existant. Un vrai clic enverrait exactement 1 email à ${res?.recipient}.`;
      toast.success(msg, { duration: 8000 });
      // eslint-disable-next-line no-console
      console.log("[notify-order-shipped dryRun]", res);
    } catch (e: any) {
      toast.error(e?.message || "Échec test");
    } finally {
      setBusy(null);
    }
  };



  const saveLineTracking = async (lineId: string) => {
    const lt = lineTracks[lineId] || { url: "", number: "" };
    const urlErr = validateTrackingUrl(lt.url);
    if (urlErr) {
      toast.error(`Ligne : ${urlErr}`);
      return;
    }
    setBusy(`LINE-${lineId}`);
    try {
      const { error } = await supabase.from("order_lines").update({
        tracking_url: lt.url.trim() || null,
        tracking_number: lt.number.trim() || null,
      }).eq("id", lineId);
      if (error) throw error;
      toast.success("Suivi ligne enregistré");
      await queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e: any) {
      toast.error(e?.message || "Échec suivi ligne");
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
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StripePaymentStatusBadge order={order as any} />
                  <OrderSourceBadge source={(order as any).source ?? null} />
                </div>
                {order.payment_due_date && <div className="text-xs text-slate-500">Échéance : {new Date(order.payment_due_date).toLocaleDateString("fr-BE")}</div>}
                {(order as any).source === "manual_admin"
                  && order.payment_status !== "paid"
                  && order.status !== "draft"
                  && order.status !== "cancelled" && (
                  <GeneratePaymentLinkButton orderId={order.id} />
                )}
              </div>
            </div>
            {(order as any).fulfillment_mode && (
              <div className="mb-3 p-3 rounded border bg-slate-50" style={{ borderColor: "#E2E8F0" }}>
                <div className="text-[11px] uppercase text-slate-400 font-semibold mb-1">Mode logistique</div>
                <div className="font-medium text-sm">
                  {(order as any).fulfillment_mode === "pickup" ? "🏬 Picking — retrait sur place" : "📦 Livraison"}
                </div>
                {(order as any).fulfillment_mode === "delivery" && (() => {
                  const sa = (order as any).shipping_address as any;
                  const hasMin = sa && (sa.address_l1 || sa.address_line1) && (sa.postal_code || sa.zip) && sa.city;
                  if (!hasMin) {
                    return (
                      <div className="mt-2 text-xs rounded border border-rose-200 bg-rose-50 text-rose-800 px-2 py-1.5">
                        ⚠️ Adresse de livraison manquante ou incomplète — impossible d'expédier en l'état.
                      </div>
                    );
                  }
                  return (
                    <div className="mt-2 text-xs text-slate-600 leading-snug">
                      {sa.label && <div className="font-medium text-slate-800">{sa.label}</div>}
                      {(sa.address_l1 || sa.address_line1) && <div>{sa.address_l1 || sa.address_line1}</div>}
                      {(sa.address_l2 || sa.address_line2) && <div>{sa.address_l2 || sa.address_line2}</div>}
                      <div>
                        {(sa.postal_code || sa.zip)} {sa.city}
                        {sa.country_code ? ` (${sa.country_code})` : ""}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="mb-3 p-3 rounded border bg-white flex items-center justify-between gap-3" style={{ borderColor: "#E2E8F0" }}>
              <div>
                <div className="text-[11px] uppercase text-slate-400 font-semibold mb-0.5">Bloc « Informations de paiement »</div>
                <div className="text-xs text-slate-500">Coordonnées bancaires du fournisseur sur le PDF & page publique.</div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={(order as any).show_payment_info !== false}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    const { error } = await supabase.from("orders").update({ show_payment_info: next }).eq("id", order.id);
                    if (error) { toast.error("Échec : " + error.message); return; }
                    toast.success(next ? "Bloc paiement activé" : "Bloc paiement masqué");
                    queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
                  }}
                />
                {(order as any).show_payment_info !== false ? "Affiché" : "Masqué"}
              </label>
            </div>
            {order.notes && (
              <div className="bg-blue-50/60 border-l-2 border-blue-400 px-3 py-2 rounded text-sm italic text-slate-700">{order.notes}</div>
            )}
          </div>

          <OrderInvoiceStatusPanel
            orderId={order.id}
            defaultAmounts={{
              excl_vat: Number(order.subtotal_excl_vat) || 0,
              vat: Number(order.vat_amount) || 0,
              incl_vat: Number(order.total_incl_vat) || 0,
            }}
          />




          <OrderProductsSummary lines={lines} />

          <DeliveryNotesPanel
            orderId={order.id}
            orderNumber={order.order_number}
            orderStatus={(order as any).status ?? null}
            customerName={(order as any).customer?.company_name ?? (order as any).customer?.email ?? null}
            shippingAddress={(order as any).shipping_address ?? null}
          />


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
                  const lt = lineTracks[l.id] || { url: "", number: "" };
                  const dirty = (l.tracking_url || "") !== lt.url || (l.tracking_number || "") !== lt.number;
                  const ltUrlErr = validateTrackingUrl(lt.url);
                  return (
                    <Fragment key={l.id}>
                    <tr className="border-t">
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
                    <tr className="bg-slate-50/60">
                      <td colSpan={7} className="px-3 py-2">
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                            <Truck size={12} /> Suivi ligne :
                          </div>
                          <Input
                            className={`h-8 text-xs flex-1 min-w-[200px] ${ltUrlErr ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                            placeholder="https://..."
                            value={lt.url}
                            onChange={(e) => setLineTracks((m) => ({ ...m, [l.id]: { ...lt, url: e.target.value } }))}
                            aria-invalid={!!ltUrlErr}
                          />
                          <Input
                            className="h-8 text-xs w-44"
                            placeholder="N° de colis"
                            value={lt.number}
                            onChange={(e) => setLineTracks((m) => ({ ...m, [l.id]: { ...lt, number: e.target.value } }))}
                          />
                          <Button
                            size="sm"
                            variant={dirty ? "default" : "outline"}
                            disabled={!dirty || busy !== null || !!ltUrlErr}
                            onClick={() => saveLineTracking(l.id)}
                            style={dirty && !ltUrlErr ? { backgroundColor: "#1C58D9", color: "#fff" } : undefined}
                            title={ltUrlErr || undefined}
                          >
                            {busy === `LINE-${l.id}` ? "…" : "Enregistrer"}
                          </Button>
                          {(lt.url || "").trim() && !ltUrlErr && (
                            <a href={lt.url.trim()} target="_blank" rel="noreferrer" className="text-[11px] text-mk-blue hover:underline inline-flex items-center gap-1">
                              <ExternalLink size={11} /> Ouvrir
                            </a>
                          )}
                          {ltUrlErr && <span className="text-[11px] text-red-600 w-full">{ltUrlErr}</span>}
                        </div>
                      </td>
                    </tr>
                    </Fragment>
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
          {(() => {
            const s: any = splitSummary;
            if (!s) {
              return (
                <div className="bg-white border rounded-lg p-4 text-xs text-slate-500" style={{ borderColor: "#E2E8F0" }}>
                  {splitLoading ? "Chargement split fournisseurs…" : "Split fournisseurs : aucune donnée"}
                </div>
              );
            }
            const status = s.overall_status as string;
            const badge =
              status === "ok" ? { c: "bg-emerald-100 text-emerald-800 border-emerald-200", t: "✓ OK", I: CheckCircle2 } :
              status === "missing" ? { c: "bg-amber-100 text-amber-900 border-amber-200", t: "⚠ Vendeur(s) manquant(s)", I: AlertTriangle } :
              status === "extra" ? { c: "bg-amber-100 text-amber-900 border-amber-200", t: "⚠ Sous-commande orpheline", I: AlertTriangle } :
              { c: "bg-slate-100 text-slate-700 border-slate-200", t: "Aucune ligne vendeur", I: ShieldCheck };
            const Icon = badge.I;
            return (
              <div className="bg-white border rounded-lg p-4" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold">Split fournisseurs (sub_orders)</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-medium inline-flex items-center gap-1 ${badge.c}`}>
                    <Icon size={11} /> {badge.t}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="border rounded p-2"><div className="text-slate-500">Vendeurs attendus</div><div className="font-mono font-semibold">{s.expected_vendor_count}</div></div>
                  <div className="border rounded p-2"><div className="text-slate-500">Sub_orders créés</div><div className="font-mono font-semibold">{s.actual_sub_order_count}</div></div>
                </div>
                {(s.missing_vendor_ids?.length || 0) > 0 && (
                  <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                    <div className="font-semibold mb-1">Vendeurs sans sous-commande :</div>
                    <div className="space-y-0.5">
                      {(s.expected || []).filter((e: any) => s.missing_vendor_ids.includes(e.vendor_id)).map((e: any) => (
                        <div key={e.vendor_id} className="font-mono">• {e.vendor_label} ({e.line_count} ligne{e.line_count > 1 ? "s" : ""})</div>
                      ))}
                    </div>
                  </div>
                )}
                {(s.extra_vendor_ids?.length || 0) > 0 && (
                  <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                    Sub_orders sans ligne correspondante : {s.extra_vendor_ids.length}
                  </div>
                )}
                {(s.sub_orders || []).length > 0 && (
                  <div className="border-t pt-2 mt-2 space-y-1.5 max-h-64 overflow-y-auto" style={{ borderColor: "#F1F5F9" }}>
                    {(s.sub_orders || []).map((so: any) => (
                      <div key={so.sub_order_id} className="text-[11px] border rounded p-2" style={{ borderColor: "#F1F5F9" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium truncate">{so.vendor_label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">{so.status || "—"}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-slate-600">
                          <div>TTC : <span className="font-mono">{so.subtotal_incl_vat != null ? `${Number(so.subtotal_incl_vat).toFixed(2)} €` : "—"}</span></div>
                          <div>Paiement : <span className="font-mono">{so.payment_status || "—"}</span></div>
                          <div className="col-span-2 text-slate-400">Créé : {so.created_at ? new Date(so.created_at).toLocaleString("fr-BE") : "—"}</div>
                          {so.vendor_first_viewed_at && <div className="col-span-2 text-slate-400">Vu vendeur : {new Date(so.vendor_first_viewed_at).toLocaleString("fr-BE")}</div>}
                          {so.vendor_confirmed_at && <div className="col-span-2 text-slate-400">Confirmé : {new Date(so.vendor_confirmed_at).toLocaleString("fr-BE")}</div>}
                          {so.shipped_at && <div className="col-span-2 text-slate-400">Expédié : {new Date(so.shipped_at).toLocaleString("fr-BE")}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-slate-400 mt-2 space-y-0.5">
                  {s.first_sub_order_at && <div>Premier sub_order : {new Date(s.first_sub_order_at).toLocaleString("fr-BE")}</div>}
                  {s.last_sub_order_at && <div>Dernier sub_order : {new Date(s.last_sub_order_at).toLocaleString("fr-BE")}</div>}
                  {s.last_sub_order_updated_at && <div>Dernière MAJ : {new Date(s.last_sub_order_updated_at).toLocaleString("fr-BE")}</div>}
                </div>
                <Button
                  onClick={reprocessFanout}
                  disabled={busy !== null || s.expected_vendor_count === 0}
                  variant={status === "missing" ? "default" : "outline"}
                  className="w-full mt-3 justify-start"
                  style={status === "missing" ? { backgroundColor: "#D97706", color: "#fff" } : undefined}
                  title="Relance l'RPC fan-out (idempotent). Ne crée jamais de doublon."
                >
                  <ShieldCheck size={14} className="mr-2" /> {busy === "REPROCESS" ? "Relance…" : "Re-traiter le split (sécurisé)"}
                </Button>
              </div>
            );
          })()}

          <div className="bg-white border rounded-lg p-4 space-y-2" style={{ borderColor: "#E2E8F0" }}>
            <div className="text-sm font-semibold mb-2">Actions</div>
            <Button onClick={generatePdf} disabled={busy !== null} className="w-full justify-start" style={{ backgroundColor: "#1C58D9", color: "#fff" }}>
              <FileDown size={14} className="mr-2" /> {busy === "PDF" ? "Génération…" : "Générer le bon de commande PDF"}
            </Button>
            <Button onClick={generatePayoutPdf} disabled={busy !== null} className="w-full justify-start" style={{ backgroundColor: "#10B981", color: "#fff" }}>
              <Wallet size={14} className="mr-2" /> {busy === "PAYOUT" ? "Génération…" : "Décompte fournisseur PDF"}
            </Button>
            <Button onClick={checkCoherence} disabled={busy !== null} className="w-full justify-start" variant="outline">
              <ShieldCheck size={14} className="mr-2" /> {busy === "COHERENCE" ? "Contrôle…" : "Vérifier cohérence décompte"}
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

          {/* Suivi d'expédition */}
          <div className="bg-white border rounded-lg p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Truck size={14} /> Suivi d'expédition
            </div>
            {(order as any).shipped_at && (
              <div className="text-[11px] text-slate-500">
                Expédiée le {new Date((order as any).shipped_at).toLocaleString("fr-BE")}
              </div>
            )}
            <div>
              <label className="text-xs text-slate-500 block mb-1">URL de suivi (externe)</label>
              {(() => {
                const err = validateTrackingUrl(trackUrl);
                return (
                  <>
                    <Input
                      value={trackUrl}
                      onChange={(e) => setTrackUrl(e.target.value)}
                      placeholder="https://track.bpost.be/..."
                      aria-invalid={!!err}
                      className={err ? "border-red-500 focus-visible:ring-red-500" : undefined}
                    />
                    {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
                    <p className="mt-1 text-[10px] text-slate-400">https:// uniquement · domaine public requis</p>
                  </>
                );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Transporteur</label>
                <Input
                  value={trackCarrier}
                  onChange={(e) => setTrackCarrier(e.target.value)}
                  placeholder="bpost, DPD, DHL…"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">N° de colis</label>
                <Input
                  value={trackNumber}
                  onChange={(e) => setTrackNumber(e.target.value)}
                  placeholder="Ex. 323123456789"
                />
              </div>
            </div>
            {(() => {
              const trackUrlErr = validateTrackingUrl(trackUrl);
              return (
                <div className="space-y-2 pt-1">
                  {order.status === "delivered" && (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                      <div className="font-semibold mb-0.5 flex items-center gap-2">
                        <CheckCircle2 size={14} /> Commande livrée
                      </div>
                      <div className="text-[12px]">L'acheteur a déjà été notifié de l'expédition. Les actions de renotification ne sont plus disponibles.</div>
                    </div>
                  )}
                  {order.status !== "shipped" && order.status !== "delivered" && (
                    <Button
                      onClick={() => saveTracking({ notify: true, markShipped: true })}
                      disabled={busy !== null || !!trackUrlErr}
                      className="w-full justify-start"
                      style={{ backgroundColor: "#1C58D9", color: "#fff" }}
                      title={trackUrlErr || undefined}
                    >
                      <Send size={14} className="mr-2" />
                      {busy === "TRACKING" ? "Envoi…" : "Marquer expédié & notifier l'acheteur"}
                    </Button>
                  )}
                  {order.status !== "delivered" && (
                    <Button
                      onClick={() => saveTracking({ notify: true, markShipped: false })}
                      disabled={busy !== null || !!trackUrlErr}
                      className="w-full justify-start"
                      variant={order.status === "shipped" ? "default" : "outline"}
                      style={order.status === "shipped" ? { backgroundColor: "#1C58D9", color: "#fff" } : undefined}
                      title={trackUrlErr || undefined}
                    >
                      <Send size={14} className="mr-2" />
                      {busy === "TRACKING" ? "Envoi…" : "Enregistrer & renotifier l'acheteur"}
                    </Button>
                  )}
                  <Button
                    onClick={() => saveTracking({ notify: false, markShipped: false })}
                    disabled={busy !== null || !!trackUrlErr}
                    className="w-full justify-start"
                    variant="outline"
                    title={trackUrlErr || undefined}
                  >
                    {busy === "TRACKING" ? "Enregistrement…" : "Enregistrer sans email"}
                  </Button>
                  {order.status !== "delivered" && (
                    <Button
                      onClick={dryRunNotify}
                      disabled={busy !== null}
                      className="w-full justify-start"
                      variant="secondary"
                      title="Simule l'envoi sans rien envoyer et vérifie qu'un seul email partirait (idempotency)"
                    >
                      {busy === "TRACKING" ? "Test…" : "🧪 Tester (dry-run) — vérifier l'envoi unique"}
                    </Button>
                  )}
                  {trackUrl.trim() && !trackUrlErr && (
                    <a href={trackUrl.trim()} target="_blank" rel="noreferrer" className="block">
                      <Button className="w-full justify-start" variant="ghost">
                        <ExternalLink size={14} className="mr-2" /> Ouvrir le suivi
                      </Button>
                    </a>
                  )}
                </div>
              );
            })()}
            <p className="text-[11px] text-slate-400">
              L'URL de suivi et le n° de colis sont visibles sur la page publique de la commande et
              inclus dans l'email d'expédition.
            </p>
          </div>

          {order.status === "delivered" && (
            <div className="bg-white border rounded-lg p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Send size={14} /> Confirmation de réception
              </div>
              {(order as any).delivery_confirmation_completed_at ? (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                  <div className="font-semibold mb-0.5 flex items-center gap-2">
                    <CheckCircle2 size={14} /> Confirmée par l'acheteur
                  </div>
                  <div className="text-[12px]">
                    Le {new Date((order as any).delivery_confirmation_completed_at).toLocaleString("fr-BE")}
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-slate-500">
                  {(order as any).delivery_confirmation_requested_at
                    ? <>Email envoyé le {new Date((order as any).delivery_confirmation_requested_at).toLocaleString("fr-BE")} · aucune confirmation reçue à ce jour.</>
                    : <>Aucune demande de confirmation envoyée pour l'instant.</>}
                </div>
              )}

              {/* Historique des envois email (production + tests) */}
              <div className="rounded-md border p-3" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                    Historique des envois email
                  </div>
                  <button
                    type="button"
                    onClick={() => refetchDeliveryEmailLogs()}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                    disabled={emailLogsLoading}
                  >
                    {emailLogsLoading ? "…" : "Rafraîchir"}
                  </button>
                </div>
                {(deliveryEmailLogs?.length ?? 0) === 0 ? (
                  <div className="text-[12px] text-slate-400">Aucun envoi enregistré à ce jour.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {deliveryEmailLogs!.map((log) => {
                      const statusStyle: Record<string, { bg: string; fg: string; label: string }> = {
                        sent: { bg: "#DCFCE7", fg: "#166534", label: "Envoyé" },
                        pending: { bg: "#FEF3C7", fg: "#92400E", label: "En file" },
                        suppressed: { bg: "#E0E7FF", fg: "#3730A3", label: "Dédupliqué / supprimé" },
                        failed: { bg: "#FEE2E2", fg: "#991B1B", label: "Échec" },
                        dlq: { bg: "#FEE2E2", fg: "#991B1B", label: "DLQ" },
                        bounced: { bg: "#FEE2E2", fg: "#991B1B", label: "Bounce" },
                        complained: { bg: "#FEE2E2", fg: "#991B1B", label: "Plainte" },
                      };
                      const s = statusStyle[log.status] || { bg: "#F1F5F9", fg: "#475569", label: log.status };
                      return (
                        <li key={log.message_id} className="text-[12px] flex items-start gap-2">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded font-semibold whitespace-nowrap"
                            style={{ backgroundColor: s.bg, color: s.fg, fontSize: 10 }}
                            title={log.error_message || ""}
                          >
                            {s.label}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="text-slate-800">{log.recipient_email}</span>
                            {log.is_test && (
                              <span className="ml-1 text-[10px] text-slate-500">(test)</span>
                            )}
                            {log.error_message && (
                              <div className="text-[11px] text-red-600 truncate" title={log.error_message}>
                                {log.error_message}
                              </div>
                            )}
                          </span>
                          <span className="text-slate-400 whitespace-nowrap">
                            {new Date(log.last_event_at).toLocaleString("fr-BE")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {(() => {
                  const last = deliveryEmailLogs?.[0];
                  return last ? (
                    <div className="mt-2 text-[11px] text-slate-500">
                      Dernier envoi : {new Date(last.last_event_at).toLocaleString("fr-BE")} · {last.recipient_email}
                    </div>
                  ) : null;
                })()}
              </div>

              <Button
                onClick={async () => {
                  setBusy("DELIVERY_CONF");
                  try {
                    const { data, error } = await supabase.functions.invoke("request-delivery-confirmation", {
                      body: { orderId: order.id, appOrigin: window.location.origin },
                    });
                    if (error) throw error;
                    if ((data as any)?.skipped) {
                      toast.info("Déjà confirmée par l'acheteur — email non renvoyé.");
                    } else {
                      toast.success(`Email de confirmation renvoyé à ${(data as any)?.recipient || "l'acheteur"}`);
                    }
                    queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
                    setTimeout(() => refetchDeliveryEmailLogs(), 1500);

                  } catch (e: any) {
                    toast.error("Échec envoi : " + (e?.message || "erreur"));
                  } finally {
                    setBusy(null);
                  }
                }}
                disabled={busy !== null || !!(order as any).delivery_confirmation_completed_at}
                className="w-full justify-start"
                style={{ backgroundColor: "#1C58D9", color: "#fff" }}
              >
                <Send size={14} className="mr-2" />
                {busy === "DELIVERY_CONF" ? "Envoi…" : "Renvoyer la demande de confirmation"}
              </Button>
              <Button
                onClick={async () => {
                  setBusy("DELIVERY_CONF");
                  try {
                    const { data, error } = await supabase.functions.invoke("request-delivery-confirmation", {
                      body: { orderId: order.id, appOrigin: window.location.origin, dryRun: true },
                    });
                    if (error) throw error;
                    const d = data as any;
                    if (d?.skipped) toast.info("Dry-run : déjà confirmée — aucun envoi ne partirait.");
                    else toast.success(`Dry-run OK · destinataire ${d?.recipient} · key ${d?.idempotencyKey}`);
                  } catch (e: any) {
                    toast.error("Dry-run échec : " + (e?.message || "erreur"));
                  } finally {
                    setBusy(null);
                  }
                }}
                disabled={busy !== null}
                className="w-full justify-start"
                variant="secondary"
                title="Simule l'envoi (idempotency key réutilisée si nécessaire)"
              >
                {busy === "DELIVERY_CONF" ? "Test…" : "🧪 Tester (dry-run)"}
              </Button>
              <div className="rounded-md border p-3 space-y-2" style={{ borderColor: "#E2E8F0" }}>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  Envoyer un email de test à
                </label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="adresse@exemple.com"
                    className="flex-1"
                    disabled={busy !== null}
                  />
                  <Button
                    onClick={async () => {
                      const email = testEmail.trim().toLowerCase();
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        toast.error("Adresse email invalide");
                        return;
                      }
                      setBusy("DELIVERY_CONF");
                      try {
                        // Optionnellement, générer un vrai token de confirmation.
                        // ATTENTION : cela invalide un éventuel lien déjà envoyé à l'acheteur.
                        let confirmUrl = `${window.location.origin}/commande/confirmer/TEST-TOKEN-PREVIEW`;
                        if (testUseRealToken) {
                          const { data: rawToken, error: tokErr } = await supabase.rpc(
                            "create_buyer_delivery_token" as any,
                            { _order_id: order.id },
                          );
                          if (tokErr || !rawToken) throw new Error(tokErr?.message || "token_generation_failed");
                          confirmUrl = `${window.location.origin}/commande/confirmer/${encodeURIComponent(String(rawToken))}`;
                        }
                        const { data, error } = await supabase.functions.invoke("send-transactional-email", {
                          body: {
                            templateName: "order-delivery-confirmation",
                            recipientEmail: email,
                            idempotencyKey: `order-delivery-confirmation-test-${order.id}-${Date.now()}`,
                            templateData: {
                              orderNumber: order.order_number,
                              customerName: (order as any).customers?.company_name || "Test admin",
                              confirmUrl,
                              lineCount: (order as any).order_lines?.length ?? 3,
                            },
                          },
                        });
                        if (error) throw error;
                        toast.success(
                          testUseRealToken
                            ? `Email de test (token réel) envoyé à ${email} — l'ancien lien acheteur est invalidé.`
                            : `Email de test envoyé à ${email}`,
                        );
                        setTimeout(() => refetchDeliveryEmailLogs(), 1500);
                      } catch (e: any) {
                        toast.error("Échec test : " + (e?.message || "erreur"));
                      } finally {
                        setBusy(null);
                      }
                    }}
                    disabled={busy !== null}
                    variant="outline"
                    title={
                      testUseRealToken
                        ? "Génère un vrai token acheteur (invalide l'ancien lien) et envoie l'email de test"
                        : "Envoie le rendu du template à l'adresse saisie (lien de confirmation factice)"
                    }
                  >
                    ✉️ Envoyer test
                  </Button>
                </div>
                <label className="flex items-start gap-2 text-[12px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testUseRealToken}
                    onChange={(e) => setTestUseRealToken(e.target.checked)}
                    disabled={busy !== null}
                    className="mt-0.5"
                  />
                  <span>
                    Utiliser un <strong>vrai token de confirmation</strong> (lien cliquable qui marque réellement la commande).
                    <span className="block text-[11px] text-amber-700">
                      ⚠️ Régénère le token acheteur et invalide un éventuel lien déjà envoyé au client.
                    </span>
                  </span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Sans cette option : token factice <code>TEST-TOKEN-PREVIEW</code>, aucun impact sur l'acheteur.
                </p>
              </div>


              <Button
                onClick={async () => {
                  setBusy("DELIVERY_CONF");

                  try {
                    const { data: sess } = await supabase.auth.getSession();
                    const token = sess.session?.access_token;
                    if (!token) throw new Error("Session admin introuvable");
                    const url = `https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1/preview-order-delivery-confirmation?orderId=${encodeURIComponent(order.id)}`;
                    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const html = await res.text();
                    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
                    const blobUrl = URL.createObjectURL(blob);
                    window.open(blobUrl, "_blank", "noopener");
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
                  } catch (e: any) {
                    toast.error("Aperçu échec : " + (e?.message || "erreur"));
                  } finally {
                    setBusy(null);
                  }
                }}
                disabled={busy !== null}
                className="w-full justify-start"
                variant="outline"
                title="Ouvre le rendu HTML du template dans un nouvel onglet"
              >
                👁️ Aperçu mail (rendu HTML)
              </Button>
              <p className="text-[11px] text-slate-400">
                Le token magic-link est régénéré côté serveur (RPC <code>create_buyer_delivery_token</code>) et l'idempotency key <code>order-delivery-confirmation-&lt;id&gt;</code> évite les doublons côté file d'attente email.
              </p>

            </div>
          )}







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

      <Dialog open={coherenceOpen} onOpenChange={setCoherenceOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600" />
              Cohérence décompte fournisseur
            </DialogTitle>
            <DialogDescription>
              Comparaison entre les totaux recalculés depuis les lignes de commande (formule identique au PDF de décompte) et les sous-commandes vendeur enregistrées.
            </DialogDescription>
          </DialogHeader>
          {coherence?.global && (
            <div className="space-y-4">
              <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${coherence.global.overall_status === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : coherence.global.overall_status === "mismatch" ? "bg-amber-50 text-amber-900 border border-amber-200" : "bg-slate-50 text-slate-700 border border-slate-200"}`}>
                {coherence.global.overall_status === "ok" ? <CheckCircle2 size={16} /> : coherence.global.overall_status === "mismatch" ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                <span className="font-medium">
                  {coherence.global.overall_status === "ok" && `Tous les vendeurs cohérents (${coherence.global.ok_count}/${coherence.global.vendor_count})`}
                  {coherence.global.overall_status === "mismatch" && `${coherence.global.mismatch_count} écart(s) détecté(s) sur ${coherence.global.vendor_count} vendeur(s)`}
                  {coherence.global.overall_status === "empty" && "Aucun vendeur à vérifier sur cette commande"}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="border rounded p-2"><div className="text-slate-500">CA HT total</div><div className="font-mono font-semibold">{fmtEur(Math.round(Number(coherence.global.total_ca_ht || 0) * 100))} €</div></div>
                <div className="border rounded p-2"><div className="text-slate-500">TVA total</div><div className="font-mono">{fmtEur(Math.round(Number(coherence.global.total_vat || 0) * 100))} €</div></div>
                <div className="border rounded p-2"><div className="text-slate-500">Commission MK</div><div className="font-mono">{fmtEur(Math.round(Number(coherence.global.total_commission || 0) * 100))} €</div></div>
                <div className="border rounded p-2"><div className="text-slate-500">Net HT à reverser</div><div className="font-mono font-semibold text-emerald-700">{fmtEur(Math.round(Number(coherence.global.total_net_ht || 0) * 100))} €</div></div>
              </div>
              <div className="space-y-2">
                {(coherence.vendors || []).map((v: any) => {
                  const badge = v.status === "ok"
                    ? { c: "bg-emerald-100 text-emerald-800 border-emerald-200", t: "✓ Cohérent" }
                    : v.status === "mismatch"
                    ? { c: "bg-amber-100 text-amber-900 border-amber-200", t: "⚠ Écart" }
                    : { c: "bg-slate-100 text-slate-700 border-slate-200", t: "Aucune sous-commande" };
                  return (
                    <div key={v.vendor_id} className="border rounded-lg p-3" style={{ borderColor: "#E2E8F0" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{v.vendor_label}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${badge.c}`}>{badge.t}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                        <div><div className="text-slate-500">Lignes</div><div className="font-mono">{v.line_count}</div></div>
                        <div><div className="text-slate-500">CA HT</div><div className="font-mono">{Number(v.ca_ht).toFixed(2)} €</div></div>
                        <div><div className="text-slate-500">TVA</div><div className="font-mono">{Number(v.vat).toFixed(2)} €</div></div>
                        <div><div className="text-slate-500">Commission MK</div><div className="font-mono">{Number(v.commission).toFixed(2)} €</div></div>
                        <div><div className="text-slate-500">Net HT</div><div className="font-mono font-semibold text-emerald-700">{Number(v.net_ht).toFixed(2)} €</div></div>
                      </div>
                      {v.sub_order_id ? (
                        <div className="mt-2 pt-2 border-t text-xs grid grid-cols-2 md:grid-cols-4 gap-2" style={{ borderColor: "#F1F5F9" }}>
                          <div><div className="text-slate-500">Sous-cmd TTC</div><div className="font-mono">{v.sub_ttc != null ? `${Number(v.sub_ttc).toFixed(2)} €` : "—"}</div></div>
                          <div><div className="text-slate-500">Δ TTC vs calculé</div><div className={`font-mono ${Math.abs(Number(v.delta_ttc || 0)) > 0.01 ? "text-amber-700 font-semibold" : "text-emerald-700"}`}>{v.delta_ttc != null ? `${Number(v.delta_ttc).toFixed(2)} €` : "—"}</div></div>
                          <div><div className="text-slate-500">Sous-cmd commission</div><div className="font-mono">{v.sub_commission != null ? `${Number(v.sub_commission).toFixed(2)} €` : "—"}</div></div>
                          <div><div className="text-slate-500">Δ commission</div><div className={`font-mono ${Math.abs(Number(v.delta_commission || 0)) > 0.01 ? "text-amber-700 font-semibold" : "text-emerald-700"}`}>{v.delta_commission != null ? `${Number(v.delta_commission).toFixed(2)} €` : "—"}</div></div>
                        </div>
                      ) : (
                        <div className="mt-2 pt-2 border-t text-xs text-slate-500 italic" style={{ borderColor: "#F1F5F9" }}>
                          Aucune sous-commande enregistrée pour ce vendeur (fan-out non exécuté ou commande manuelle non éclatée).
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-slate-400">
                Tolérance : ±0,01 € sur TTC et commission. Vérifié le {coherence.global.checked_at ? new Date(coherence.global.checked_at).toLocaleString("fr-BE") : "—"}.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCommandeDetail;
