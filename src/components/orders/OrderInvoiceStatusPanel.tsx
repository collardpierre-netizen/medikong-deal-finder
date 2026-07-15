import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Send, Wallet, Bell, Plus, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { fmtEur } from "@/lib/format-currency";

/**
 * Context describing a Stripe-confirmed card payment on the parent order.
 * When present, the "Paiement reçu" section is auto-filled and locked:
 * the encaissement is the source of truth and cannot be edited manually.
 */
type StripePaidCtx = {
  paidAt: string;         // ISO — best available Stripe confirmation timestamp
  amount: number;         // TTC in EUR
  method: "card";
  reference: string;      // stripe_payment_intent_id
};


type Invoice = {
  id: string;
  order_id: string;
  vendor_id: string;
  invoice_number: string | null;
  status: string;
  type: string;
  amount_excl_vat: number;
  vat_amount: number;
  amount_incl_vat: number;
  pdf_url: string | null;
  hosted_url: string | null;
  issued_at: string | null;
  due_date: string | null;
  sent_at: string | null;
  sent_channel: string | null;
  sent_to: string | null;
  paid_at: string | null;
  payment_amount_received: number | null;
  payment_method_received: string | null;
  payment_reference: string | null;
  last_reminder_at: string | null;
  reminder_count: number;
  internal_notes: string | null;
  updated_at: string;
};

