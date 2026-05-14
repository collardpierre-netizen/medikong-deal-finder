import { useMemo, useState } from "react";
import { useRfqQuota, useRfqPlans, useRfqLedger, type RfqPlan } from "@/hooks/useRfqQuota";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Infinity as InfinityIcon, Sparkles, Calendar, History, Check } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useMoneyFormat } from "@/lib/money-format";

const KIND_LABEL: Record<string, string> = {
  consume: "Demande de prix",
  grant_admin: "Octroi admin",
  purchase_pack: "Achat de pack",
  subscribe_plan: "Activation forfait",
  monthly_reset: "Reset mensuel",
  refund: "Remboursement",
  expire_plan: "Expiration forfait",
};

export default function RfqCreditsPage() {
  const { data: quota } = useRfqQuota();
  const { data: plans } = useRfqPlans();
  const { data: ledger } = useRfqLedger(30);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { formatMoneyFromCents } = useMoneyFormat();
  const formatEur = (cents: number) => formatMoneyFromCents(cents, { withSymbol: false });

  const grouped = useMemo(() => {
    const arr = (plans || []) as RfqPlan[];
    return {
      packs: arr.filter((p) => p.plan_type === "credit_pack"),
      monthly: arr.filter((p) => p.plan_type === "monthly_plan" || p.plan_type === "unlimited_plan"),
    };
  }, [plans]);

  const handlePurchase = async (plan: RfqPlan) => {
    setPurchasing(plan.code);
    try {
      // TODO: brancher Stripe checkout (edge function `rfq-create-checkout`)
      toast.info("Le paiement en ligne arrive très bientôt. En attendant, contactez-nous pour activer ce forfait.");
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Mes crédits RFQ</h1>
        <p className="text-sm text-muted-foreground">Suivez votre quota, rechargez ou activez un forfait pour interroger nos vendeurs.</p>
      </div>

      {/* Solde actuel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solde actuel</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" /> Quota mensuel
            </div>
            {quota?.unlimited ? (
              <div className="mt-2 flex items-baseline gap-1">
                <InfinityIcon className="h-7 w-7 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-600">Illimité</span>
              </div>
            ) : (
              <div className="mt-2">
                <div className="text-3xl font-bold tabular-nums">{quota?.monthly_remaining ?? 0}</div>
                <div className="text-xs text-muted-foreground">sur {quota?.monthly_quota ?? 0} ce mois</div>
              </div>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <Coins className="h-3.5 w-3.5" /> Crédits achetés
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold tabular-nums">{quota?.permanent_credits ?? 0}</div>
              <div className="text-xs text-muted-foreground">valables à vie</div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <Calendar className="h-3.5 w-3.5" /> Forfait
            </div>
            <div className="mt-2 space-y-1">
              {quota?.unlimited && quota.reason === "admin" ? (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Compte admin</Badge>
              ) : quota?.active_plan_id ? (
                <>
                  <Badge variant="secondary">Actif</Badge>
                  {quota.plan_expires_at && (
                    <div className="text-xs text-muted-foreground">
                      Renouvellement : {new Date(quota.plan_expires_at).toLocaleDateString("fr-BE")}
                    </div>
                  )}
                </>
              ) : (
                <Badge variant="outline">Aucun</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forfaits récurrents */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Forfaits mensuels</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {grouped.monthly.map((p) => (
            <Card key={p.id} className={p.is_unlimited ? "border-primary/40 ring-1 ring-primary/20" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{p.label}</CardTitle>
                    <CardDescription className="mt-1">{p.description}</CardDescription>
                  </div>
                  {p.is_unlimited && <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Premium</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-bold">
                  {formatEur(p.price_cents)} € <span className="text-sm font-normal text-muted-foreground">/ mois HTVA</span>
                </div>
                <ul className="text-sm space-y-1.5">
                  {p.is_unlimited ? (
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> Demandes de prix <strong>illimitées</strong></li>
                  ) : (
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> {p.monthly_quota} demandes par mois</li>
                  )}
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> Renouvellement automatique</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> Routage multi-vendeurs prioritaire</li>
                </ul>
                <Button className="w-full" onClick={() => handlePurchase(p)} disabled={purchasing === p.code}>
                  Activer ce forfait
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Packs de crédits */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Packs de crédits (à vie)</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {grouped.packs.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-base">{p.label}</CardTitle>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-bold">
                  {formatEur(p.price_cents)} € <span className="text-sm font-normal text-muted-foreground">HTVA</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Soit <strong>{(p.price_cents / 100 / Math.max(p.credits_included, 1)).toFixed(2)} €</strong> par demande.
                </p>
                <Button variant="outline" className="w-full" onClick={() => handlePurchase(p)} disabled={purchasing === p.code}>
                  Acheter ce pack
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Historique */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Historique récent</h2>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground uppercase">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Quota</th>
                  <th className="px-3 py-2 text-right">Crédits</th>
                  <th className="px-3 py-2">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(ledger || []).map((l: any) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("fr-BE")}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="font-normal">{KIND_LABEL[l.kind] || l.kind}</Badge></td>
                    <td className={`px-3 py-2 text-right tabular-nums ${l.delta_quota < 0 ? "text-destructive" : l.delta_quota > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {l.delta_quota > 0 ? "+" : ""}{l.delta_quota || "—"}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${l.delta_permanent < 0 ? "text-destructive" : l.delta_permanent > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {l.delta_permanent > 0 ? "+" : ""}{l.delta_permanent || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {l.reason}
                      {l.rfq_id && <Link to="/compte/mes-rfq" className="ml-2 text-primary hover:underline">voir RFQ</Link>}
                    </td>
                  </tr>
                ))}
                {(!ledger || ledger.length === 0) && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune transaction pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
