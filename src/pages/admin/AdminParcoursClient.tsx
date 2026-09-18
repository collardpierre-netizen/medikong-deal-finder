// Admin — Parcours client : offre → devis → bon de commande → livraison signée → paiement débloqué.
// Lecture seule : agrège devis, commandes, bons de livraison et déblocages par client.
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
  Search,
  Tag,
  Wallet,
} from "lucide-react";

type Step = {
  key: "offer" | "quote" | "order" | "delivery" | "release";
  label: string;
  done: boolean;
  detail: string | null;
  at: string | null;
};

type Journey = {
  key: string;
  customerId: string | null;
  customerLabel: string;
  quoteId: string | null;
  quoteNumber: string | null;
  quoteStatus: string | null;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  paymentStatus: string | null;
  amountTtc: number | null;
  startedAt: string | null;
  offersCount: number;
  deliveryNumber: string | null;
  confirmedAt: string | null;
  confirmedByName: string | null;
  releaseDecision: string | null;
  releaseDecidedAt: string | null;
  stage: number; // 1..5
};

const RELEASE_LABEL: Record<string, string> = {
  full: "Versement complet",
  partial: "Versement partiel",
  none: "Versement bloqué",
};

const STAGE_LABEL = ["—", "Offre", "Devis", "Bon de commande", "Livraison signée", "Paiement débloqué"];

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-BE") : "—");
const fmtDateTime = (v: string | null) => (v ? new Date(v).toLocaleString("fr-BE") : "—");

function buildSteps(j: Journey): Step[] {
  return [
    {
      key: "offer",
      label: "Offre",
      done: j.offersCount > 0,
      detail: j.offersCount > 0 ? `${j.offersCount} offre(s) liée(s)` : "Aucune offre liée",
      at: null,
    },
    {
      key: "quote",
      label: "Devis",
      done: j.quoteId != null,
      detail: j.quoteNumber ? `${j.quoteNumber}${j.quoteStatus ? ` · ${j.quoteStatus}` : ""}` : "Pas de devis",
      at: j.quoteId ? j.startedAt : null,
    },
    {
      key: "order",
      label: "Bon de commande",
      done: j.orderId != null,
      detail: j.orderNumber ? `${j.orderNumber}${j.orderStatus ? ` · ${j.orderStatus}` : ""}` : "Pas de commande",
      at: null,
    },
    {
      key: "delivery",
      label: "Livraison signée",
      done: j.confirmedAt != null,
      detail: j.deliveryNumber
        ? `${j.deliveryNumber}${j.confirmedByName ? ` · ${j.confirmedByName}` : ""}`
        : "Aucun bon de livraison",
      at: j.confirmedAt,
    },
    {
      key: "release",
      label: "Paiement débloqué",
      done: j.releaseDecision != null,
      detail: j.releaseDecision
        ? RELEASE_LABEL[j.releaseDecision] ?? j.releaseDecision
        : "Versement fournisseur en attente",
      at: j.releaseDecidedAt,
    },
  ];
}

const STEP_ICON = {
  offer: Tag,
  quote: FileText,
  order: Package,
  delivery: FileSignature,
  release: Wallet,
} as const;

