// Portail apporteur — Dashboard.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAffiliateAccount, affiliateArgs } from "@/hooks/useAffiliateAccount";
import { fmtCents, fmtRatio, howIEarnText, type AffiliateRule } from "@/lib/affiliate-format";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, LabelList,
} from "recharts";
import { Info } from "lucide-react";

type Stats = Record<string, number>;
type Week = { week_start: string; signups: number; orders: number; commission_cents: number; scans: number };

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold mt-1">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function AffiliateDashboardPage() {
  const { account, asAffiliateId } = useAffiliateAccount();
  const args = affiliateArgs(asAffiliateId);

  const { data: stats } = useQuery<Stats>({
    queryKey: ["affiliate-stats", asAffiliateId],
    enabled: Boolean(account),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("affiliate_dashboard_stats", args);
      if (error) throw error;
      return (data as Stats) ?? {};
    },
  });

  const { data: rule } = useQuery<AffiliateRule>({
    queryKey: ["affiliate-rule", asAffiliateId],
    enabled: Boolean(account),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("affiliate_current_rule", args);
      if (error) throw error;
      return data as AffiliateRule;
    },
  });

  const { data: weeks = [] } = useQuery<Week[]>({
    queryKey: ["affiliate-weeks", asAffiliateId],
    enabled: Boolean(account),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("affiliate_weekly_series", { ...args, _weeks: 12 });
      if (error) throw error;
      return (data as Week[]) ?? [];
    },
  });

  const validated = Number(stats?.commissions_validated_cents ?? 0);
  const threshold = Number(rule?.payout_threshold_cents ?? 5000);
  const progress = threshold > 0 ? Math.min(100, Math.round((validated / threshold) * 100)) : 0;

  const funnel = [
    { step: "Scans / clics", value: Number(stats?.scans ?? 0) },
    { step: "Visiteurs uniques", value: Number(stats?.unique_visitors ?? 0) },
    { step: "Inscriptions", value: Number(stats?.signups ?? 0) },
    { step: "1er achat", value: Number(stats?.first_purchases ?? 0) },
  ];

  const series = weeks.map((w) => ({
    week: new Date(w.week_start).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" }),
    Clics: Number(w.scans ?? 0),
    Inscriptions: Number(w.signups ?? 0),
    Commandes: Number(w.orders ?? 0),
    "Commissions (€)": Number(w.commission_cents ?? 0) / 100,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Tous les montants sont HTVA.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Clics / scans" value={String(stats?.scans ?? 0)} />
        <Tile label="Inscriptions" value={String(stats?.signups ?? 0)} />
        <Tile
          label="Clients actifs"
          value={String(stats?.referrals_active ?? 0)}
          hint={`suivis ${rule?.attribution_months ?? 12} mois après leur 1ʳᵉ commande`}
        />
        <Tile label="Commandes attribuées" value={String(stats?.orders_count ?? 0)} />
        <Tile label="Panier moyen HTVA" value={fmtCents(stats?.avg_basket_ht_cents)} />
        <Tile label="Taux de récurrence" value={fmtRatio(stats?.repeat_rate)} hint="clients ≥ 2 commandes ÷ clients ≥ 1" />
        <Tile label="Commissions en attente" value={fmtCents(stats?.commissions_pending_cents)} />
        <Tile label="Commissions validées" value={fmtCents(stats?.commissions_validated_cents)} />
        <Tile label="Commissions facturées" value={fmtCents(stats?.commissions_invoiced_cents)} />
        <Tile label="Commissions payées" value={fmtCents(stats?.commissions_paid_cents)} />
        <Tile label="CA HTVA apporté" value={fmtCents(stats?.revenue_ht_cents)} />
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Prochain payout estimé</p>
            <p className="text-xl font-semibold mt-1">{fmtCents(validated)}</p>
            <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Seuil de paiement : {fmtCents(threshold)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Funnel d'acquisition</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="step" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="value" position="right" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Évolution hebdomadaire</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Clics" stroke="hsl(var(--primary))" dot={false} />
                <Line type="monotone" dataKey="Inscriptions" stroke="hsl(var(--chart-2, 160 70% 40%))" dot={false} />
                <Line type="monotone" dataKey="Commandes" stroke="hsl(var(--chart-3, 40 90% 50%))" dot={false} />
                <Line type="monotone" dataKey="Commissions (€)" stroke="hsl(var(--chart-4, 280 60% 55%))" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" /> Comment je gagne
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {howIEarnText(rule).map((l, i) => <li key={i}>• {l}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