interface Props {
  orderId: string;
  /** Si fourni, ne montre que les factures de ce fournisseur et pré-remplit le formulaire manuel. */
  vendorId?: string;
  /** Si fourni, propose de créer une facture manuelle avec ces montants par défaut. */
  defaultAmounts?: { excl_vat?: number; vat?: number; incl_vat?: number };
  /** Etiquette du fournisseur pour l'affichage. */
  vendorLabel?: string;
  className?: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:    { label: "En attente",       cls: "bg-slate-100 text-slate-700 border-slate-200" },
  generated:  { label: "Émise",            cls: "bg-blue-50 text-blue-700 border-blue-200" },
  sent:       { label: "Envoyée",          cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  finalized:  { label: "Finalisée",        cls: "bg-blue-50 text-blue-700 border-blue-200" },
  paid:       { label: "Payée",            cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  overdue:    { label: "En retard",        cls: "bg-amber-50 text-amber-800 border-amber-300" },
  failed:     { label: "Échec",            cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  edi: "EDI",
  peppol: "Peppol",
  postal: "Courrier",
  handover: "Remise en main propre",
  other: "Autre",
};

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Virement",
  sepa: "SEPA",
  card: "Carte",
  cash: "Espèces",
  stripe: "Stripe",
  other: "Autre",
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-slate-100 text-slate-700 border-slate-200" };
  return <span className={`inline-flex items-center border rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function toDatetimeInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OrderInvoiceStatusPanel({ orderId, vendorId, defaultAmounts, vendorLabel, className }: Props) {
  const qc = useQueryClient();
  const [manualOpen, setManualOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const invoicesQuery = useQuery({
    queryKey: ["order-invoices-panel", orderId, vendorId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("order_invoices")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (vendorId) q = q.eq("vendor_id", vendorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as Invoice[]) ?? [];
    },
  });

  // Fetch parent order to detect a Stripe-confirmed card payment.
  const orderQuery = useQuery({
    queryKey: ["order-invoices-panel-order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, payment_method, payment_status, stripe_payment_intent_id, total_incl_vat, updated_at, created_at")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        payment_method: string | null;
        payment_status: string | null;
        stripe_payment_intent_id: string | null;
        total_incl_vat: number | null;
        updated_at: string | null;
        created_at: string | null;
      } | null;
    },
  });

  const stripePaidCtx: StripePaidCtx | null = useMemo(() => {
    const o = orderQuery.data;
    if (!o) return null;
    const method = (o.payment_method ?? "").toLowerCase();
    const isCard = method === "card" || method === "stripe";
    if (!isCard) return null;
    if ((o.payment_status ?? "").toLowerCase() !== "paid") return null;
    if (!o.stripe_payment_intent_id) return null;
    return {
      paidAt: o.updated_at || o.created_at || new Date().toISOString(),
      amount: Number(o.total_incl_vat) || 0,
      method: "card",
      reference: o.stripe_payment_intent_id,
    };
  }, [orderQuery.data]);

  const invoices = invoicesQuery.data ?? [];
  const overduePending = useMemo(
    () => invoices.some((i) => i.status !== "paid" && i.due_date && new Date(i.due_date) < new Date()),
    [invoices],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ["order-invoices-panel", orderId] });

  // Auto-persist Stripe encaissement onto invoices that have no paid_at yet.
  // Runs at most once per invoice per session — the RPC itself is idempotent.
  const autoFilledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!stripePaidCtx) return;
    const targets = invoices.filter((i) => !i.paid_at && !autoFilledRef.current.has(i.id));
    if (targets.length === 0) return;
    (async () => {
      for (const inv of targets) {
        autoFilledRef.current.add(inv.id);
        const { error } = await supabase.rpc("update_order_invoice_billing", {
          _invoice_id: inv.id,
          _patch: {
            status: "paid",
            paid_at: stripePaidCtx.paidAt,
            payment_amount_received: stripePaidCtx.amount,
            payment_method_received: stripePaidCtx.method,
            payment_reference: stripePaidCtx.reference,
          },
        });
        if (error) {
          // Non-blocking: revert the guard so a later retry can happen.
          autoFilledRef.current.delete(inv.id);
        }
      }
      refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripePaidCtx, invoices]);

  return (
    <div className={`bg-white border rounded-lg ${className ?? ""}`} style={{ borderColor: "#E2E8F0" }}>
      <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "#E2E8F0" }}>
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-semibold">Facturation & paiement</div>
          <div className="text-sm text-slate-600">
            {vendorLabel ? `${vendorLabel} · ` : ""}
            {invoices.length === 0 ? "Aucune facture enregistrée" : `${invoices.length} facture${invoices.length > 1 ? "s" : ""}`}
            {overduePending && <span className="ml-2 text-amber-700 font-semibold">· Échéance dépassée</span>}
            {stripePaidCtx && (
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <Lock size={11} /> Encaissé par Stripe
              </span>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setManualOpen(true)} className="gap-1.5">
          <Plus size={14} /> Enregistrer une facture
        </Button>
      </div>


      {invoicesQuery.isLoading && (
        <div className="p-4 text-sm text-slate-500">Chargement…</div>
      )}

      {!invoicesQuery.isLoading && invoices.length === 0 && (
        <div className="p-4 text-sm text-slate-500">
          Aucune facture liée à cette commande. Utilisez « Enregistrer une facture » pour saisir la référence, la date, l'échéance et le PDF.
        </div>
      )}

      <div className="divide-y" style={{ borderColor: "#E2E8F0" }}>
        {invoices.map((inv) => (
          <div key={inv.id} className="p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <FileText size={14} className="text-slate-400" />
                <span className="font-semibold text-sm text-slate-800">
                  {inv.invoice_number || <span className="italic text-slate-500">Sans numéro</span>}
                </span>
                <StatusBadge status={inv.status} />
                {inv.status !== "paid" && inv.due_date && new Date(inv.due_date) < new Date() && (
                  <span className="inline-flex items-center border rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800 border-amber-300">
                    En retard
                  </span>
                )}
                <span className="text-[11px] text-slate-500 uppercase font-semibold">
                  {inv.type === "commission" ? "Commission" : "Auto-facturation"}
                </span>
              </div>
              <div className="text-sm font-semibold text-slate-800">{fmtEur(Number(inv.amount_incl_vat))}&nbsp;€ TTC</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
              <div>
                <div className="text-slate-400 uppercase text-[10px] font-semibold">Émise le</div>
                <div>{fmtDate(inv.issued_at)}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase text-[10px] font-semibold">Échéance</div>
                <div>{fmtDate(inv.due_date)}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase text-[10px] font-semibold">Envoyée</div>
                <div>
                  {inv.sent_at ? (
                    <>
                      {fmtDate(inv.sent_at)}
                      {inv.sent_channel && <span className="text-slate-400"> · {CHANNEL_LABEL[inv.sent_channel] ?? inv.sent_channel}</span>}
                    </>
                  ) : (
                    <span className="text-slate-400">Non envoyée</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-400 uppercase text-[10px] font-semibold">Paiement</div>
                <div>
                  {inv.paid_at ? (
                    <>
                      {fmtDate(inv.paid_at)}
                      {inv.payment_method_received && (
                        <span className="text-slate-400"> · {METHOD_LABEL[inv.payment_method_received] ?? inv.payment_method_received}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400">Non encaissé</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {inv.pdf_url && (
                <a href={inv.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
                  <ExternalLink size={12} /> Ouvrir le PDF
                </a>
              )}
              {inv.hosted_url && (
                <a href={inv.hosted_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
                  <ExternalLink size={12} /> Page hébergée
                </a>
              )}
              {inv.reminder_count > 0 && (
                <span className="text-[11px] text-slate-500">
                  <Bell size={11} className="inline mr-0.5" />
                  {inv.reminder_count} relance{inv.reminder_count > 1 ? "s" : ""} · dernière {fmtDate(inv.last_reminder_at)}
                </span>
              )}
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditingId(inv.id)}>
                  Modifier
                </Button>
              </div>
            </div>
            {inv.internal_notes && (
              <div className="text-[11px] italic text-slate-500 border-l-2 border-slate-200 pl-2">{inv.internal_notes}</div>
            )}
          </div>
        ))}
      </div>

      {manualOpen && (
        <ManualInvoiceDialog
          orderId={orderId}
          vendorId={vendorId}
          defaultAmounts={defaultAmounts}
          onClose={() => setManualOpen(false)}
          onSaved={() => { setManualOpen(false); refresh(); }}
        />
      )}

      {editingId && (
        <EditInvoiceDialog
          invoice={invoices.find((i) => i.id === editingId)!}
          stripePaidCtx={stripePaidCtx}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual invoice dialog
// ---------------------------------------------------------------------------

function ManualInvoiceDialog({
  orderId, vendorId, defaultAmounts, onClose, onSaved,
}: {
  orderId: string;
  vendorId?: string;
  defaultAmounts?: { excl_vat?: number; vat?: number; incl_vat?: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vId, setVId] = useState(vendorId ?? "");
  const [number, setNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState(toDateInputValue(new Date().toISOString()));
  const [dueDate, setDueDate] = useState("");
  const [excl, setExcl] = useState<string>(defaultAmounts?.excl_vat != null ? String(defaultAmounts.excl_vat) : "");
  const [vat, setVat] = useState<string>(defaultAmounts?.vat != null ? String(defaultAmounts.vat) : "");
  const [incl, setIncl] = useState<string>(defaultAmounts?.incl_vat != null ? String(defaultAmounts.incl_vat) : "");
  const [pdfUrl, setPdfUrl] = useState("");

  const vendorSuggestions = useQuery({
    queryKey: ["order-vendors-for-invoice", orderId],
    enabled: !vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_lines")
        .select("vendor_id, vendors:vendor_id(name, company_name)")
        .eq("order_id", orderId);
      if (error) throw error;
      const seen = new Set<string>();
      const out: { id: string; label: string }[] = [];
      for (const row of (data as any[]) || []) {
        if (!row.vendor_id || seen.has(row.vendor_id)) continue;
        seen.add(row.vendor_id);
        out.push({ id: row.vendor_id, label: row.vendors?.company_name || row.vendors?.name || row.vendor_id.slice(0, 6) });
      }
      return out;
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!vId) throw new Error("Fournisseur requis");
      if (!number.trim()) throw new Error("Numéro de facture requis");
      const { data, error } = await supabase.rpc("upsert_manual_order_invoice", {
        _order_id: orderId,
        _vendor_id: vId,
        _invoice_number: number.trim(),
        _issued_at: issuedAt ? new Date(issuedAt).toISOString() : null,
        _due_date: dueDate || null,
        _amount_excl_vat: excl ? Number(excl) : 0,
        _vat_amount: vat ? Number(vat) : 0,
        _amount_incl_vat: incl ? Number(incl) : 0,
        _pdf_url: pdfUrl.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Facture enregistrée"); onSaved(); },
    onError: (e: any) => toast.error(e?.message || "Échec"),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enregistrer une facture</DialogTitle>
          <DialogDescription>Saisie manuelle d'une facture émise hors plateforme (ou déjà générée).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!vendorId && (
            <div>
              <Label>Fournisseur</Label>
              <Select value={vId} onValueChange={setVId}>
                <SelectTrigger><SelectValue placeholder="Choisir le fournisseur" /></SelectTrigger>
                <SelectContent>
                  {(vendorSuggestions.data ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>N° de facture</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="FA-2026-001" />
            </div>
            <div>
              <Label>Date d'émission</Label>
              <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Échéance</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>URL PDF</Label>
              <Input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>HT (€)</Label>
              <Input type="number" step="0.01" value={excl} onChange={(e) => setExcl(e.target.value)} />
            </div>
            <div>
              <Label>TVA (€)</Label>
              <Input type="number" step="0.01" value={vat} onChange={(e) => setVat(e.target.value)} />
            </div>
            <div>
              <Label>TTC (€)</Label>
              <Input type="number" step="0.01" value={incl} onChange={(e) => setIncl(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit invoice dialog (statut / envoi / paiement / relance)
// ---------------------------------------------------------------------------

function EditInvoiceDialog({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(invoice.status);
  const [dueDate, setDueDate] = useState(toDateInputValue(invoice.due_date));
  const [sentAt, setSentAt] = useState(toDatetimeInputValue(invoice.sent_at));
  const [sentChannel, setSentChannel] = useState<string>(invoice.sent_channel ?? "");
  const [sentTo, setSentTo] = useState(invoice.sent_to ?? "");
  const [paidAt, setPaidAt] = useState(toDatetimeInputValue(invoice.paid_at));
  const [paidAmount, setPaidAmount] = useState(invoice.payment_amount_received != null ? String(invoice.payment_amount_received) : "");
  const [paidMethod, setPaidMethod] = useState<string>(invoice.payment_method_received ?? "");
  const [paidRef, setPaidRef] = useState(invoice.payment_reference ?? "");
  const [notes, setNotes] = useState(invoice.internal_notes ?? "");

  const qc = useQueryClient();

  const savePatch = async (patch: Record<string, any>) => {
    const { error } = await supabase.rpc("update_order_invoice_billing", {
      _invoice_id: invoice.id,
      _patch: patch,
    });
    if (error) throw error;
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const patch: Record<string, any> = {
        status,
        due_date: dueDate,
        sent_at: sentAt ? new Date(sentAt).toISOString() : "",
        sent_channel: sentChannel,
        sent_to: sentTo,
        paid_at: paidAt ? new Date(paidAt).toISOString() : "",
        payment_amount_received: paidAmount,
        payment_method_received: paidMethod,
        payment_reference: paidRef,
        internal_notes: notes,
      };
      // Automations douces
      if (patch.paid_at && status !== "paid") patch.status = "paid";
      if (!patch.paid_at && patch.sent_at && status === "pending") patch.status = "sent";
      await savePatch(patch);
    },
    onSuccess: () => { toast.success("Facture mise à jour"); onSaved(); },
    onError: (e: any) => toast.error(e?.message || "Échec"),
  });

  const remindMut = useMutation({
    mutationFn: async () => {
      await savePatch({ increment_reminder: true, last_reminder_at: new Date().toISOString() });
    },
    onSuccess: () => {
      toast.success("Relance enregistrée");
      qc.invalidateQueries({ queryKey: ["order-invoices-panel", invoice.order_id] });
    },
    onError: (e: any) => toast.error(e?.message || "Échec"),
  });

  const quickMarkSent = () => {
    if (!sentAt) setSentAt(toDatetimeInputValue(new Date().toISOString()));
    if (!sentChannel) setSentChannel("email");
    if (status === "pending" || status === "generated") setStatus("sent");
  };
  const quickMarkPaid = () => {
    if (!paidAt) setPaidAt(toDatetimeInputValue(new Date().toISOString()));
    if (!paidAmount) setPaidAmount(String(invoice.amount_incl_vat ?? ""));
    setStatus("paid");
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Facture {invoice.invoice_number || invoice.id.slice(0, 6)}</DialogTitle>
          <DialogDescription>
            {fmtEur(Number(invoice.amount_incl_vat))} € TTC · émise le {fmtDate(invoice.issued_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={quickMarkSent} className="gap-1.5"><Send size={13} /> Marquer envoyée</Button>
          <Button size="sm" variant="outline" onClick={quickMarkPaid} className="gap-1.5"><Wallet size={13} /> Marquer payée</Button>
          <Button size="sm" variant="outline" onClick={() => remindMut.mutate()} disabled={remindMut.isPending} className="gap-1.5">
            <Bell size={13} /> Consigner une relance
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <Label>Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Échéance</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="pt-3 border-t" style={{ borderColor: "#E2E8F0" }}>
          <div className="text-[11px] uppercase text-slate-400 font-semibold mb-2">Envoi au client</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Envoyée le</Label>
              <Input type="datetime-local" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
            </div>
            <div>
              <Label>Canal</Label>
              <Select value={sentChannel || "__none__"} onValueChange={(v) => setSentChannel(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Destinataire</Label>
              <Input value={sentTo} onChange={(e) => setSentTo(e.target.value)} placeholder="compta@client.be" />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t" style={{ borderColor: "#E2E8F0" }}>
          <div className="text-[11px] uppercase text-slate-400 font-semibold mb-2">Paiement encaissé</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Reçu le</Label>
              <Input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div>
              <Label>Montant (€)</Label>
              <Input type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
            </div>
            <div>
              <Label>Méthode</Label>
              <Select value={paidMethod || "__none__"} onValueChange={(v) => setPaidMethod(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {Object.entries(METHOD_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Référence</Label>
              <Input value={paidRef} onChange={(e) => setPaidRef(e.target.value)} placeholder="Communication / IBAN…" />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t" style={{ borderColor: "#E2E8F0" }}>
          <Label>Notes internes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
