import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, Eye, Send, AlertTriangle, Bell, Award, Mail, MailX } from "lucide-react";
import { formatUpdatedAtFull } from "@/lib/format-date";
import { useMoneyFormat, formatMoneyFromCents } from "@/lib/money-format";

type VendorStatusRow = {
  rfq_id: string | null;
  dispatch_id: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  vendor_display_code: string | null;
  vendor_status: string | null;
  vendor_status_label: string | null;
  target_reason: string | null;
  dispatched_at: string | null;
  email_opened_at: string | null;
  viewed_at: string | null;
  reminded_at: string | null;
  responded_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  expired_at: string | null;
  awarded: boolean | null;
  rank_position: number | null;
  score: number | null;
  unit_price_excl_vat_cents: number | null;
  delivery_days: number | null;
  response_id: string | null;
  last_transition_at: string | null;
};

type ReminderRow = {
  vendor_id: string;
  wave_number: number;
  sent_at: string;
  error: string | null;
};

type DispatchErrorRow = {
  vendor_id: string;
  email_message_id: string | null;
  status: string;
};

const REASON_LABEL: Record<string, string> = {
  product_match: "Produit ciblé",
  brand_match: "Marque ciblée",
  category_match: "Catégorie",
  manual: "Sélection manuelle",
  fallback: "Repli automatique",
};

const STATUS_META: Record<
  string,
  { icon: typeof Send; tone: string; label: string }
