// Admin — Fiche apporteur (6 onglets).
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CommissionCalcDetails } from "@/components/affiliate/CommissionCalcDetails";
import {
  fmtCents, fmtBp, fmtDate, AFFILIATE_STATUS_LABELS, COMMISSION_STATUS_LABELS,
  VAT_MODE_LABELS, type AffiliateRule, type CalcDetails,
} from "@/lib/affiliate-format";
import { ArrowLeft, Eye, Mail, Ban, Play, FileText, Check, Calculator, UserPlus } from "lucide-react";

/** Points de base <-> pourcentage (les règles sont stockées en bp côté serveur). */
const pctOf = (bp: number | null | undefined): string => {
  const v = Number(bp);
  return Number.isFinite(v) ? String(v / 100) : "";
};
const bpOf = (pct: string): number => Math.round((parseFloat(pct.replace(",", ".")) || 0) * 100);


/** TVA 21 % seulement en mode vat_21 ; total_cents est le montant HTVA. */
function vatCentsOf(p: { total_cents: number; vat_mode: string }): number {
  return p.vat_mode === "vat_21" ? Math.round((Number(p.total_cents) || 0) * 0.21) : 0;
}

export default function AdminAffiliateDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [holdDialog, setHoldDialog] = useState<{ id: string; margin: string; justification: string } | null>(null);
  const [payDialog, setPayDialog] = useState<{ id: string; date: string } | null>(null);
  const [override, setOverride] = useState<Partial<AffiliateRule> | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachSearch, setAttachSearch] = useState("");
  const [attachCustomer, setAttachCustomer] = useState<string | null>(null);
  const [simHt, setSimHt] = useState("1000");
  const [simMargin, setSimMargin] = useState("150");

  const sb = supabase as any;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-affiliate", id] });
    qc.invalidateQueries({ queryKey: ["admin-affiliate-commissions", id] });
    qc.invalidateQueries({ queryKey: ["admin-affiliate-payouts", id] });
    qc.invalidateQueries({ queryKey: ["admin-affiliate-referrals", id] });
    qc.invalidateQueries({ queryKey: ["admin-affiliate-stats", id] });
  };


  const { data: account } = useQuery({
    queryKey: ["admin-affiliate", id],
    queryFn: async () => {
      const { data, error } = await sb.rpc("affiliate_admin_account", { _affiliate_id: id });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-affiliate-stats", id],
    queryFn: async () => {
      const { data, error } = await sb.rpc("affiliate_dashboard_stats", { _affiliate_id: id });
      if (error) throw error;
      return (data ?? {}) as Record<string, number>;
    },
  });

  const { data: rule } = useQuery<AffiliateRule>({
    queryKey: ["admin-affiliate-rule", id],
    queryFn: async () => {
      const { data, error } = await sb.rpc("affiliate_current_rule", { _affiliate_id: id });
      if (error) throw error;
      return data as AffiliateRule;
    },
  });

  const { data: referrals = [] } = useQuery<any[]>({
    queryKey: ["admin-affiliate-referrals", id],
    queryFn: async () => {
      const { data, error } = await sb.rpc("affiliate_admin_referrals", { _affiliate_id: id });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: commissions = [] } = useQuery<any[]>({
    queryKey: ["admin-affiliate-commissions", id],
    queryFn: async () => {
      const { data, error } = await sb.rpc("affiliate_admin_commissions", { _affiliate_id: id });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: attachable = [], isFetching: attachLoading } = useQuery<any[]>({
    queryKey: ["admin-affiliate-attachable", attachSearch],
    enabled: attachOpen,
    queryFn: async () => {
      const { data, error } = await sb.rpc("affiliate_admin_attachable_customers", { _q: attachSearch || null });
      if (error) throw error;
      return data ?? [];
    },
  });

  const attachCustomerMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.rpc("affiliate_admin_attach_customer", {
        _affiliate_id: id,
        _customer_id: attachCustomer,
        _recompute_past_orders: true,
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(
        data.reason === "customer_without_account" ? "Ce client n'a pas de compte utilisateur : rattachement impossible."
          : data.reason === "already_attributed_to_other_affiliate" ? "Ce client est déjà attribué à un autre apporteur."
          : String(data.reason),
      );
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Client rattaché — ${data?.commissions_created ?? 0} commission(s) calculée(s) sur ses commandes payées`);
      setAttachOpen(false);
      setAttachCustomer(null);
      setAttachSearch("");
      qc.invalidateQueries({ queryKey: ["admin-affiliate-attachable"] });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });


  const { data: payouts = [] } = useQuery<any[]>({
    queryKey: ["admin-affiliate-payouts", id],
    queryFn: async () => {
      const { data, error } = await sb.rpc("affiliate_admin_payouts", { _affiliate_id: id });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async (intent: "suspend" | "reactivate" | "invite") => {
      const body = intent === "invite"
        ? { action: "invite", affiliate_id: id }
        : { action: "set_status", affiliate_id: id, status: intent === "suspend" ? "suspended" : "active" };
      const { error } = await supabase.functions.invoke("manage-affiliate", { body });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Compte mis à jour"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const saveOverride = useMutation({
    mutationFn: async () => {
      const { error } = await sb.rpc("affiliate_publish_rule", {
        _scope: "affiliate",
        _affiliate_id: id,
        _base_rate_bp: override?.base_rate_bp ?? rule?.base_rate_bp,
        _margin_guard_threshold_bp: override?.margin_guard_threshold_bp ?? rule?.margin_guard_threshold_bp,
        _margin_rate_bp: override?.margin_rate_bp ?? rule?.margin_rate_bp,
        _attribution_months: override?.attribution_months ?? rule?.attribution_months,
        _validation_delay_days: override?.validation_delay_days ?? rule?.validation_delay_days,
        _payout_threshold_cents: override?.payout_threshold_cents ?? rule?.payout_threshold_cents,
        _self_purchase_allowed: override?.self_purchase_allowed ?? rule?.self_purchase_allowed ?? false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nouvelle version de règle publiée pour cet apporteur");
      setOverride(null);
      qc.invalidateQueries({ queryKey: ["admin-affiliate-rule", id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const resolveHold = useMutation({
    mutationFn: async () => {
      const { error } = await sb.rpc("affiliate_admin_resolve_on_hold", {
        _commission_id: holdDialog!.id,
        _net_margin_cents: Math.round(parseFloat(holdDialog!.margin.replace(",", ".")) * 100),
        _justification: holdDialog!.justification,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Commission recalculée"); setHoldDialog(null); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const markPaid = useMutation({
    mutationFn: async () => {
      const { error } = await sb.rpc("affiliate_admin_mark_payout_paid", {
        _invoice_id: payDialog!.id,
        _paid_at: payDialog!.date,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payout marqué payé"); setPayDialog(null); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const openPdf = async (payoutId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("affiliate-payout-pdf", { body: { payout_id: payoutId } });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("PDF indisponible");
      window.open(url, "_blank", "noopener");
    } catch (e: any) { toast.error(e.message ?? "Erreur PDF"); }
  };

  const st = AFFILIATE_STATUS_LABELS[account?.status] ?? { label: account?.status ?? "", className: "" };
  const eff = { ...(rule ?? {}), ...(override ?? {}) } as AffiliateRule;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/apporteurs"><ArrowLeft className="h-4 w-4 mr-1" /> Tous les apporteurs</Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{account?.display_name ?? "…"}</h1>
          <p className="text-sm text-muted-foreground">
            {account?.company_name} · {account?.email} · code <span className="font-mono">{account?.affiliate_code}</span>
          </p>
          <Badge className={`mt-2 ${st.className}`}>{st.label}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/apporteur?as=${id}`} target="_blank"><Eye className="h-4 w-4 mr-1" /> Voir son portail</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStatus.mutate("invite")}>
            <Mail className="h-4 w-4 mr-1" /> Renvoyer l'invitation
          </Button>
          {account?.status === "active" ? (
            <Button variant="outline" size="sm" onClick={() => setStatus.mutate("suspend")}>
              <Ban className="h-4 w-4 mr-1" /> Suspendre
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setStatus.mutate("reactivate")}>
              <Play className="h-4 w-4 mr-1" /> Réactiver
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="synthese">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="synthese">Synthèse</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="regle">Règle</TabsTrigger>
          <TabsTrigger value="facturation">Facturation</TabsTrigger>
        </TabsList>

        <TabsContent value="synthese" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Clients attribués", String(stats?.referrals_active ?? 0)],
              ["Commandes", String(stats?.orders_count ?? 0)],
              ["CA HTVA apporté", fmtCents(stats?.revenue_ht_cents)],
              ["Panier moyen HTVA", fmtCents(stats?.avg_basket_ht_cents)],
              ["En attente", fmtCents(stats?.commissions_pending_cents)],
              ["Validées (à payer)", fmtCents(stats?.commissions_validated_cents)],
              ["Facturées", fmtCents(stats?.commissions_invoiced_cents)],
              ["Payées", fmtCents(stats?.commissions_paid_cents)],
            ].map(([label, value]) => (
              <Card key={label}><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold mt-1">{value}</p>
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>
                <th className="p-3">Client</th><th className="p-3">Email</th><th className="p-3">1ʳᵉ commande</th>
                <th className="p-3">Fin d'attribution</th><th className="p-3 text-right">Commandes</th>
                <th className="p-3 text-right">CA HTVA</th>
              </tr></thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{r.full_name ?? r.company_name ?? "—"}</td>
                    <td className="p-3 text-xs">{r.email ?? "—"}</td>
                    <td className="p-3">{fmtDate(r.first_order_at)}</td>
                    <td className="p-3">{fmtDate(r.window_expires_at)}</td>
                    <td className="p-3 text-right">{r.orders_count}</td>
                    <td className="p-3 text-right">{fmtCents(r.revenue_ht_cents)}</td>
                  </tr>
                ))}
                {referrals.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucun client.</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="commissions" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>
                <th className="p-3">Commande</th><th className="p-3">Date</th><th className="p-3">Client</th>
                <th className="p-3 text-right">HTVA</th><th className="p-3 text-right">Marge MediKong</th>
                <th className="p-3 text-right">Commission</th><th className="p-3">Statut</th><th className="p-3">Détail</th>
              </tr></thead>
              <tbody>
                {commissions.map((c) => {
                  const cs = COMMISSION_STATUS_LABELS[c.status] ?? { label: c.status, className: "" };
                  const details = c.calc_details as CalcDetails | null;
                  return (
                    <tr key={c.id} className="border-t align-top">
                      <td className="p-3 font-mono text-xs">{c.order_number ?? "—"}</td>
                      <td className="p-3">{fmtDate(c.order_date)}</td>
                      <td className="p-3 text-xs">{c.client_name ?? c.client_email ?? "—"}</td>
                      <td className="p-3 text-right">{fmtCents(c.order_total_ht_cents)}</td>
                      <td className="p-3 text-right">{fmtCents(c.net_margin_cents)}</td>
                      <td className="p-3 text-right font-medium">{fmtCents(c.commission_cents)}</td>
                      <td className="p-3">
                        <Badge className={cs.className}>{cs.label}</Badge>
                        {c.status === "on_hold" && (
                          <Button size="sm" variant="link" className="h-auto p-0 mt-1 block text-xs"
                            onClick={() => setHoldDialog({ id: c.id, margin: "", justification: "" })}>
                            Résoudre
                          </Button>
                        )}
                      </td>
                      <td className="p-3">
                        <CommissionCalcDetails details={details} internal ruleVersion={c.rule_version} />
                      </td>
                    </tr>
                  );
                })}
                {commissions.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Aucune commission.</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>
                <th className="p-3">Note</th><th className="p-3">Période</th><th className="p-3 text-right">HTVA</th>
                <th className="p-3 text-right">TVA</th><th className="p-3 text-right">Total</th>
                <th className="p-3">Statut</th><th className="p-3 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{p.invoice_number}</td>
                    <td className="p-3">{fmtDate(p.period_start)} → {fmtDate(p.period_end)}</td>
                    <td className="p-3 text-right">{fmtCents(p.total_cents)}</td>
                    <td className="p-3 text-right">
                      {fmtCents(vatCentsOf(p))}
                      <p className="text-[11px] text-muted-foreground">{VAT_MODE_LABELS[p.vat_mode] ?? p.vat_mode}</p>
                    </td>
                    <td className="p-3 text-right font-medium">{fmtCents(Number(p.total_cents) + vatCentsOf(p))}</td>
                    <td className="p-3">
                      {p.status}
                      {p.paid_at && <p className="text-[11px] text-muted-foreground">le {fmtDate(p.paid_at)}</p>}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => openPdf(p.id)}><FileText className="h-4 w-4" /></Button>
                      {p.status !== "paid" && (
                        <Button size="sm" variant="ghost"
                          onClick={() => setPayDialog({ id: p.id, date: new Date().toISOString().slice(0, 10) })}>
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {payouts.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucun payout.</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="regle" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Règle appliquée à cet apporteur</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Règle active : v{rule?.version} ({rule?.scope === "affiliate" ? "override apporteur" : "défaut global"}).
                Toute modification crée une nouvelle version et ne touche pas les commissions déjà calculées.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["base_rate_bp", "Taux de base sur le CA HTVA", "%", "Ex. 3 % du montant HTVA de la commande."],
                  ["margin_guard_threshold_bp", "Plafond : part max. de la marge MediKong", "%", "Si la commission dépasse ce % de notre marge, on bascule sur le taux ci-dessous."],
                  ["margin_rate_bp", "Taux appliqué à la marge si plafond atteint", "%", "Commission = ce % de la marge nette MediKong."],
                ] as const).map(([key, label, unit, help]) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={pctOf((eff as any)[key])}
                        onChange={(e) => setOverride({ ...(override ?? {}), [key]: bpOf(e.target.value) })}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{help}</p>
                  </div>
                ))}
                {([
                  ["attribution_months", "Durée d'attribution (mois)"],
                  ["validation_delay_days", "Délai de validation (jours)"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <Input
                      type="number"
                      value={String((eff as any)[key] ?? "")}
                      onChange={(e) => setOverride({ ...(override ?? {}), [key]: Number(e.target.value) })}
                    />
                  </div>
                ))}
                <div>
                  <Label>Seuil de paiement (€ HTVA)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={String((Number(eff.payout_threshold_cents) || 0) / 100)}
                    onChange={(e) => setOverride({
                      ...(override ?? {}),
                      payout_threshold_cents: Math.round((parseFloat(e.target.value.replace(",", ".")) || 0) * 100),
                    })}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Aucun paiement n'est déclenché sous ce solde validé.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={Boolean(eff.self_purchase_allowed)}
                  onCheckedChange={(v) => setOverride({ ...(override ?? {}), self_purchase_allowed: v })}
                />
                <Label>Autoriser les commissions sur ses propres achats</Label>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calculator className="h-4 w-4" /> Simulateur de commission
                </div>
                <p className="text-xs text-muted-foreground">
                  Règle en clair : commission = {fmtBp(eff.base_rate_bp)} du CA HTVA, sauf si ce montant dépasse{" "}
                  {fmtBp(eff.margin_guard_threshold_bp)} de la marge nette MediKong — dans ce cas la commission devient{" "}
                  {fmtBp(eff.margin_rate_bp)} de cette marge.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Commande HTVA (€)</Label>
                    <Input type="number" step="0.01" value={simHt} onChange={(e) => setSimHt(e.target.value)} />
                  </div>
                  <div>
                    <Label>Marge nette MediKong (€)</Label>
                    <Input type="number" step="0.01" value={simMargin} onChange={(e) => setSimMargin(e.target.value)} />
                  </div>
                </div>
                <ul className="text-sm space-y-1">
                  <li>
                    Base : {fmtBp(eff.base_rate_bp)} × {fmtCents(sim.htCents)} ={" "}
                    <span className="font-medium">{fmtCents(sim.baseCents)}</span>
                  </li>
                  <li>
                    Plafond : {fmtBp(eff.margin_guard_threshold_bp)} × {fmtCents(sim.marginCents)} ={" "}
                    <span className="font-medium">{fmtCents(sim.guardCents)}</span>
                  </li>
                  <li className="text-muted-foreground">
                    {sim.capped
                      ? `Plafond atteint : on applique ${fmtBp(eff.margin_rate_bp)} de la marge.`
                      : "Sous le plafond : c'est la base qui s'applique."}
                  </li>
                  <li className="pt-1 border-t">
                    Commission apporteur :{" "}
                    <span className="font-semibold text-base">{fmtCents(sim.commissionCents)}</span>
                    {sim.htCents > 0 && (
                      <span className="text-muted-foreground text-xs">
                        {" "}· soit {((sim.commissionCents / sim.htCents) * 100).toFixed(2)} % du CA HTVA
                        {sim.marginCents > 0 && ` et ${((sim.commissionCents / sim.marginCents) * 100).toFixed(2)} % de notre marge`}
                      </span>
                    )}
                  </li>
                </ul>
              </div>

              <Button disabled={!override || saveOverride.isPending} onClick={() => saveOverride.mutate()}>
                Publier une nouvelle version pour cet apporteur
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facturation" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Coordonnées de facturation</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              <div><p className="text-xs text-muted-foreground">Bénéficiaire</p><p>{account?.company_name || account?.display_name}</p></div>
              <div><p className="text-xs text-muted-foreground">Numéro de TVA</p><p>{account?.vat_number || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">IBAN</p><p className="font-mono">{account?.iban_masked || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Régime TVA</p><p>"Défini sur chaque note de commission"</p></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(holdDialog)} onOpenChange={(o) => !o && setHoldDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Résoudre une commission en vérification</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Marge nette MediKong retenue (€ HTVA)</Label>
              <Input value={holdDialog?.margin ?? ""} onChange={(e) => setHoldDialog({ ...holdDialog!, margin: e.target.value })} />
            </div>
            <div>
              <Label>Justification (obligatoire)</Label>
              <Textarea
                value={holdDialog?.justification ?? ""}
                onChange={(e) => setHoldDialog({ ...holdDialog!, justification: e.target.value })}
                placeholder="Prix d'achat reconstitué depuis la facture fournisseur du 12/07."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!holdDialog?.margin || !holdDialog?.justification.trim() || resolveHold.isPending}
              onClick={() => resolveHold.mutate()}
            >
              Recalculer la commission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(payDialog)} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marquer le payout comme payé</DialogTitle></DialogHeader>
          <div>
            <Label>Date du virement</Label>
            <Input type="date" value={payDialog?.date ?? ""} onChange={(e) => setPayDialog({ ...payDialog!, date: e.target.value })} />
          </div>
          <DialogFooter>
            <Button disabled={!payDialog?.date || markPaid.isPending} onClick={() => markPaid.mutate()}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
