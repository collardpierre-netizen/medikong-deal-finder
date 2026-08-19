import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Bell, Check, ExternalLink, Loader2, AlertTriangle,
  ShieldAlert, Package, Store, ClipboardList, MessageSquare,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { resolveNotificationTarget } from "@/lib/admin-notification-target";


interface AdminNotif {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical" | string;
  title: string;
  body: string | null;
  cta_url: string | null;
  payload: Record<string, unknown> | null;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  read_at: string | null;
}

function typeIcon(type: string) {
  switch (type) {
    case "vendor_kyc": return Store;
    case "product_submission": return ClipboardList;
    case "order": return Package;
    case "sla_alert": return AlertTriangle;
    case "security": return ShieldAlert;
    case "rfq": return MessageSquare;
    default: return Bell;
  }
}

function severityColor(sev: string) {
  if (sev === "critical") return "bg-red-100 text-red-700 border-red-200";
  if (sev === "warning") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-blue-100 text-blue-700 border-blue-200";
}

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

export default function AdminNotificationDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-notification", id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_notifications_get", { _id: id });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as AdminNotif | null;
    },
    enabled: !!id,
  });

  const { data: target } = useQuery({
    queryKey: ["admin-notification-target", id],
    queryFn: () => resolveNotificationTarget(data!),
    enabled: !!data,
    staleTime: 60_000,
  });



  const markRead = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.rpc as any)("admin_notifications_mark_read", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notification marquée comme lue.");
      qc.invalidateQueries({ queryKey: ["admin-notification", id] });
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["action-center", "admin"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/admin/notifications")}>
          <ArrowLeft size={14} /> Retour
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Notification introuvable ou accès refusé.
          </CardContent>
        </Card>
      </div>
    );
  }

  const n = data;
  const Icon = typeIcon(n.type);
  const unread = !n.read_at;
  const payloadEntries = n.payload && typeof n.payload === "object"
    ? Object.entries(n.payload as Record<string, unknown>)
    : [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/admin/notifications")}>
          <ArrowLeft size={14} /> Retour aux notifications
        </Button>
        <div className="flex items-center gap-2">
          {(target?.url ?? n.cta_url) && (
            <Button size="sm" className="gap-2" asChild>
              <Link to={(target?.url ?? n.cta_url) as string}>
                {target?.deep
                  ? `Ouvrir la commande${target.label ? ` ${target.label}` : ""}`
                  : "Ouvrir l'élément lié"}{" "}
                <ExternalLink size={14} />
              </Link>
            </Button>
          )}

          {unread && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => markRead.mutate()} disabled={markRead.isPending}>
              {markRead.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Marquer comme lue
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 border", severityColor(n.severity))}>
              <Icon size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] capitalize">{n.type.replace(/_/g, " ")}</Badge>
                <Badge variant="outline" className={cn("text-[10px] capitalize", severityColor(n.severity))}>
                  {n.severity}
                </Badge>
                {unread ? (
                  <Badge variant="destructive" className="text-[10px]">Non lue</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Lue</Badge>
                )}
              </div>
              <CardTitle className="mt-2 text-xl">{n.title}</CardTitle>
              {n.body && <CardDescription className="mt-1 whitespace-pre-line">{n.body}</CardDescription>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Métadonnées</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">ID</dt>
                <dd className="font-mono text-xs break-all">{n.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Créée le</dt>
                <dd>
                  {format(new Date(n.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                  <span className="text-muted-foreground ml-1">
                    ({formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })})
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Lue le</dt>
                <dd>
                  {n.read_at
                    ? format(new Date(n.read_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })
                    : <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Source</dt>
                <dd>
                  {n.source_type ? (
                    <>
                      <span className="font-medium">{n.source_type}</span>
                      {n.source_id && (
                        <span className="font-mono text-xs text-muted-foreground ml-2 break-all">{n.source_id}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Lien d'action</dt>
                <dd>
                  {target?.deep ? (
                    <Link to={target.url} className="text-primary hover:underline break-all">
                      {target.url}
                      {target.label && <span className="text-muted-foreground ml-2">({target.label})</span>}
                    </Link>
                  ) : n.cta_url ? (
                    isHttpUrl(n.cta_url) ? (
                      <a href={n.cta_url} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
                        {n.cta_url}
                      </a>
                    ) : (
                      <Link to={n.cta_url} className="text-primary hover:underline break-all">{n.cta_url}</Link>
                    )
                  ) : (
                    <span className="text-muted-foreground">Aucun</span>
                  )}
                </dd>
              </div>

            </dl>
          </section>

          <Separator />

          <section>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Contexte (payload)</h3>
            {payloadEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée de contexte associée.</p>
            ) : (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
                  {payloadEntries.map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="break-all">
                        {v == null ? (
                          <span className="text-muted-foreground">null</span>
                        ) : typeof v === "object" ? (
                          <code className="text-xs">{JSON.stringify(v)}</code>
                        ) : (
                          String(v)
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">JSON brut</summary>
                  <pre className="mt-2 p-3 rounded-md bg-muted overflow-x-auto text-[11px] leading-relaxed">
                    {JSON.stringify(n.payload, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
