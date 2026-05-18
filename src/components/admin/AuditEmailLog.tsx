import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, MailX, MailCheck, Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";

interface EmailLogRow {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
}

const TEMPLATE_LABEL: Record<string, string> = {
  "audit-confirmation": "Accusé de réception (pharmacien)",
  "audit-new-lead": "Notification interne (équipe MediKong)",
  "audit-report-ready": "Rapport prêt (pharmacien)",
};

function statusBadge(status: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "sent")
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Envoyé</Badge>;
  if (s === "pending")
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">En file</Badge>;
  if (s === "suppressed")
    return <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200">Supprimé</Badge>;
  if (s === "bounced" || s === "complained")
    return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">{s}</Badge>;
  // dlq / failed / other
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{s || "inconnu"}</Badge>;
}

interface Props {
  auditId: string;
}

/**
 * Journal des emails envoyés pour une demande d'audit donnée.
 * Lit email_send_log filtré sur message_id LIKE `audit-<id>-%`
 * (clé d'idempotence utilisée par submit-audit-request + AuditsAdminPage).
 * Déduplique côté client par message_id (dernier statut connu).
 */
export function AuditEmailLog({ auditId }: Props) {
  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["audit-email-log", auditId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select(
          "id, message_id, template_name, recipient_email, status, error_message, created_at",
        )
        .like("message_id", `audit-${auditId}-%`)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as EmailLogRow[];
    },
  });

  // Déduplication par message_id : garder la ligne la plus récente
  const latestPerMessage: EmailLogRow[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const key = row.message_id ?? row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    latestPerMessage.push(row);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-muted-foreground">
          Journal des emails ({latestPerMessage.length})
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 px-2 text-xs"
        >
          {isFetching ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Rafraîchir
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center text-xs text-muted-foreground py-3">
          <Loader2 className="h-3 w-3 mr-2 animate-spin" /> Chargement…
        </div>
      ) : error ? (
        <div className="text-xs text-destructive flex items-center gap-1.5">
          <MailX className="h-3 w-3" />
          Impossible de lire le journal d'envoi : {(error as Error).message}
        </div>
      ) : latestPerMessage.length === 0 ? (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded">
          <Clock className="h-3 w-3" />
          Aucun email enregistré pour cette demande.
        </div>
      ) : (
        <div className="space-y-1.5">
          {latestPerMessage.map((row) => {
            const label =
              (row.template_name && TEMPLATE_LABEL[row.template_name]) ||
              row.template_name ||
              "Email";
            const isOk = (row.status || "").toLowerCase() === "sent";
            return (
              <div
                key={row.id}
                className="flex items-start justify-between gap-3 bg-slate-50 px-3 py-2 rounded text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    {isOk ? (
                      <MailCheck className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <MailX className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="truncate">{label}</span>
                  </div>
                  <div className="text-muted-foreground truncate">
                    {row.recipient_email || "—"}
                  </div>
                  {row.error_message && (
                    <div className="text-destructive truncate mt-0.5">
                      {row.error_message}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {statusBadge(row.status)}
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(row.created_at), "dd MMM yyyy HH:mm", {
                      locale: fr,
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
