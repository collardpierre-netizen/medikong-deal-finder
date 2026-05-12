import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BarChart3, Sparkles, CreditCard, FileText, Loader2, XCircle, MailQuestion, CheckCircle2 } from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";

type Row = {
  vendor_id: string;
  vendor_name: string | null;
  status: "none" | "trial" | "active" | "expired" | "cancelled";
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_days_remaining: number | null;
  subscription_started_at: string | null;
  subscription_current_period_end: string | null;
  plan_label: string | null;
  monthly_price_cents: number | null;
  billing_method: "stripe" | "medikong_invoice" | null;
  has_access: boolean;
};

const STATUS_META: Record<Row["status"], { label: string; cls: string }> = {
  none:      { label: "Non activé", cls: "bg-muted text-muted-foreground" },
  trial:     { label: "Essai gratuit", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  active:    { label: "Abonné", cls: "bg-primary text-primary-foreground" },
  expired:   { label: "Expiré", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  cancelled: { label: "Annulé", cls: "bg-rose-100 text-rose-800 border-rose-300" },
};

function formatPrice(c: number | null) {
  if (c == null) return "—";
  return (c / 100).toLocaleString("fr-BE", { style: "currency", currency: "EUR" });
}

export default function AdminVendorMarketIntelPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [trialDialog, setTrialDialog] = useState<{ vendorId: string; vendorName: string } | null>(null);
  const [trialDays, setTrialDays] = useState(180);
  const [activateDialog, setActivateDialog] = useState<{ vendorId: string; vendorName: string } | null>(null);
  const [planId, setPlanId] = useState<string>("");
  const [billing, setBilling] = useState<"stripe" | "medikong_invoice">("medikong_invoice");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-vmi-list", search],
    queryFn: async () => {
      let q: any = supabase.from("vendor_market_intel_status_v" as any).select("*").limit(500);
      if (search.trim().length >= 2) q = q.ilike("vendor_name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["admin-vmi-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_market_intel_plans" as any)
        .select("id, code, label, monthly_price_cents, ean_quota")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const startTrial = useMutation({
    mutationFn: async ({ vendorId, days }: { vendorId: string; days: number }) => {
      const { error } = await supabase.rpc("start_vendor_market_intel_trial" as any, {
        _vendor_id: vendorId, _trial_days: days, _notes: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Essai démarré");
      setTrialDialog(null);
      qc.invalidateQueries({ queryKey: ["admin-vmi-list"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const activate = useMutation({
    mutationFn: async ({ vendorId, plan, billingMethod }: { vendorId: string; plan: string; billingMethod: string }) => {
      const { error } = await supabase.rpc("activate_vendor_market_intel_subscription" as any, {
        _vendor_id: vendorId, _plan_id: plan, _billing_method: billingMethod,
        _stripe_subscription_id: null, _period_end: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Abonnement activé");
      setActivateDialog(null);
      setPlanId("");
      qc.invalidateQueries({ queryKey: ["admin-vmi-list"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const cancel = useMutation({
    mutationFn: async (vendorId: string) => {
      const { error } = await supabase.rpc("cancel_vendor_market_intel_subscription" as any, { _vendor_id: vendorId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Abonnement annulé");
      qc.invalidateQueries({ queryKey: ["admin-vmi-list"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  return (
    <>
      <Helmet><title>Veille marché vendeurs · Admin · MediKong</title></Helmet>
      <div className="container mx-auto py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Veille marché — abonnements vendeurs</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Démarrez un essai gratuit de 180 jours par vendeur, activez un abonnement (Stripe ou facturation MediKong)
          à la fin de l'essai, ou résiliez l'accès. Les essais expirent automatiquement chaque heure.
        </p>

        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recherche</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Nom du vendeur (≥ 2 caractères)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Vendeur</th>
                    <th className="px-3 py-2 text-left">Statut</th>
                    <th className="px-3 py-2 text-left">Plan</th>
                    <th className="px-3 py-2 text-left">Échéance</th>
                    <th className="px-3 py-2 text-left">Paiement</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const m = STATUS_META[r.status];
                    const deadline = r.status === "trial" ? r.trial_ends_at : r.subscription_current_period_end;
                    return (
                      <tr key={r.vendor_id} className="border-t">
                        <td className="px-3 py-2 font-medium">{r.vendor_name || r.vendor_id.slice(0, 8)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={m.cls}>{m.label}</Badge>
                          {r.status === "trial" && r.trial_days_remaining != null && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {r.trial_days_remaining} j restants
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {r.plan_label ? (
                            <span>{r.plan_label} <span className="text-xs text-muted-foreground">· {formatPrice(r.monthly_price_cents)}/mois</span></span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs">{deadline ? formatUpdatedAt(deadline) : "—"}</td>
                        <td className="px-3 py-2 text-xs">
                          {r.billing_method === "stripe" && <span className="inline-flex items-center gap-1"><CreditCard className="h-3 w-3" /> Stripe</span>}
                          {r.billing_method === "medikong_invoice" && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> Facture MediKong</span>}
                          {!r.billing_method && "—"}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {(r.status === "none" || r.status === "expired" || r.status === "cancelled") && (
                            <Button size="sm" variant="outline" onClick={() => { setTrialDays(180); setTrialDialog({ vendorId: r.vendor_id, vendorName: r.vendor_name || "" }); }}>
                              <Sparkles className="h-3 w-3 mr-1" /> Démarrer essai
                            </Button>
                          )}
                          {(r.status === "trial" || r.status === "expired") && (
                            <Button size="sm" className="ml-2" onClick={() => setActivateDialog({ vendorId: r.vendor_id, vendorName: r.vendor_name || "" })}>
                              <CreditCard className="h-3 w-3 mr-1" /> Activer abonnement
                            </Button>
                          )}
                          {r.status === "active" && (
                            <Button size="sm" variant="outline" className="ml-2 text-rose-700" onClick={() => { if (confirm("Confirmer l'annulation de l'abonnement ?")) cancel.mutate(r.vendor_id); }}>
                              <XCircle className="h-3 w-3 mr-1" /> Annuler
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Aucun vendeur trouvé.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog démarrer essai */}
      <Dialog open={!!trialDialog} onOpenChange={(o) => !o && setTrialDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Démarrer l'essai gratuit · {trialDialog?.vendorName}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm">Durée de l'essai (jours)</label>
            <Input type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(parseInt(e.target.value) || 180)} />
            <p className="text-xs text-muted-foreground">Par défaut 180 jours. À l'issue, le module sera totalement désactivé jusqu'à activation d'un abonnement.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialDialog(null)}>Annuler</Button>
            <Button onClick={() => trialDialog && startTrial.mutate({ vendorId: trialDialog.vendorId, days: trialDays })} disabled={startTrial.isPending}>
              {startTrial.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              Démarrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog activer abonnement */}
      <Dialog open={!!activateDialog} onOpenChange={(o) => !o && setActivateDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Activer l'abonnement · {activateDialog?.vendorName}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm">Plan</label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue placeholder="Choisir un plan…" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label} — {formatPrice(p.monthly_price_cents)}/mois ({p.ean_quota ? `${p.ean_quota} EAN` : "illimité"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm">Mode de paiement</label>
              <Select value={billing} onValueChange={(v) => setBilling(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">Stripe (CB mensuelle automatique)</SelectItem>
                  <SelectItem value="medikong_invoice">Facturation MediKong (manuelle)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Stripe : à brancher dans une étape ultérieure. Pour l'instant active immédiatement l'accès — pensez à
                créer la subscription Stripe en parallèle.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialog(null)}>Annuler</Button>
            <Button onClick={() => activateDialog && planId && activate.mutate({ vendorId: activateDialog.vendorId, plan: planId, billingMethod: billing })} disabled={!planId || activate.isPending}>
              {activate.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              Activer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