> = {
  dispatched: { icon: Send, tone: "text-sky-700 bg-sky-50 border-sky-200", label: "Envoyée" },
  viewed: { icon: Eye, tone: "text-indigo-700 bg-indigo-50 border-indigo-200", label: "Email ouvert" },
  pending_review: { icon: Clock, tone: "text-amber-700 bg-amber-50 border-amber-200", label: "En attente de réponse" },
  reminded: { icon: Bell, tone: "text-amber-700 bg-amber-50 border-amber-200", label: "Relancé" },
  responded: { icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50 border-emerald-200", label: "A répondu" },
  declined: { icon: XCircle, tone: "text-rose-700 bg-rose-50 border-rose-200", label: "A décliné" },
  expired: { icon: AlertTriangle, tone: "text-muted-foreground bg-muted border-border", label: "Pas de réponse" },
  awarded: { icon: Award, tone: "text-emerald-800 bg-emerald-100 border-emerald-300", label: "Attribuée" },
  lost: { icon: XCircle, tone: "text-muted-foreground bg-muted border-border", label: "Non retenu" },
};

function formatPrice(cents: number | null, locale?: string) {
  if (cents == null) return "—";
  return formatMoneyFromCents(cents, locale ? { locale } : undefined);
}

function TimelineDot({
  ok,
  date,
  label,
  icon: Icon,
  error,
}: {
  ok: boolean;
  date: string | null;
  label: string;
  icon: typeof Send;
  error?: string | null;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 text-[11px] ${
        error ? "text-rose-700" : ok ? "text-foreground" : "text-muted-foreground/50"
      }`}
      title={
        error
          ? `${label} : échec — ${error}`
          : date
            ? `${label} : ${formatUpdatedAtFull(date)}`
            : `${label} : —`
      }
    >
      <Icon className={`h-3 w-3 ${error ? "text-rose-600" : ok ? "text-primary" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

export function BuyerRfqTracker({ rfqId }: { rfqId: string }) {
  const { locale } = useMoneyFormat();
  const { data: rows, isLoading } = useQuery({
    queryKey: ["buyer-rfq-tracker", rfqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_vendor_status_v")
        .select(
          "rfq_id, dispatch_id, vendor_id, vendor_name, vendor_display_code, vendor_status, vendor_status_label, target_reason, dispatched_at, email_opened_at, viewed_at, reminded_at, responded_at, declined_at, decline_reason, expired_at, awarded, rank_position, score, unit_price_excl_vat_cents, delivery_days, response_id, last_transition_at"
        )
        .eq("rfq_id", rfqId)
        .order("last_transition_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as VendorStatusRow[];
    },
  });

  const vendorIds = useMemo(
    () => Array.from(new Set((rows || []).map((r) => r.vendor_id).filter(Boolean) as string[])),
    [rows]
  );

  const { data: reminders } = useQuery({
    queryKey: ["buyer-rfq-tracker-reminders", rfqId],
    enabled: vendorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_reminder_log")
        .select("vendor_id, wave_number, sent_at, error")
        .eq("rfq_id", rfqId)
        .order("sent_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ReminderRow[];
    },
  });

  const { data: dispatchExtras } = useQuery({
    queryKey: ["buyer-rfq-tracker-dispatch", rfqId],
    enabled: vendorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_dispatch_log")
        .select("vendor_id, email_message_id, status")
        .eq("rfq_id", rfqId);
      if (error) throw error;
      return (data || []) as DispatchErrorRow[];
    },
  });

  const remindersByVendor = useMemo(() => {
    const map: Record<string, ReminderRow[]> = {};
    for (const r of reminders || []) {
      (map[r.vendor_id] ||= []).push(r);
    }
    return map;
  }, [reminders]);

  const dispatchByVendor = useMemo(() => {
    const map: Record<string, DispatchErrorRow> = {};
    for (const d of dispatchExtras || []) {
      if (d.vendor_id) map[d.vendor_id] = d;
    }
    return map;
  }, [dispatchExtras]);

  if (isLoading) {
    return (
      <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Chargement du suivi…
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted-foreground italic">
        Aucun fournisseur ciblé pour cette demande pour le moment.
      </p>
    );
  }

  // Stats summary
  const total = rows.length;
  const responded = rows.filter((r) => r.responded_at).length;
  const declined = rows.filter((r) => r.declined_at).length;
  const noReply = rows.filter((r) => !r.responded_at && !r.declined_at).length;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="gap-1">
          <Send className="h-3 w-3" /> {total} ciblé{total > 1 ? "s" : ""}
        </Badge>
        <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-800">
          <CheckCircle2 className="h-3 w-3" /> {responded} réponse{responded > 1 ? "s" : ""}
        </Badge>
        {declined > 0 && (
          <Badge variant="outline" className="gap-1 border-rose-300 text-rose-700">
            <XCircle className="h-3 w-3" /> {declined} décliné{declined > 1 ? "s" : ""}
          </Badge>
        )}
        {noReply > 0 && (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> {noReply} en attente
          </Badge>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Fournisseur</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2 text-left">Timeline</th>
              <th className="px-3 py-2 text-left">Réponse / Raison</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = STATUS_META[r.vendor_status || ""] || {
                icon: Send,
                tone: "text-foreground bg-muted border-border",
                label: r.vendor_status_label || r.vendor_status || "—",
              };
              const StatusIcon = meta.icon;
              const reminderRows = (r.vendor_id && remindersByVendor[r.vendor_id]) || [];
              const dispatchInfo = r.vendor_id ? dispatchByVendor[r.vendor_id] : null;
              const reminderError = reminderRows.find((rr) => rr.error)?.error || null;
              const sendFailed =
                !!dispatchInfo && !dispatchInfo.email_message_id && !r.responded_at && !r.declined_at;

              return (
                <tr key={r.dispatch_id || r.vendor_id} className="border-t align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium">
                      {r.vendor_name || (r.vendor_display_code ? `Vendeur ${r.vendor_display_code}` : "—")}
                    </div>
                    {r.target_reason && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {REASON_LABEL[r.target_reason] || r.target_reason}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {meta.label}
                    </span>
                    {r.awarded && (
                      <Badge className="ml-1 bg-emerald-600 text-[10px]">
                        <Award className="h-3 w-3 mr-1" /> Choisie
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <TimelineDot
                        ok={!!r.dispatched_at && !sendFailed}
                        date={r.dispatched_at}
                        label="Envoyé"
                        icon={sendFailed ? MailX : Mail}
                        error={sendFailed ? "Échec d'envoi de l'email" : null}
                      />
                      <TimelineDot
                        ok={!!(r.email_opened_at || r.viewed_at)}
                        date={r.email_opened_at || r.viewed_at}
                        label="Vu"
                        icon={Eye}
                      />
                      <TimelineDot
                        ok={!!r.reminded_at}
                        date={r.reminded_at}
                        label={
                          reminderRows.length > 0
                            ? `Relancé ×${reminderRows.filter((x) => !x.error).length}`
                            : "Relance"
                        }
                        icon={Bell}
                        error={reminderError}
                      />
                      <TimelineDot
                        ok={!!(r.responded_at || r.declined_at)}
                        date={r.responded_at || r.declined_at}
                        label={r.declined_at ? "Décliné" : "Répondu"}
                        icon={r.declined_at ? XCircle : CheckCircle2}
                      />
                    </div>
                    {r.last_transition_at && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Dernière màj : {formatUpdatedAtFull(r.last_transition_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {r.responded_at && r.unit_price_excl_vat_cents != null ? (
                      <div>
                        <div className="font-semibold text-emerald-800">
                          {formatPrice(r.unit_price_excl_vat_cents)}/u.
                        </div>
                        <div className="text-muted-foreground">
                          {r.delivery_days ? `livraison ${r.delivery_days} j` : ""}
                          {r.score != null && (
                            <span className="ml-1">· score {r.score.toFixed(0)}/100</span>
                          )}
                        </div>
                      </div>
                    ) : r.declined_at ? (
                      <div className="text-rose-700">
                        <div className="font-medium">Décliné</div>
                        {r.decline_reason && (
                          <div className="text-muted-foreground mt-0.5">{r.decline_reason}</div>
                        )}
                      </div>
                    ) : sendFailed ? (
                      <div className="text-rose-700">
                        <div className="font-medium">Échec d'envoi</div>
                        <div className="text-muted-foreground mt-0.5">
                          L'email n'a pas pu être délivré au fournisseur.
                        </div>
                      </div>
                    ) : reminderError ? (
                      <div className="text-rose-700">
                        <div className="font-medium">Échec de relance</div>
                        <div className="text-muted-foreground mt-0.5">{reminderError}</div>
                      </div>
                    ) : r.expired_at ? (
                      <div className="text-muted-foreground">
                        <div className="font-medium">Pas de réponse avant clôture</div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground italic">En attente…</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
