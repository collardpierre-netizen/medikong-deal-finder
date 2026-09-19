// Admin — Suivi complet par commande : devis, bon de commande, bon de livraison,
// signature, paiement débloqué, remise en stock. Lecture seule.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtEur } from "@/lib/format-currency";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileSignature,
  FileText,
  Package,
  RotateCcw,
  Search,
  Truck,
  Wallet,
} from "lucide-react";

type StepKey = "quote" | "order" | "delivery" | "signature" | "release" | "restock";

type OrderRow = {
  orderId: string;
  orderNumber: string;
  orderStatus: string | null;
  paymentStatus: string | null;
  createdAt: string | null;
  customerLabel: string;
  amountTtc: number | null;
  quoteId: string | null;
  quoteNumber: string | null;
  quoteStatus: string | null;
  notes: {
    id: string;
    number: string;
    status: string | null;
    carrier: string | null;
    tracking: string | null;
    issuedAt: string | null;
    confirmedAt: string | null;
    confirmedByName: string | null;
    remarks: string | null;
    release: { decision: string; amountHtCents: number | null; decidedAt: string | null; reason: string | null } | null;
    refusedUnits: number;
  }[];
  cancelledLines: number;
  cancelledUnits: number;
  refusedUnits: number;
  stage: number; // 1..6
};

const RELEASE_LABEL: Record<string, string> = {
  full: "Versement complet",
  partial: "Versement partiel",
  none: "Versement bloqué",
  blocked: "Versement bloqué",
};

const STAGE_LABEL = ["—", "Devis", "Bon de commande", "Bon de livraison", "Signature", "Paiement débloqué", "Remise en stock"];

const STEP_ICON: Record<StepKey, typeof FileText> = {
  quote: FileText,
  order: Package,
  delivery: Truck,
  signature: FileSignature,
  release: Wallet,
  restock: RotateCcw,
};

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-BE") : "—");
const fmtDateTime = (v: string | null) => (v ? new Date(v).toLocaleString("fr-BE") : "—");

