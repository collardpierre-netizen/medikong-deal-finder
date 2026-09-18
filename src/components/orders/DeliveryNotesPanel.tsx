import { useMemo, useState } from "react";
import { FileDown, Loader2, PackageCheck, Ban, RotateCcw, Mail, PenLine, Link2, Unlock, Truck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { generateDeliveryNotePdf } from "@/lib/delivery-note-pdf";
import { CHECKLIST_ITEMS } from "@/lib/delivery-checklist";
import {
  BACKORDER_LABELS,
  useCancelDeliveryNote,
  useCreateDeliveryNote,
  useOrderDeliveryNotes,
  useOrderDeliveryStatus,
  useSendDeliveryConfirmationRequest,
  useSetBackorderStatus,
  useSetDeliveryPaymentRelease,
  type DeliveryNote,
  type DeliveryStatusRow,
} from "@/hooks/useDeliveryNotes";

const RELEASE_LABELS: Record<string, string> = {
  full: "Paiement fournisseur autorisé (complet)",
  partial: "Paiement fournisseur autorisé (partiel)",
  blocked: "Paiement fournisseur bloqué",
};

interface Props {
  orderId: string;
  orderNumber?: string | null;
  customerName?: string | null;
  /** Pays client (ISO-2) — mention TVA 0 % sur le BL. */
  customerCountryCode?: string | null;
  /** N° TVA intracommunautaire client — affiché sur le BL. */
  customerVatNumber?: string | null;
  shippingAddress?: Record<string, any> | null;
  /** Statut de la commande : si "draft", les BL sont marqués BROUILLON. */
  orderStatus?: string | null;
  /** Affiche le bloc admin « déblocage du paiement fournisseur ». */
  canReleasePayment?: boolean;
  /** Prix unitaire HT (en €) par ligne de commande — sert à proposer le montant autorisé. */
  unitPricesByLine?: Record<string, number>;
}

export default function DeliveryNotesPanel({ orderId, orderNumber, customerName, customerCountryCode, customerVatNumber, shippingAddress, orderStatus, canReleasePayment = false, unitPricesByLine }: Props) {
  const isDraftOrder = String(orderStatus || "").toLowerCase() === "draft";
  const statusQuery = useOrderDeliveryStatus(orderId);
  const notesQuery = useOrderDeliveryNotes(orderId);
  const createMut = useCreateDeliveryNote(orderId);
  const cancelMut = useCancelDeliveryNote(orderId);
  const backorderMut = useSetBackorderStatus(orderId);
  const sendLinkMut = useSendDeliveryConfirmationRequest(orderId);
  const releaseMut = useSetDeliveryPaymentRelease(orderId);

  const rows = statusQuery.data ?? [];
  const notes = notesQuery.data ?? [];

  const [qty, setQty] = useState<Record<string, number>>({});
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [trackingNoteId, setTrackingNoteId] = useState<string | null>(null);

  const totals = useMemo(() => {
    const ordered = rows.reduce((s, r) => s + Number(r.quantity || 0), 0);
    const delivered = rows.reduce((s, r) => s + Number(r.delivered_quantity || 0), 0);
    const remaining = rows.reduce((s, r) => s + Number(r.remaining_quantity || 0), 0);
    return { ordered, delivered, remaining };
  }, [rows]);

  const selected = rows
    .filter((r) => (qty[r.order_line_id] ?? 0) > 0)
    .map((r) => ({ order_line_id: r.order_line_id, quantity: Math.min(qty[r.order_line_id], r.remaining_quantity) }));

  const fillAll = () => {
    const next: Record<string, number> = {};
    rows.forEach((r) => { if (r.remaining_quantity > 0) next[r.order_line_id] = r.remaining_quantity; });
    setQty(next);
  };

  const submit = async () => {
    if (selected.length === 0) {
      toast({ title: "Aucune ligne", description: "Indiquez au moins une quantité à livrer.", variant: "destructive" });
      return;
    }
    try {
      const res = await createMut.mutateAsync({ lines: selected, carrier, tracking_number: tracking, note });
      setQty({}); setCarrier(""); setTracking(""); setNote("");
      if (res.emailSent) {
        toast({ title: "Bon de livraison créé", description: "E-mail envoyé au client avec la checklist et le lien de signature." });
      } else {
        toast({
          title: "Bon de livraison créé",
          description: res.emailError
            ? `E-mail non envoyé : ${res.emailError}`
            : "E-mail non envoyé au client.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Création impossible", description: e.message, variant: "destructive" });
    }
  };

  const downloadPdf = (dnId: string) => {
    const dn = notes.find((n) => n.id === dnId);
    if (!dn) return;
    const byLine = new Map(dn.delivery_note_lines.map((l) => [l.order_line_id, l.quantity]));
    const pdfRows = rows
      .filter((r) => byLine.has(r.order_line_id))
      .map((r) => ({
        name: r.product_name || "Produit",
        cnk: r.cnk_code,
        gtin: r.gtin,
        ordered: r.quantity,
        delivered: byLine.get(r.order_line_id) || 0,
        remaining: Math.max(r.quantity - (byLine.get(r.order_line_id) || 0), 0),
      }));
    generateDeliveryNotePdf({
      documentNumber: dn.document_number,
      issuedAt: dn.issued_at,
      status: dn.status,
      isDraft: isDraftOrder,
      orderNumber: orderNumber ?? null,
      customerName,
      customerCountryCode: customerCountryCode ?? null,
      customerVatNumber: customerVatNumber ?? null,
      shippingAddress,
      carrier: dn.carrier,
      trackingNumber: dn.tracking_number,
      note: dn.note,
      rows: pdfRows,
      checklistItems:
        dn.checklist?.items?.map((i) => ({ label: i.label, checked: i.checked })) ??
        CHECKLIST_ITEMS.map((i) => ({ label: i.label })),
      confirmation: dn.confirmed_at
        ? {
            confirmedAt: dn.confirmed_at,
            confirmedByName: dn.confirmed_by_name,
            remarks: dn.client_remarks,
          }
        : null,
    });
  };

  /** Montant HT (en €) réellement accepté par le client sur ce bon de livraison. */
  const acceptedAmount = (dn: DeliveryNote): number =>
    dn.delivery_note_lines.reduce((sum, l) => {
      const unit = unitPricesByLine?.[l.order_line_id] ?? 0;
      const qty = l.accepted_quantity ?? l.quantity;
      return sum + unit * qty;
    }, 0);

  const sendLink = async (dnId: string) => {
    try {
      const res = await sendLinkMut.mutateAsync({ deliveryNoteId: dnId });
      toast({ title: "Lien de signature envoyé", description: res?.recipient });
    } catch (e: any) {
      toast({ title: "Envoi impossible", description: e.message, variant: "destructive" });
    }
  };

  const decide = async (dn: DeliveryNote, decision: "full" | "partial" | "blocked") => {
    let reason: string | undefined;
    if (decision === "blocked") {
      reason = window.prompt("Motif du blocage du paiement fournisseur ?") ?? undefined;
      if (!reason || !reason.trim()) return;
    }
    const amount =
      decision === "blocked"
        ? 0
        : Math.round(
            (decision === "full"
              ? dn.delivery_note_lines.reduce(
                  (s, l) => s + (unitPricesByLine?.[l.order_line_id] ?? 0) * l.quantity,
                  0,
                )
              : acceptedAmount(dn)) * 100,
          );
    try {
      await releaseMut.mutateAsync({
        delivery_note_id: dn.id,
        decision,
        authorized_amount_ht_cents: amount,
        reason,
      });
      toast({ title: RELEASE_LABELS[decision] });
    } catch (e: any) {
      toast({ title: "Décision impossible", description: e.message, variant: "destructive" });
    }
  };

  const setBackorder = async (r: DeliveryStatusRow, status: string) => {
    try {
      await backorderMut.mutateAsync({ order_line_id: r.order_line_id, status: status === "none" ? null : status });
    } catch (e: any) {
      toast({ title: "Mise à jour impossible", description: e.message, variant: "destructive" });
    }
  };

  if (statusQuery.isLoading) {
    return (
      <div className="bg-white border rounded-lg p-6 flex items-center gap-2 text-sm text-slate-500" style={{ borderColor: "#E2E8F0" }}>
        <Loader2 className="w-4 h-4 animate-spin" /> Chargement des livraisons…
      </div>
    );
  }
  if (rows.length === 0) return null;

  return (
    <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      <div className="px-4 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: "#E2E8F0" }}>
        <div className="flex items-center gap-2">
          <PackageCheck className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-slate-800 text-sm">Bons de livraison</h3>
        </div>
        <div className="text-xs text-slate-500">
          {totals.delivered} / {totals.ordered} livré(s)
          {totals.remaining > 0 && <span className="ml-2 text-amber-700 font-medium">· {totals.remaining} en back order</span>}
        </div>
      </div>

      {/* Préparation d'un nouveau BL */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Saisissez les quantités livrées (livraison totale ou partielle).</p>
          <Button size="sm" variant="outline" onClick={fillAll} disabled={totals.remaining === 0}>
            Tout livrer
          </Button>
        </div>

        <div className="border rounded overflow-x-auto" style={{ borderColor: "#E2E8F0" }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "#F8FAFC" }}>
              <tr>
                <th className="text-left px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Article</th>
                <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Cmd</th>
                <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Livré</th>
                <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Reliquat</th>
                <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">À livrer</th>
                <th className="text-left px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Back order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.order_line_id} className="border-t" style={{ borderColor: "#F1F5F9" }}>
                  <td className="px-3 py-2">
                    <div className="text-slate-800">{r.product_name || "Produit"}</div>
                    {r.cnk_code && <div className="text-[11px] text-slate-400 font-mono">CNK {r.cnk_code}</div>}
                  </td>
                  <td className="px-3 py-2 text-right">{r.quantity}</td>
                  <td className="px-3 py-2 text-right">{r.delivered_quantity}</td>
                  <td className="px-3 py-2 text-right font-medium text-amber-700">{r.remaining_quantity}</td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      min={0}
                      max={r.remaining_quantity}
                      disabled={r.remaining_quantity === 0}
                      value={qty[r.order_line_id] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? 0 : Math.max(0, Math.min(Number(e.target.value), r.remaining_quantity));
                        setQty((q) => ({ ...q, [r.order_line_id]: v }));
                      }}
                      className="w-20 h-8 ml-auto text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={r.backorder_status ?? "none"}
                      onValueChange={(v) => setBackorder(r, v)}
                      disabled={r.remaining_quantity === 0}
                    >
                      <SelectTrigger className="h-8 w-[170px] text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="open">{BACKORDER_LABELS.open}</SelectItem>
                        <SelectItem value="cancelled">{BACKORDER_LABELS.cancelled}</SelectItem>
                        <SelectItem value="undeliverable">{BACKORDER_LABELS.undeliverable}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input placeholder="Transporteur (optionnel)" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          <Input placeholder="N° de suivi (optionnel)" value={tracking} onChange={(e) => setTracking(e.target.value)} />
          <Button onClick={submit} disabled={createMut.isPending || selected.length === 0}>
            {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Créer le bon de livraison
          </Button>
        </div>
        <Textarea placeholder="Note sur le bon de livraison (optionnel)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {/* Historique */}
      <div className="border-t px-4 py-3 space-y-2" style={{ borderColor: "#E2E8F0" }}>
        <h4 className="text-[11px] uppercase font-semibold text-slate-500">Bons émis</h4>
        {notes.length === 0 && <p className="text-sm text-slate-400">Aucun bon de livraison pour cette commande.</p>}
        {notes.map((dn) => {
          const qtyTotal = dn.delivery_note_lines.reduce((s, l) => s + l.quantity, 0);
          const release = dn.delivery_payment_releases?.[0];
          const refused = dn.delivery_note_lines.reduce((s, l) => s + (l.refused_quantity ?? 0), 0);
          return (
            <div key={dn.id} className="border rounded px-3 py-2 space-y-2" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800 text-sm">{dn.document_number || "Sans numéro"}</span>
                  {dn.status === "cancelled" ? (
                    <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">Annulé</Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">Émis</Badge>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {new Date(dn.issued_at).toLocaleString("fr-BE")} · {dn.delivery_note_lines.length} ligne(s) · {qtyTotal} unité(s)
                  {dn.carrier ? ` · ${dn.carrier}` : ""}{dn.tracking_number ? ` · ${dn.tracking_number}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => downloadPdf(dn.id)}>
                  <FileDown className="w-3.5 h-3.5 mr-1" /> PDF
                </Button>
                {dn.status === "issued" && !dn.confirmed_at && (
                  <Button size="sm" variant="outline" disabled={sendLinkMut.isPending} onClick={() => sendLink(dn.id)}>
                    {sendLinkMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                    {dn.confirmation_sent_at ? "Renvoyer le lien" : "Envoyer le lien de signature"}
                  </Button>
                )}
                {dn.status === "issued" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    disabled={cancelMut.isPending}
                    onClick={async () => {
                      try {
                        await cancelMut.mutateAsync({ id: dn.id });
                        toast({ title: "Bon de livraison annulé" });
                      } catch (e: any) {
                        toast({ title: "Annulation impossible", description: e.message, variant: "destructive" });
                      }
                    }}
                  >
                    {cancelMut.isPending ? <RotateCcw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Ban className="w-3.5 h-3.5 mr-1" />}
                    Annuler
                  </Button>
                )}
              </div>
            </div>

            {/* Confirmation client */}
            {dn.status === "issued" && (
              <div className="text-[11px] rounded px-2 py-1.5" style={{ backgroundColor: "#F8FAFC" }}>
                {dn.confirmed_at ? (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-emerald-700 font-medium">
                      <PenLine className="w-3.5 h-3.5" />
                      Signé par {dn.confirmed_by_name || "—"} le {new Date(dn.confirmed_at).toLocaleString("fr-BE")}
                    </div>
                    {refused > 0 && <div className="text-amber-700">{refused} unité(s) refusée(s) par le client.</div>}
                    {dn.client_remarks && <div className="text-slate-600">Remarques : {dn.client_remarks}</div>}
                  </div>
                ) : dn.confirmation_sent_at ? (
                  <div className="flex items-center gap-1 text-slate-600">
                    <Link2 className="w-3.5 h-3.5" />
                    Lien envoyé le {new Date(dn.confirmation_sent_at).toLocaleString("fr-BE")} — en attente de signature client.
                  </div>
                ) : (
                  <div className="text-slate-500">Checklist et signature client pas encore demandées.</div>
                )}
              </div>
            )}

            {/* Déblocage du paiement fournisseur (admin) */}
            {canReleasePayment && dn.status === "issued" && (
              <div className="text-[11px] border-t pt-2" style={{ borderColor: "#E2E8F0" }}>
                {release ? (
                  <div className="flex items-center gap-1 text-slate-700">
                    <Unlock className="w-3.5 h-3.5" />
                    {RELEASE_LABELS[release.decision]} · {(release.authorized_amount_ht_cents / 100).toFixed(2)} € HT
                    {release.reason ? ` · ${release.reason}` : ""} ·{" "}
                    {new Date(release.decided_at).toLocaleString("fr-BE")}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500">Paiement fournisseur :</span>
                    <Button size="sm" variant="outline" disabled={releaseMut.isPending} onClick={() => decide(dn, "full")}>
                      Débloquer en totalité
                    </Button>
                    <Button size="sm" variant="outline" disabled={releaseMut.isPending} onClick={() => decide(dn, "partial")}>
                      Débloquer partiellement ({acceptedAmount(dn).toFixed(2)} € HT)
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      disabled={releaseMut.isPending}
                      onClick={() => decide(dn, "blocked")}
                    >
                      Bloquer
                    </Button>
                  </div>
                )}
              </div>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
