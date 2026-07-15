import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, RotateCcw, Circle, CreditCard, FileClock } from "lucide-react";
import { fmtEur } from "@/lib/format-currency";

type StripeEvent = {
  type: string;
  at: string | null;
  amount: number | null;
  currency: string;
  status: string | null;
  reference: string | null;
};

type StripeVerification = {
  payment_intent_id: string;
  status: string;
  currency: string;
  amount: number;
  amount_received: number;
  created: string | null;
  events?: StripeEvent[];
};

type HistoryRow = {
  id: string;
  changed_at: string;
  field: "status" | "payment_status";
  old_value: string | null;
  new_value: string | null;
  source: string | null;
};

type TimelineItem = {
  key: string;
  at: string;
  kind: "stripe_succeeded" | "stripe_refunded" | "stripe_other" | "status" | "payment_status";
  title: string;
  detail?: string;
  reference?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  processing: "En traitement",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refunded: "Remboursée",
  paid: "Payée",
  unpaid: "Non payée",
  failed: "Échouée",
  refund_pending: "Remboursement en cours",
};

function label(v: string | null | undefined) {
  if (!v) return "—";
  return STATUS_LABEL[v] ?? v;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-BE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface Props {
  orderId: string;
  paymentIntentId: string | null;
  stripeVerification: StripeVerification | undefined;
  className?: string;
}

export default function OrderPaymentTimeline({ orderId, paymentIntentId, stripeVerification, className }: Props) {
  const historyQuery = useQuery({
    queryKey: ["order-status-history", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("id, changed_at, field, old_value, new_value, source")
        .eq("order_id", orderId)
        .order("changed_at", { ascending: true });
      if (error) throw error;
      return (data as HistoryRow[]) ?? [];
    },
  });

  const items: TimelineItem[] = [];

  for (const h of historyQuery.data ?? []) {
    const isPayment = h.field === "payment_status";
    items.push({
      key: `h-${h.id}`,
      at: h.changed_at,
      kind: isPayment ? "payment_status" : "status",
      title: h.old_value
        ? `${isPayment ? "Paiement" : "Statut"} : ${label(h.old_value)} → ${label(h.new_value)}`
        : `${isPayment ? "Paiement" : "Statut"} initial : ${label(h.new_value)}`,
      detail: h.source && h.source !== "update" ? h.source : undefined,
    });
  }

  const stripeEvents = stripeVerification?.events ?? [];
  for (const e of stripeEvents) {
    if (!e.at) continue;
    const isRefund = e.type === "refunded";
    const isSuccess = e.type === "payment_succeeded";
    items.push({
      key: `s-${e.reference ?? e.type}-${e.at}`,
      at: e.at,
      kind: isRefund ? "stripe_refunded" : isSuccess ? "stripe_succeeded" : "stripe_other",
      title: isRefund
        ? `Remboursement Stripe`
        : isSuccess
        ? `Paiement Stripe confirmé`
        : `Stripe · ${e.status ?? e.type}`,
      detail:
        e.amount != null
          ? `${fmtEur(e.amount)} ${e.currency.toUpperCase()}`
          : undefined,
      reference: e.reference,
    });
  }

  items.sort((a, b) => a.at.localeCompare(b.at));

  const hasData = items.length > 0;

  return (
    <div className={`bg-white border rounded-lg ${className ?? ""}`} style={{ borderColor: "#E2E8F0" }}>
      <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: "#E2E8F0" }}>
        <FileClock size={14} className="text-slate-400" />
        <div>
          <div className="text-[11px] uppercase text-slate-400 font-semibold">Timeline paiement</div>
          <div className="text-sm text-slate-600">
            {paymentIntentId
              ? "Événements Stripe et historique des statuts"
              : "Historique des statuts (aucun paiement Stripe rattaché)"}
          </div>
        </div>
      </div>

      <div className="p-4">
        {historyQuery.isLoading && <div className="text-sm text-slate-500">Chargement…</div>}
        {!historyQuery.isLoading && !hasData && (
          <div className="text-sm text-slate-500">Aucun événement enregistré pour le moment.</div>
        )}

        {hasData && (
          <ol className="relative border-l pl-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
            {items.map((it) => {
              const dotClass =
                it.kind === "stripe_succeeded"
                  ? "bg-emerald-500 text-white"
                  : it.kind === "stripe_refunded"
                  ? "bg-amber-500 text-white"
                  : it.kind === "stripe_other"
                  ? "bg-indigo-500 text-white"
                  : it.kind === "payment_status"
                  ? "bg-blue-500 text-white"
                  : "bg-slate-300 text-slate-700";
              const Icon =
                it.kind === "stripe_succeeded"
                  ? CheckCircle2
                  : it.kind === "stripe_refunded"
                  ? RotateCcw
                  : it.kind === "stripe_other" || it.kind === "payment_status"
                  ? CreditCard
                  : Circle;
              return (
                <li key={it.key} className="relative">
                  <span
                    className={`absolute -left-[22px] top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full ${dotClass}`}
                  >
                    <Icon size={10} />
                  </span>
                  <div className="text-[11px] text-slate-500">{fmtDateTime(it.at)}</div>
                  <div className="text-sm text-slate-800">{it.title}</div>
                  {it.detail && (
                    <div className="text-xs text-slate-600">{it.detail}</div>
                  )}
                  {it.reference && (
                    <div className="text-[10px] font-mono text-slate-400 break-all">{it.reference}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
