import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Loader2, AlertTriangle, ShieldAlert, Package, Store, ClipboardList, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminNotif {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical" | string;
  title: string;
  body: string | null;
  cta_url: string | null;
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

function NotificationItem({
  n,
  target,
  onMarkRead,
}: {
  n: AdminNotif;
  target?: NotifTarget;
  onMarkRead: (id: string) => void;
}) {
  const Icon = typeIcon(n.type);
  const unread = !n.read_at;
  const href = target?.url ?? n.cta_url;
  return (
    <div className={cn(
      "p-4 border rounded-lg transition flex items-start gap-3",
      unread ? "bg-primary/5 border-primary/20" : "bg-background"
    )}>
      <div className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center shrink-0 border",
        severityColor(n.severity)
      )}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{n.title}</p>
            {n.body && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
            {target?.label && (
              <p className="text-xs text-muted-foreground mt-1">
                Commande <span className="font-mono">{target.label}</span>
              </p>
            )}
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] capitalize">{n.type.replace(/_/g, " ")}</Badge>
        </div>
        <div className="flex items-center justify-between gap-2 mt-2">
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
              <Link to={`/admin/notifications/${n.id}`} onClick={() => unread && onMarkRead(n.id)}>Détails</Link>
            </Button>
            {href && (
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                <Link to={href} onClick={() => unread && onMarkRead(n.id)}>
                  {target?.deep ? "Ouvrir la commande →" : "Voir →"}
                </Link>
              </Button>
            )}
            {unread && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onMarkRead(n.id)}>
                <Check size={12} /> Marquer lu
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


export default function AdminNotifications() {
  const qc = useQueryClient();
  const [onlyUnread, setOnlyUnread] = useState(false);

  const { data: notifs = [], isLoading } = useQuery({
    queryKey: ["admin-notifications", onlyUnread],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_notifications_list", {
        _limit: 200,
        _only_unread: onlyUnread,
      });
      if (error) throw error;
      return (data ?? []) as AdminNotif[];
    },
    refetchInterval: 30_000,
  });

  const unreadCount = useMemo(() => notifs.filter((n) => !n.read_at).length, [notifs]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.rpc as any)("admin_notifications_mark_read", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["action-center", "admin"] });
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_notifications_mark_all_read");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`${n ?? 0} notification(s) marquée(s) comme lue(s).`);
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["action-center", "admin"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell size={22} /> Centre de notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Toutes les actions admin à traiter : KYC vendeurs, soumissions produits, commandes, SLA, audits critiques, RFQ.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            {markAll.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            Tout marquer comme lu ({unreadCount})
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Non lues</CardDescription>
            <CardTitle className="text-3xl text-red-600">{unreadCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total affiché</CardDescription>
            <CardTitle className="text-3xl">{notifs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Critiques (24h)</CardDescription>
            <CardTitle className="text-3xl text-amber-700">
              {notifs.filter((n) => n.severity === "critical" && Date.now() - new Date(n.created_at).getTime() < 86400000).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={onlyUnread ? "unread" : "all"} onValueChange={(v) => setOnlyUnread(v === "unread")}>
        <TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="unread">
            Non lues {unreadCount > 0 && <Badge variant="destructive" className="ml-2">{unreadCount}</Badge>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={onlyUnread ? "unread" : "all"} className="space-y-3 mt-4">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : notifs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {onlyUnread ? "✅ Toutes les notifications sont lues." : "Aucune notification."}
              </CardContent>
            </Card>
          ) : (
            notifs.map((n) => (
              <NotificationItem key={n.id} n={n} onMarkRead={(id) => markRead.mutate(id)} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
