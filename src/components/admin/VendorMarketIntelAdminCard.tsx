import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BarChart3, Sparkles, CreditCard, FileText, Loader2, XCircle, ExternalLink,
} from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";
import { useMoneyFormat, formatMoneyFromCents } from "@/lib/money-format";
import { Link } from "react-router-dom";

/**
 * Carte Veille marché — pilote l'essai 180j et l'abonnement (Stripe / facture MediKong)
 * d'un vendeur depuis la fiche admin. Réutilise les mêmes RPCs et la même vue
 * que `/admin/vendor-market-intel`.
 */

type Status = "none" | "trial" | "active" | "expired" | "cancelled";

type Row = {
  vendor_id: string;
  vendor_name: string | null;
  status: Status;
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

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  none:      { label: "Non activé",     cls: "bg-muted text-muted-foreground" },
  trial:     { label: "Essai gratuit",  cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  active:    { label: "Abonné",         cls: "bg-primary text-primary-foreground" },
  expired:   { label: "Expiré",         cls: "bg-amber-100 text-amber-800 border-amber-300" },
  cancelled: { label: "Annulé",         cls: "bg-rose-100 text-rose-800 border-rose-300" },
};

function formatPrice(c: number | null, locale?: string) {
  if (c == null) return "—";
  return formatMoneyFromCents(c, locale ? { locale } : undefined);
}

interface Props {
  vendorId: string;
  vendorName?: string | null;
}

export function VendorMarketIntelAdminCard({ vendorId, vendorName }: Props) {
  const qc = useQueryClient();
  const { locale } = useMoneyFormat();
  const fmtPrice = (c: number | null) => formatPrice(c, locale);
  const [trialOpen, setTrialOpen] = useState(false);
  const [trialDays, setTrialDays] = useState(180);
  const [activateOpen, setActivateOpen] = useState(false);
  const [planId, setPlanId] = useState<string>("");
  const [billing, setBilling] = useState<"stripe" | "medikong_invoice">("medikong_invoice");

  const { data: row, isLoading } = useQuery({
    queryKey: ["admin-vmi-vendor", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_market_intel_status_v" as any)
        .select("*")
        .eq("vendor_id", vendorId)
        .maybeSingle();
      if (error) throw error;
      return ((data as unknown) as Row | null) ?? ({
        vendor_id: vendorId,
        vendor_name: vendorName ?? null,
        status: "none" as const,
        trial_started_at: null,
        trial_ends_at: null,
        trial_days_remaining: null,
        subscription_started_at: null,
        subscription_current_period_end: null,
        plan_label: null,
        monthly_price_cents: null,
        billing_method: null,
        has_access: false,
      } satisfies Row);
    },
    enabled: !!vendorId,
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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-vmi-vendor", vendorId] });
    qc.invalidateQueries({ queryKey: ["admin-vmi-list"] });
  };

  const startTrial = useMutation({
    mutationFn: async (days: number) => {
      const { error } = await supabase.rpc("start_vendor_market_intel_trial" as any, {
        _vendor_id: vendorId, _trial_days: days, _notes: null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Essai démarré"); setTrialOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const activate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("activate_vendor_market_intel_subscription" as any, {
        _vendor_id: vendorId, _plan_id: planId, _billing_method: billing,
        _stripe_subscription_id: null, _period_end: null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Abonnement activé"); setActivateOpen(false); setPlanId(""); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_vendor_market_intel_subscription" as any, { _vendor_id: vendorId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Abonnement annulé"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const status: Status = row?.status ?? "none";
  const meta = STATUS_META[status];
  const deadline = status === "trial" ? row?.trial_ends_at : row?.subscription_current_period_end;

  return (
    <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-bold flex items-center gap-2" style={{ color: "#1D2530" }}>
          <BarChart3 size={16} /> Veille marché
        </h3>
        <Link
          to="/admin/vendor-market-intel"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          Vue globale <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center text-muted-foreground text-sm py-3">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
            {status === "trial" && row?.trial_days_remaining != null && (
              <span className="text-xs text-muted-foreground">{row.trial_days_remaining} j restants</span>
            )}
            {row?.plan_label && (
              <span className="text-xs text-muted-foreground">
                · {row.plan_label} ({fmtPrice(row.monthly_price_cents)}/mois)
              </span>
            )}
            {row?.billing_method === "stripe" && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                · <CreditCard className="h-3 w-3" /> Stripe
              </span>
            )}
            {row?.billing_method === "medikong_invoice" && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                · <FileText className="h-3 w-3" /> Facture MediKong
              </span>
            )}
          </div>

          {deadline && (
            <p className="text-xs text-muted-foreground mb-3">
              Échéance : {formatUpdatedAt(deadline)}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {(status === "none" || status === "expired" || status === "cancelled") && (
              <Button size="sm" variant="outline" onClick={() => { setTrialDays(180); setTrialOpen(true); }}>
                <Sparkles className="h-3 w-3 mr-1" /> Démarrer essai 180j
              </Button>
            )}
            {(status === "trial" || status === "expired") && (
              <Button size="sm" onClick={() => setActivateOpen(true)}>
                <CreditCard className="h-3 w-3 mr-1" /> Activer abonnement
              </Button>
            )}
            {status === "active" && (
              <Button
                size="sm"
                variant="outline"
                className="text-rose-700"
                onClick={() => { if (confirm("Confirmer l'annulation de l'abonnement ?")) cancel.mutate(); }}
              >
                <XCircle className="h-3 w-3 mr-1" /> Annuler
              </Button>
            )}
          </div>
        </>
      )}

      {/* Dialog démarrer essai */}
      <Dialog open={trialOpen} onOpenChange={setTrialOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Démarrer l'essai gratuit · {vendorName || ""}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm">Durée de l'essai (jours)</label>
            <Input
              type="number" min={1} max={365}
              value={trialDays}
              onChange={(e) => setTrialDays(parseInt(e.target.value) || 180)}
            />
            <p className="text-xs text-muted-foreground">
              Par défaut 180 jours. À l'issue, le module sera désactivé jusqu'à activation d'un abonnement.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialOpen(false)}>Annuler</Button>
            <Button onClick={() => startTrial.mutate(trialDays)} disabled={startTrial.isPending}>
              {startTrial.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              Démarrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog activer abonnement */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Activer l'abonnement · {vendorName || ""}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm">Plan</label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue placeholder="Choisir un plan…" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label} — {fmtPrice(p.monthly_price_cents)}/mois ({p.ean_quota ? `${p.ean_quota} EAN` : "illimité"})
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
                Stripe : à brancher dans une étape ultérieure. Pour l'instant active immédiatement l'accès.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)}>Annuler</Button>
            <Button onClick={() => activate.mutate()} disabled={!planId || activate.isPending}>
              {activate.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              Activer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