export default function AdminSuiviCommande() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: rows = [], isLoading, error } = useQuery<OrderRow[]>({
    queryKey: ["admin-suivi-commande"],
    queryFn: async () => {
      const { data: orders, error: ordErr } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, payment_status, created_at, total_incl_vat, customer_id, customers(company_name, email)"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(400);
      if (ordErr) throw ordErr;

      const orderIds = (orders ?? []).map((o: any) => o.id);
      if (!orderIds.length) return [];

      const [quotesRes, notesRes, linesRes] = await Promise.all([
        supabase.from("quotes").select("id, quote_number, status, order_id").in("order_id", orderIds),
        supabase
          .from("delivery_notes")
          .select(
            "id, order_id, document_number, status, carrier, tracking_number, issued_at, confirmed_at, confirmed_by_name, client_remarks"
          )
          .in("order_id", orderIds),
        supabase
          .from("order_lines")
          .select("id, order_id, quantity, fulfillment_status")
          .in("order_id", orderIds),
      ]);
      if (quotesRes.error) throw quotesRes.error;
      if (notesRes.error) throw notesRes.error;
      if (linesRes.error) throw linesRes.error;

      const notes = notesRes.data ?? [];
      const noteIds = notes.map((n: any) => n.id);

      let releases: any[] = [];
      let noteLines: any[] = [];
      if (noteIds.length) {
        const [relRes, nlRes] = await Promise.all([
          supabase
            .from("delivery_payment_releases")
            .select("delivery_note_id, decision, authorized_amount_ht_cents, reason, decided_at")
            .in("delivery_note_id", noteIds),
          supabase
            .from("delivery_note_lines")
            .select("delivery_note_id, refused_quantity")
            .in("delivery_note_id", noteIds),
        ]);
        if (relRes.error) throw relRes.error;
        if (nlRes.error) throw nlRes.error;
        releases = relRes.data ?? [];
        noteLines = nlRes.data ?? [];
      }

      const releaseByNote = new Map<string, any>();
      for (const r of releases) {
        const prev = releaseByNote.get(r.delivery_note_id);
        if (!prev || (r.decided_at ?? "") > (prev.decided_at ?? "")) releaseByNote.set(r.delivery_note_id, r);
      }

      const refusedByNote = new Map<string, number>();
      for (const l of noteLines) {
        refusedByNote.set(l.delivery_note_id, (refusedByNote.get(l.delivery_note_id) ?? 0) + Number(l.refused_quantity ?? 0));
      }

      const quoteByOrder = new Map<string, any>();
      for (const q of quotesRes.data ?? []) if (q.order_id) quoteByOrder.set(q.order_id, q);

      const notesByOrder = new Map<string, any[]>();
      for (const n of notes) {
        const arr = notesByOrder.get(n.order_id) ?? [];
        arr.push(n);
        notesByOrder.set(n.order_id, arr);
      }

      const cancelledByOrder = new Map<string, { lines: number; units: number }>();
      for (const l of linesRes.data ?? []) {
        if (l.fulfillment_status !== "cancelled") continue;
        const agg = cancelledByOrder.get(l.order_id) ?? { lines: 0, units: 0 };
        agg.lines += 1;
        agg.units += Number(l.quantity ?? 0);
        cancelledByOrder.set(l.order_id, agg);
      }

      const label = (c: any, id: string | null) =>
        c?.company_name || c?.email || (id ? `Client ${id.slice(0, 8)}` : "Client inconnu");

      return (orders ?? []).map((o: any) => {
        const quote = quoteByOrder.get(o.id) ?? null;
        const rawNotes = (notesByOrder.get(o.id) ?? []).sort((a, b) =>
          (b.issued_at ?? "").localeCompare(a.issued_at ?? "")
        );
        const mapped = rawNotes.map((n: any) => {
          const rel = releaseByNote.get(n.id) ?? null;
          return {
            id: n.id,
            number: n.document_number,
            status: n.status ?? null,
            carrier: n.carrier ?? null,
            tracking: n.tracking_number ?? null,
            issuedAt: n.issued_at ?? null,
            confirmedAt: n.confirmed_at ?? null,
            confirmedByName: n.confirmed_by_name ?? null,
            remarks: n.client_remarks ?? null,
            release: rel
              ? {
                  decision: rel.decision,
                  amountHtCents: rel.authorized_amount_ht_cents ?? null,
                  decidedAt: rel.decided_at ?? null,
                  reason: rel.reason ?? null,
                }
              : null,
            refusedUnits: refusedByNote.get(n.id) ?? 0,
          };
        });
        const active = mapped.filter((n) => n.status !== "cancelled");
        const cancelled = cancelledByOrder.get(o.id) ?? { lines: 0, units: 0 };
        const refusedUnits = active.reduce((s, n) => s + n.refusedUnits, 0);

        let stage = 2;
        if (active.length) stage = 3;
        if (active.some((n) => n.confirmedAt)) stage = 4;
        if (active.some((n) => n.release)) stage = 5;
        if (refusedUnits > 0 || cancelled.units > 0) stage = 6;

        return {
          orderId: o.id,
          orderNumber: o.order_number,
          orderStatus: o.status ?? null,
          paymentStatus: o.payment_status ?? null,
          createdAt: o.created_at ?? null,
          customerLabel: label(o.customers, o.customer_id ?? null),
          amountTtc: o.total_incl_vat != null ? Number(o.total_incl_vat) : null,
          quoteId: quote?.id ?? null,
          quoteNumber: quote?.quote_number ?? null,
          quoteStatus: quote?.status ?? null,
          notes: mapped,
          cancelledLines: cancelled.lines,
          cancelledUnits: cancelled.units,
          refusedUnits,
          stage,
        } as OrderRow;
      });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (stageFilter !== "all" && String(r.stage) !== stageFilter) return false;
      if (!q) return true;
      return [r.orderNumber, r.quoteNumber, r.customerLabel, ...r.notes.map((n) => n.number)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, stageFilter]);

  const kpis = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (const r of filtered) c[r.stage] += 1;
    return c;
  }, [filtered]);

  return (
    <div>
      <AdminTopBar
        title="Suivi par commande"
        subtitle="Devis → bon de commande → bon de livraison → signature → paiement débloqué → remise en stock"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[2, 3, 4, 5, 6].map((s) => (
          <div key={s} className="bg-white border rounded-lg p-3" style={{ borderColor: "#E2E8F0" }}>
            <div className="text-[11px] uppercase font-semibold text-slate-500">{STAGE_LABEL[s]}</div>
            <div className="text-xl font-semibold">{kpis[s]}</div>
            <div className="text-xs text-slate-500">commande(s) à cette étape</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Commande, devis, BL, client…"
            className="pl-8 w-72"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Étape atteinte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les étapes</SelectItem>
            {[2, 3, 4, 5, 6].map((s) => (
              <SelectItem key={s} value={String(s)}>
                Étape : {STAGE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">{filtered.length} commande(s)</span>
      </div>

      {error && <div className="p-4 text-sm text-red-600">Chargement impossible : {(error as any).message}</div>}
      {isLoading && <div className="p-4 text-sm text-slate-500">Chargement…</div>}

      <div className="space-y-3">
        {filtered.map((r) => {
          const isOpen = expanded[r.orderId] ?? false;
          const activeNotes = r.notes.filter((n) => n.status !== "cancelled");
          const signed = activeNotes.filter((n) => n.confirmedAt);
          const releases = activeNotes.filter((n) => n.release);
          const releasedHt = releases.reduce((s, n) => s + Number(n.release?.amountHtCents ?? 0), 0) / 100;
          const steps: { key: StepKey; label: string; done: boolean; detail: string; at: string | null }[] = [
            {
              key: "quote",
              label: "Devis",
              done: !!r.quoteId,
              detail: r.quoteNumber ? `${r.quoteNumber}${r.quoteStatus ? ` · ${r.quoteStatus}` : ""}` : "Pas de devis lié",
              at: null,
            },
            {
              key: "order",
              label: "Bon de commande",
              done: true,
              detail: `${r.orderNumber}${r.orderStatus ? ` · ${r.orderStatus}` : ""}`,
              at: r.createdAt,
            },
            {
              key: "delivery",
              label: "Bon de livraison",
              done: activeNotes.length > 0,
              detail: activeNotes.length
                ? activeNotes.map((n) => n.number).join(", ")
                : "Aucun bon de livraison",
              at: activeNotes[0]?.issuedAt ?? null,
            },
            {
              key: "signature",
              label: "Signature",
              done: signed.length > 0,
              detail: signed.length
                ? `${signed.length} signé(s)${signed[0]?.confirmedByName ? ` · ${signed[0].confirmedByName}` : ""}`
                : "Pas encore signé",
              at: signed[0]?.confirmedAt ?? null,
            },
            {
              key: "release",
              label: "Paiement débloqué",
              done: releases.length > 0,
              detail: releases.length
                ? `${RELEASE_LABEL[releases[0].release!.decision] ?? releases[0].release!.decision} · ${fmtEur(releasedHt)} € HT`
                : "Versement fournisseur en attente",
              at: releases[0]?.release?.decidedAt ?? null,
            },
            {
              key: "restock",
              label: "Remise en stock",
              done: r.refusedUnits > 0 || r.cancelledUnits > 0,
              detail:
                r.refusedUnits > 0 || r.cancelledUnits > 0
                  ? `${r.refusedUnits} unité(s) refusée(s) · ${r.cancelledUnits} unité(s) annulée(s)`
                  : "Aucun retour en stock",
              at: null,
            },
          ];

          return (
            <div key={r.orderId} className="bg-white border rounded-lg" style={{ borderColor: "#E2E8F0" }}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [r.orderId]: !isOpen }))}
                  className="flex items-center gap-2 text-left"
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="font-semibold">{r.orderNumber}</span>
                  <span className="text-sm text-slate-500">
                    · {r.customerLabel} · {fmtDate(r.createdAt)}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Étape : {STAGE_LABEL[r.stage]}</Badge>
                  {r.paymentStatus && <Badge variant="secondary">{r.paymentStatus}</Badge>}
                  <span className="text-sm font-medium">
                    {r.amountTtc != null ? `${fmtEur(r.amountTtc)} € TVAC` : "—"}
                  </span>
                  {r.quoteId && (
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/devis/${r.quoteId}`}>
                        <FileText size={12} className="mr-1" /> Devis
                      </Link>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/commandes/${r.orderId}`}>
                      <ExternalLink size={12} className="mr-1" /> Commande
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-2 px-4 pb-3">
                {steps.map((s) => {
                  const Icon = STEP_ICON[s.key];
                  return (
                    <div
                      key={s.key}
                      className={`rounded-md border p-2 ${
                        s.done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1.5 text-xs font-semibold ${
                          s.done ? "text-emerald-700" : "text-slate-500"
                        }`}
                      >
                        {s.done ? <Check size={12} /> : <Icon size={12} />}
                        {s.label}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">{s.detail}</div>
                      {s.at && <div className="text-[11px] text-slate-400">{fmtDateTime(s.at)}</div>}
                    </div>
                  );
                })}
              </div>

              {isOpen && (
                <div className="border-t px-4 py-3 text-sm">
                  {r.notes.length === 0 && (
                    <div className="text-slate-500">Aucun bon de livraison émis pour cette commande.</div>
                  )}
                  {r.notes.map((n) => (
                    <div key={n.id} className="border rounded-md p-3 mb-2" style={{ borderColor: "#E2E8F0" }}>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium">{n.number}</span>
                        <Badge variant={n.status === "cancelled" ? "secondary" : "outline"}>
                          {n.status === "cancelled" ? "Annulé" : n.status ?? "—"}
                        </Badge>
                        <span className="text-slate-500">émis le {fmtDate(n.issuedAt)}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-600">
                        <div>Transporteur : {n.carrier || "—"}</div>
                        <div>Suivi : {n.tracking || "—"}</div>
                        <div>
                          Signature : {n.confirmedAt ? `${fmtDateTime(n.confirmedAt)}${n.confirmedByName ? ` · ${n.confirmedByName}` : ""}` : "—"}
                        </div>
                        <div>
                          Paiement :{" "}
                          {n.release
                            ? `${RELEASE_LABEL[n.release.decision] ?? n.release.decision} · ${fmtEur(
                                Number(n.release.amountHtCents ?? 0) / 100
                              )} € HT · ${fmtDate(n.release.decidedAt)}`
                            : "en attente"}
                        </div>
                        <div>Unités refusées (remises en stock) : {n.refusedUnits}</div>
                        <div>Remarques client : {n.remarks || "—"}</div>
                      </div>
                    </div>
                  ))}
                  <div className="text-xs text-slate-600">
                    Lignes annulées et remises en stock : {r.cancelledLines} ligne(s) · {r.cancelledUnits} unité(s)
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div className="bg-white border rounded-lg p-6 text-center text-slate-500" style={{ borderColor: "#E2E8F0" }}>
            Aucune commande ne correspond à ces filtres.
          </div>
        )}
      </div>
    </div>
  );
}
