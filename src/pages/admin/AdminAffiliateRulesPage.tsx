// Admin — Règles de commission globales + simulateur.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fmtCents, fmtBp, fmtDate, type AffiliateRule } from "@/lib/affiliate-format";
import { Settings2, Calculator } from "lucide-react";

const FIELDS = [
  ["base_rate_bp", "Taux de base sur le HTVA (points de base — 200 = 2 %)"],
  ["margin_guard_threshold_bp", "Plafond exprimé en % de la marge MediKong (bp — 2000 = 20 %)"],
  ["margin_rate_bp", "Taux appliqué à la marge si le plafond est atteint (bp)"],
  ["attribution_months", "Durée d'attribution d'un client (mois)"],
  ["validation_delay_days", "Délai avant validation d'une commission (jours)"],
  ["payout_threshold_cents", "Seuil minimum de paiement (cents)"],
] as const;

export default function AdminAffiliateRulesPage() {
  const sb = supabase as any;
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<AffiliateRule>>({});
  const [sim, setSim] = useState({ total: "1000", margin: "200" });
  const [costs, setCosts] = useState<{ payment_fee_bp: string; logistics_fee_bp: string } | null>(null);

  const { data: rule } = useQuery<AffiliateRule>({
    queryKey: ["affiliate-global-rule"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("affiliate_current_rule", {});
      if (error) throw error;
      return data as AffiliateRule;
    },
  });

  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["affiliate-rule-history"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("affiliate_rule_history", { _scope: "global" });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: costParams } = useQuery<any>({
    queryKey: ["affiliate-cost-params"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_margin_cost_params")
        .select("id, payment_fee_bp, payment_fee_fixed_cents, deduct_cagnotte, effective_from")
        .is("effective_to", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const eff = { ...(rule ?? {}), ...draft } as AffiliateRule;

  const publish = useMutation({
    mutationFn: async () => {
      const { error } = await sb.rpc("affiliate_publish_rule", {
        _scope: "global",
        _affiliate_id: null,
        _base_rate_bp: eff.base_rate_bp,
        _margin_guard_threshold_bp: eff.margin_guard_threshold_bp,
        _margin_rate_bp: eff.margin_rate_bp,
        _attribution_months: eff.attribution_months,
        _validation_delay_days: eff.validation_delay_days,
        _payout_threshold_cents: eff.payout_threshold_cents,
        _self_purchase_allowed: eff.self_purchase_allowed ?? false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nouvelle version publiée — les commissions existantes ne sont pas recalculées");
      setDraft({});
      qc.invalidateQueries({ queryKey: ["affiliate-global-rule"] });
      qc.invalidateQueries({ queryKey: ["affiliate-rule-history"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const publishCosts = useMutation({
    mutationFn: async () => {
      const { error } = await sb.rpc("affiliate_publish_cost_params", {
        _payment_fee_bp: Number(costs?.payment_fee_bp ?? costParams?.payment_fee_bp ?? 0),
        _payment_fee_fixed_cents: Number(costs?.logistics_fee_bp ?? costParams?.payment_fee_fixed_cents ?? 0),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paramètres de coûts publiés");
      setCosts(null);
      qc.invalidateQueries({ queryKey: ["affiliate-cost-params"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  // Simulateur local, miroir exact de la logique serveur (base vs plafond marge).
  const simulation = useMemo(() => {
    const totalCents = Math.round((parseFloat(sim.total.replace(",", ".")) || 0) * 100);
    const marginCents = Math.round((parseFloat(sim.margin.replace(",", ".")) || 0) * 100);
    const base = Math.round((totalCents * (eff.base_rate_bp ?? 0)) / 10000);
    const guard = Math.round((marginCents * (eff.margin_guard_threshold_bp ?? 0)) / 10000);
    const hit = base > guard;
    const commission = hit ? Math.round((marginCents * (eff.margin_rate_bp ?? 0)) / 10000) : base;
    return { totalCents, marginCents, base, guard, hit, commission };
  }, [sim, eff]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Settings2 className="h-6 w-6" /> Règles de commission
        </h1>
        <p className="text-sm text-muted-foreground">
          Défaut global appliqué à tous les apporteurs sans override. Montants HTVA.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Règle par défaut (v{rule?.version})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {FIELDS.map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input
                  type="number"
                  value={String((eff as any)[key] ?? "")}
                  onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Switch
                checked={Boolean(eff.self_purchase_allowed)}
                onCheckedChange={(v) => setDraft({ ...draft, self_purchase_allowed: v })}
              />
              <Label>Autoriser les commissions sur les achats de l'apporteur lui-même</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Publier crée une nouvelle version : les commissions déjà calculées gardent leur version d'origine.
            </p>
            <Button disabled={Object.keys(draft).length === 0 || publish.isPending} onClick={() => publish.mutate()}>
              Publier une nouvelle version
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> Simulateur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Montant de la commande (€ HTVA)</Label>
                  <Input value={sim.total} onChange={(e) => setSim({ ...sim, total: e.target.value })} />
                </div>
                <div>
                  <Label>Marge nette MediKong (€)</Label>
                  <Input value={sim.margin} onChange={(e) => setSim({ ...sim, margin: e.target.value })} />
                </div>
              </div>
              <ul className="text-sm space-y-1 rounded-md bg-muted/60 p-3">
                <li>Base : {fmtBp(eff.base_rate_bp)} de {fmtCents(simulation.totalCents)} = <strong>{fmtCents(simulation.base)}</strong></li>
                <li>Plafond : {fmtBp(eff.margin_guard_threshold_bp)} de {fmtCents(simulation.marginCents)} = <strong>{fmtCents(simulation.guard)}</strong></li>
                <li>{simulation.hit
                  ? `Plafond atteint → ${fmtBp(eff.margin_rate_bp)} de la marge`
                  : "Plafond non atteint → la base s'applique"}</li>
                <li className="pt-1 border-t">Commission : <strong>{fmtCents(simulation.commission)}</strong></li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Cas de contrôle : 1 000 € / marge 200 € → 4,00 € (plafond) ; 1 000 € / marge 500 € → 20,00 € (base).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Paramètres de coûts (marge nette)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Frais de paiement (bp)</Label>
                  <Input
                    type="number"
                    value={costs?.payment_fee_bp ?? String(costParams?.payment_fee_bp ?? "")}
                    onChange={(e) => setCosts({
                      payment_fee_bp: e.target.value,
                      logistics_fee_bp: costs?.logistics_fee_bp ?? String(costParams?.payment_fee_fixed_cents ?? ""),
                    })}
                  />
                </div>
                <div>
                  <Label>Frais de paiement fixes (cents / commande)</Label>
                  <Input
                    type="number"
                    value={costs?.logistics_fee_bp ?? String(costParams?.payment_fee_fixed_cents ?? "")}
                    onChange={(e) => setCosts({
                      payment_fee_bp: costs?.payment_fee_bp ?? String(costParams?.payment_fee_bp ?? ""),
                      logistics_fee_bp: e.target.value,
                    })}
                  />
                </div>
              </div>
              <Button size="sm" disabled={!costs || publishCosts.isPending} onClick={() => publishCosts.mutate()}>
                Publier ces paramètres
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique des versions</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left"><tr>
              <th className="p-3">Version</th><th className="p-3">Base</th><th className="p-3">Plafond marge</th>
              <th className="p-3">Taux marge</th><th className="p-3">Attribution</th><th className="p-3">Validation</th>
              <th className="p-3">Publiée le</th><th className="p-3">Statut</th>
            </tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id ?? h.version} className="border-t">
                  <td className="p-3">v{h.version}</td>
                  <td className="p-3">{fmtBp(h.base_rate_bp)}</td>
                  <td className="p-3">{fmtBp(h.margin_guard_threshold_bp)}</td>
                  <td className="p-3">{fmtBp(h.margin_rate_bp)}</td>
                  <td className="p-3">{h.attribution_months} mois</td>
                  <td className="p-3">{h.validation_delay_days} j</td>
                  <td className="p-3">{fmtDate(h.effective_from ?? h.created_at)}</td>
                  <td className="p-3">
                    {h.effective_to == null
                      ? <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
                      : <Badge variant="secondary">Archivée</Badge>}
                  </td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Aucune version.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
