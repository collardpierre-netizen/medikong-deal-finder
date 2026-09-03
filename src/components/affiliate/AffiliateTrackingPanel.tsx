// Suivi complet d'un apporteur : visites, scans, inscriptions, commandes rattachées, commissions.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { fmtCents, fmtDate, COMMISSION_STATUS_LABELS } from "@/lib/affiliate-format";

const EVENT_LABELS: Record<string, string> = {
  scan: "Scan QR / lien",
  visit: "Visite",
  signup_started: "Inscription démarrée",
  signup_completed: "Inscription terminée",
  activated: "Compte activé",
  first_purchase: "Première commande",
  code_redeemed: "Code utilisé",
};

interface CampaignRow {
  campaign_id: string; slug: string; name: string; status: string;
  visits: number; scans: number; unique_visitors: number;
  signups_started: number; signups_completed: number; first_purchases: number;
  last_event_at: string | null;
}
interface EventRow {
  id: string; created_at: string; event_type: string; campaign_slug: string | null;
  code: string | null; visitor_id: string | null; user_id: string | null;
  user_email: string | null; ua_family: string | null; referrer_host: string | null;
}
interface OrderRow {
  order_id: string; order_number: string; order_date: string; customer_name: string | null;
  order_total_ht_cents: number; net_margin_cents: number | null;
  commission_cents: number; commission_status: string; order_status: string;
}

const Kpi = ({ label, value }: { label: string; value: string | number }) => (
  <div className="border rounded-lg p-3">
    <div className="text-[11px] text-muted-foreground">{label}</div>
    <div className="text-lg font-semibold tabular-nums">{value}</div>
  </div>
);

export function AffiliateTrackingPanel({ affiliateId }: { affiliateId: string }) {
  const sb = supabase as any;

  const { data: campaigns = [] } = useQuery<CampaignRow[]>({
    queryKey: ["admin-affiliate-tracking-campaigns", affiliateId],
    queryFn: async () => {
      const { data, error } = await sb.rpc("affiliate_admin_tracking_by_campaign", { _affiliate_id: affiliateId });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery<EventRow[]>({
    queryKey: ["admin-affiliate-tracking-events", affiliateId],
    queryFn: async () => {
      const { data, error } = await sb.rpc("affiliate_admin_tracking_events", { _affiliate_id: affiliateId, _limit: 150 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orders = [] } = useQuery<OrderRow[]>({
    queryKey: ["admin-affiliate-attached-orders", affiliateId],
    queryFn: async () => {
      const { data, error } = await sb.rpc("affiliate_admin_attached_orders", { _affiliate_id: affiliateId, _limit: 200 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const sum = (k: keyof CampaignRow) => campaigns.reduce((s, c) => s + (Number(c[k]) || 0), 0);
  const commissionsTotal = orders.reduce((s, o) => s + (Number(o.commission_cents) || 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Entonnoir d'acquisition</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <Kpi label="Visites" value={sum("visits")} />
          <Kpi label="Scans" value={sum("scans")} />
          <Kpi label="Visiteurs uniques" value={sum("unique_visitors")} />
          <Kpi label="Inscriptions démarrées" value={sum("signups_started")} />
          <Kpi label="Inscriptions terminées" value={sum("signups_completed")} />
          <Kpi label="Commandes rattachées" value={orders.length} />
          <Kpi label="Commissions" value={`${fmtCents(commissionsTotal)} €`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Par campagne</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune campagne de suivi associée à cet apporteur.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Campagne</th>
                  <th className="text-right">Visites</th>
                  <th className="text-right">Scans</th>
                  <th className="text-right">Visiteurs</th>
                  <th className="text-right">Insc. démarrées</th>
                  <th className="text-right">Insc. terminées</th>
                  <th className="text-right">1res commandes</th>
                  <th className="text-right">Dernier événement</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.campaign_id} className="border-b last:border-0">
                    <td className="py-2">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">/go/{c.slug}</div>
                    </td>
                    <td className="text-right tabular-nums">{c.visits}</td>
                    <td className="text-right tabular-nums">{c.scans}</td>
                    <td className="text-right tabular-nums">{c.unique_visitors}</td>
                    <td className="text-right tabular-nums">{c.signups_started}</td>
                    <td className="text-right tabular-nums">{c.signups_completed}</td>
                    <td className="text-right tabular-nums">{c.first_purchases}</td>
                    <td className="text-right text-xs text-muted-foreground">{c.last_event_at ? fmtDate(c.last_event_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Commandes rattachées & commissions</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune commande rattachée pour le moment.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Commande</th>
                  <th className="text-left">Client</th>
                  <th className="text-right">CA HT</th>
                  <th className="text-right">Marge nette</th>
                  <th className="text-right">Commission</th>
                  <th className="text-left pl-3">Statut commission</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order_id} className="border-b last:border-0">
                    <td className="py-2">
                      <Link to={`/admin/commandes/${o.order_id}`} className="font-mono text-primary hover:underline">{o.order_number}</Link>
                      <div className="text-xs text-muted-foreground">{fmtDate(o.order_date)}</div>
                    </td>
                    <td>{o.customer_name ?? "—"}</td>
                    <td className="text-right tabular-nums">{fmtCents(o.order_total_ht_cents)} €</td>
                    <td className="text-right tabular-nums">{o.net_margin_cents == null ? "—" : `${fmtCents(o.net_margin_cents)} €`}</td>
                    <td className="text-right tabular-nums font-semibold">{fmtCents(o.commission_cents)} €</td>
                    <td className="pl-3"><Badge variant="outline">{COMMISSION_STATUS_LABELS[o.commission_status] ?? o.commission_status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Journal d'activité (150 derniers événements)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left">Événement</th>
                  <th className="text-left">Campagne</th>
                  <th className="text-left">Code</th>
                  <th className="text-left">Utilisateur</th>
                  <th className="text-left">Appareil</th>
                  <th className="text-left">Source</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2 text-xs whitespace-nowrap">{fmtDate(e.created_at)}</td>
                    <td>{EVENT_LABELS[e.event_type] ?? e.event_type}</td>
                    <td className="font-mono text-xs">{e.campaign_slug ?? "—"}</td>
                    <td className="font-mono text-xs">{e.code ?? "—"}</td>
                    <td className="text-xs">{e.user_email ?? (e.visitor_id ? `visiteur ${e.visitor_id.slice(0, 8)}` : "—")}</td>
                    <td className="text-xs">{e.ua_family ?? "—"}</td>
                    <td className="text-xs">{e.referrer_host ?? "direct"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