export default function AdminParcoursClient() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: journeys = [], isLoading, error } = useQuery<Journey[]>({
    queryKey: ["admin-parcours-client"],
    queryFn: async () => {
      const [quotesRes, ordersRes] = await Promise.all([
        supabase
          .from("quotes")
          .select(
            "id, quote_number, status, order_id, customer_id, created_at, total_ttc_cents, customers(company_name, email)"
          )
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("orders")
          .select(
            "id, order_number, status, payment_status, customer_id, created_at, total_incl_vat, customers(company_name, email)"
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (quotesRes.error) throw quotesRes.error;
      if (ordersRes.error) throw ordersRes.error;

      const quotes = quotesRes.data ?? [];
      const orders = ordersRes.data ?? [];

      const quoteIds = quotes.map((q: any) => q.id);
      const orderIds = Array.from(
        new Set([...orders.map((o: any) => o.id), ...quotes.map((q: any) => q.order_id).filter(Boolean)])
      );

      const [linesRes, notesRes] = await Promise.all([
        quoteIds.length
          ? supabase.from("quote_lines").select("quote_id, offer_id").in("quote_id", quoteIds)
          : Promise.resolve({ data: [], error: null } as any),
        orderIds.length
          ? supabase
              .from("delivery_notes")
              .select("id, order_id, document_number, status, confirmed_at, confirmed_by_name, issued_at")
              .in("order_id", orderIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (linesRes.error) throw linesRes.error;
      if (notesRes.error) throw notesRes.error;

      const notes = (notesRes.data ?? []).filter((n: any) => n.status !== "cancelled");
      const noteIds = notes.map((n: any) => n.id);
      let releases: any[] = [];
      if (noteIds.length) {
        const { data, error: relErr } = await supabase
          .from("delivery_payment_releases")
          .select("delivery_note_id, decision, decided_at")
          .in("delivery_note_id", noteIds);
        if (relErr) throw relErr;
        releases = data ?? [];
      }

      const releaseByNote = new Map<string, any>();
      for (const r of releases) {
        const prev = releaseByNote.get(r.delivery_note_id);
        if (!prev || (r.decided_at ?? "") > (prev.decided_at ?? "")) releaseByNote.set(r.delivery_note_id, r);
      }

      // Bon de livraison le plus récent par commande, en privilégiant ceux déjà signés.
      const noteByOrder = new Map<string, any>();
      for (const n of notes) {
        const prev = noteByOrder.get(n.order_id);
        const better =
          !prev ||
          (!!n.confirmed_at && !prev.confirmed_at) ||
          (!!n.confirmed_at === !!prev.confirmed_at && (n.issued_at ?? "") > (prev.issued_at ?? ""));
        if (better) noteByOrder.set(n.order_id, n);
      }

      const offersByQuote = new Map<string, number>();
      for (const l of linesRes.data ?? []) {
        if (!l.offer_id) continue;
        offersByQuote.set(l.quote_id, (offersByQuote.get(l.quote_id) ?? 0) + 1);
      }

      const orderById = new Map<string, any>();
      for (const o of orders) orderById.set(o.id, o);

      const label = (c: any, fallbackId: string | null) =>
        c?.company_name || c?.email || (fallbackId ? `Client ${fallbackId.slice(0, 8)}` : "Client inconnu");

      const rows: Journey[] = [];
      const coveredOrders = new Set<string>();

      const finalize = (j: Omit<Journey, "stage">): Journey => {
        let stage = 0;
        if (j.offersCount > 0) stage = 1;
        if (j.quoteId) stage = 2;
        if (j.orderId) stage = 3;
        if (j.confirmedAt) stage = 4;
        if (j.releaseDecision) stage = 5;
        return { ...j, stage: Math.max(stage, 1) };
      };

      for (const q of quotes as any[]) {
        const order = q.order_id ? orderById.get(q.order_id) ?? null : null;
        const note = q.order_id ? noteByOrder.get(q.order_id) ?? null : null;
        const rel = note ? releaseByNote.get(note.id) ?? null : null;
        if (q.order_id) coveredOrders.add(q.order_id);
        rows.push(
          finalize({
            key: `q-${q.id}`,
            customerId: q.customer_id ?? order?.customer_id ?? null,
            customerLabel: label(q.customers, q.customer_id ?? null),
            quoteId: q.id,
            quoteNumber: q.quote_number ?? null,
            quoteStatus: q.status ?? null,
            orderId: q.order_id ?? null,
            orderNumber: order?.order_number ?? null,
            orderStatus: order?.status ?? null,
            paymentStatus: order?.payment_status ?? null,
            amountTtc:
              order?.total_incl_vat != null
                ? Number(order.total_incl_vat)
                : q.total_ttc_cents != null
                  ? Number(q.total_ttc_cents) / 100
                  : null,
            startedAt: q.created_at ?? null,
            offersCount: offersByQuote.get(q.id) ?? 0,
            deliveryNumber: note?.document_number ?? null,
            confirmedAt: note?.confirmed_at ?? null,
            confirmedByName: note?.confirmed_by_name ?? null,
            releaseDecision: rel?.decision ?? null,
            releaseDecidedAt: rel?.decided_at ?? null,
          })
        );
      }

      for (const o of orders as any[]) {
        if (coveredOrders.has(o.id)) continue;
        const note = noteByOrder.get(o.id) ?? null;
        const rel = note ? releaseByNote.get(note.id) ?? null : null;
        rows.push(
          finalize({
            key: `o-${o.id}`,
            customerId: o.customer_id ?? null,
            customerLabel: label(o.customers, o.customer_id ?? null),
            quoteId: null,
            quoteNumber: null,
            quoteStatus: null,
            orderId: o.id,
            orderNumber: o.order_number ?? null,
            orderStatus: o.status ?? null,
            paymentStatus: o.payment_status ?? null,
            amountTtc: o.total_incl_vat != null ? Number(o.total_incl_vat) : null,
            startedAt: o.created_at ?? null,
            offersCount: 0,
            deliveryNumber: note?.document_number ?? null,
            confirmedAt: note?.confirmed_at ?? null,
            confirmedByName: note?.confirmed_by_name ?? null,
            releaseDecision: rel?.decision ?? null,
            releaseDecidedAt: rel?.decided_at ?? null,
          })
        );
      }

      return rows.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return journeys.filter((j) => {
      if (stageFilter !== "all" && String(j.stage) !== stageFilter) return false;
      if (!q) return true;
      return [j.customerLabel, j.quoteNumber, j.orderNumber, j.deliveryNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [journeys, search, stageFilter]);

  const grouped = useMemo(() => {
    const m = new Map<string, { label: string; items: Journey[] }>();
    for (const j of filtered) {
      const k = j.customerId ?? j.customerLabel;
      if (!m.has(k)) m.set(k, { label: j.customerLabel, items: [] });
      m.get(k)!.items.push(j);
    }
    return Array.from(m.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [filtered]);

  const kpis = useMemo(() => {
    const counters = [0, 0, 0, 0, 0, 0];
    for (const j of filtered) counters[j.stage] += 1;
    return counters;
  }, [filtered]);

  return (
    <div>
      <AdminTopBar
        title="Parcours client"
        subtitle="Offre → devis → bon de commande → livraison signée → paiement débloqué"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="bg-white border rounded-lg p-3" style={{ borderColor: "#E2E8F0" }}>
            <div className="text-[11px] uppercase font-semibold text-slate-500">{STAGE_LABEL[s]}</div>
            <div className="text-xl font-semibold">{kpis[s]}</div>
            <div className="text-xs text-slate-500">parcours à cette étape</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Client, devis, commande, BL…"
            className="pl-8 w-72"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Étape atteinte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les étapes</SelectItem>
            {[1, 2, 3, 4, 5].map((s) => (
              <SelectItem key={s} value={String(s)}>
                Bloqué à : {STAGE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">
          {filtered.length} parcours · {grouped.length} client(s)
        </span>
      </div>

      {error && <div className="p-4 text-sm text-red-600">Chargement impossible : {(error as any).message}</div>}
      {isLoading && <div className="p-4 text-sm text-slate-500">Chargement…</div>}

      <div className="space-y-4">
        {grouped.map(([key, group]) => {
          const isOpen = expanded[key] ?? true;
          return (
            <div key={key} className="bg-white border rounded-lg" style={{ borderColor: "#E2E8F0" }}>
              <button
                type="button"
                onClick={() => setExpanded((p) => ({ ...p, [key]: !isOpen }))}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2 font-semibold">
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  {group.label}
                </span>
                <span className="text-xs text-slate-500">{group.items.length} parcours</span>
              </button>

              {isOpen && (
                <div className="border-t divide-y">
                  {group.items.map((j) => {
                    const steps = buildSteps(j);
                    return (
                      <div key={j.key} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="text-sm">
                            <span className="font-medium">
                              {j.orderNumber ?? j.quoteNumber ?? "Parcours"}
                            </span>{" "}
                            <span className="text-slate-500">· démarré le {fmtDate(j.startedAt)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Étape : {STAGE_LABEL[j.stage]}</Badge>
                            <span className="text-sm font-medium">
                              {j.amountTtc != null ? `${fmtEur(j.amountTtc)} € TVAC` : "—"}
                            </span>
                            {j.quoteId && (
                              <Button asChild size="sm" variant="outline">
                                <Link to={`/admin/devis/${j.quoteId}`}>
                                  <FileText size={12} className="mr-1" /> Devis
                                </Link>
                              </Button>
                            )}
                            {j.orderId && (
                              <Button asChild size="sm" variant="outline">
                                <Link to={`/admin/commandes/${j.orderId}`}>
                                  <ExternalLink size={12} className="mr-1" /> Commande
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {!isLoading && grouped.length === 0 && (
          <div className="bg-white border rounded-lg p-6 text-center text-slate-500" style={{ borderColor: "#E2E8F0" }}>
            Aucun parcours ne correspond à ces filtres.
          </div>
        )}
      </div>
    </div>
  );
}
