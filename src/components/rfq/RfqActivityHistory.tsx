import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Eye, Bell, MessageSquare, Award, XCircle, FileText, CheckCircle2 } from "lucide-react";
import { formatUpdatedAt, formatUpdatedAtFull } from "@/lib/format-date";

type Props = {
  rfqId: string;
  rfqCreatedAt: string;
  rfqDispatchedAt: string | null;
  rfqClosedAt: string | null;
  rfqStatus: string;
};

type TimelineEvent = {
  at: string;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  tone: "neutral" | "info" | "warn" | "success" | "danger";
};

const toneClass: Record<TimelineEvent["tone"], string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-100 text-blue-700",
  warn: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
  danger: "bg-red-100 text-red-700",
};

export function RfqActivityHistory({
  rfqId,
  rfqCreatedAt,
  rfqDispatchedAt,
  rfqClosedAt,
  rfqStatus,
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["rfq-activity-history", rfqId],
    queryFn: async () => {
      const [dispatch, reminders, responses] = await Promise.all([
        supabase
          .from("rfq_dispatch_log")
          .select("vendor_id, dispatched_at, viewed_at, responded_at, declined_at, expired_at, email_message_id")
          .eq("rfq_id", rfqId),
        supabase
          .from("rfq_reminder_log")
          .select("vendor_id, wave_number, sent_at, error")
          .eq("rfq_id", rfqId),
        supabase
          .from("rfq_responses")
          .select("vendor_id, created_at, awarded, is_visible_to_buyer")
          .eq("rfq_id", rfqId)
          .eq("is_visible_to_buyer", true),
      ]);
      return {
        dispatch: dispatch.data || [],
        reminders: reminders.data || [],
        responses: responses.data || [],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Chargement de l'historique…
      </div>
    );
  }

  const events: TimelineEvent[] = [];

  // Création
  events.push({
    at: rfqCreatedAt,
    icon: <FileText className="h-3.5 w-3.5" />,
    title: "Demande créée",
    tone: "neutral",
  });

  // Envoi (dispatched)
  if (rfqDispatchedAt && data) {
    const totalTargets = data.dispatch.length;
    const sentOk = data.dispatch.filter((d: any) => d.email_message_id).length;
    const sentFail = totalTargets - sentOk;
    events.push({
      at: rfqDispatchedAt,
      icon: <Send className="h-3.5 w-3.5" />,
      title: `Envoyée à ${totalTargets} fournisseur${totalTargets > 1 ? "s" : ""}`,
      detail: sentFail > 0 ? `${sentOk} reçus · ${sentFail} échec(s) d'envoi` : undefined,
      tone: sentFail > 0 ? "warn" : "info",
    });
  }

  if (data) {
    // Première vue
    const firstView = data.dispatch
      .map((d: any) => d.viewed_at)
      .filter(Boolean)
      .sort()[0];
    if (firstView) {
      const viewedCount = data.dispatch.filter((d: any) => d.viewed_at).length;
      events.push({
        at: firstView,
        icon: <Eye className="h-3.5 w-3.5" />,
        title: `Première consultation`,
        detail: `${viewedCount} fournisseur${viewedCount > 1 ? "s ont" : " a"} ouvert la demande`,
        tone: "info",
      });
    }

    // Relances par vague
    const waves = new Map<number, { at: string; count: number; errors: number }>();
    for (const r of data.reminders as any[]) {
      const w = r.wave_number as number;
      const cur = waves.get(w) || { at: r.sent_at, count: 0, errors: 0 };
      cur.count += 1;
      if (r.error) cur.errors += 1;
      if (r.sent_at < cur.at) cur.at = r.sent_at;
      waves.set(w, cur);
    }
    for (const [wave, info] of Array.from(waves.entries()).sort((a, b) => a[0] - b[0])) {
      events.push({
        at: info.at,
        icon: <Bell className="h-3.5 w-3.5" />,
        title: `Relance vague ${wave}`,
        detail: `${info.count} fournisseur${info.count > 1 ? "s" : ""} relancé${info.count > 1 ? "s" : ""}${info.errors > 0 ? ` · ${info.errors} échec(s)` : ""}`,
        tone: info.errors > 0 ? "warn" : "info",
      });
    }

    // Première réponse
    const firstResp = (data.responses as any[]).map((r) => r.created_at).filter(Boolean).sort()[0];
    if (firstResp) {
      const respCount = data.responses.length;
      events.push({
        at: firstResp,
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        title: `Première offre reçue`,
        detail: respCount > 1 ? `${respCount} offres au total` : undefined,
        tone: "success",
      });
    }

    // Premier déclin
    const firstDecline = data.dispatch
      .map((d: any) => d.declined_at)
      .filter(Boolean)
      .sort()[0];
    if (firstDecline) {
      const declined = data.dispatch.filter((d: any) => d.declined_at).length;
      events.push({
        at: firstDecline,
        icon: <XCircle className="h-3.5 w-3.5" />,
        title: `${declined} déclinaison${declined > 1 ? "s" : ""}`,
        tone: "warn",
      });
    }

    // Attribution
    const awarded = (data.responses as any[]).find((r) => r.awarded);
    if (awarded) {
      events.push({
        at: awarded.created_at,
        icon: <Award className="h-3.5 w-3.5" />,
        title: "Offre attribuée",
        tone: "success",
      });
    }
  }

  // Clôture
  if (rfqClosedAt) {
    events.push({
      at: rfqClosedAt,
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      title: rfqStatus === "cancelled" ? "Demande annulée" : "Demande clôturée",
      tone: rfqStatus === "cancelled" ? "danger" : "neutral",
    });
  }

  // Tri chronologique
  events.sort((a, b) => a.at.localeCompare(b.at));

  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground italic mt-2">Aucune activité enregistrée.</p>;
  }

  return (
    <ol className="relative border-l border-border ml-1.5 mt-3 space-y-3">
      {events.map((e, i) => (
        <li key={i} className="ml-4">
          <span
            className={`absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${toneClass[e.tone]}`}
          >
            {e.icon}
          </span>
          <div className="text-sm">
            <span className="font-medium">{e.title}</span>
            {e.detail && <span className="text-muted-foreground"> — {e.detail}</span>}
          </div>
          <time className="text-[11px] text-muted-foreground" title={formatUpdatedAtFull(e.at)}>
            {formatUpdatedAt(e.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
