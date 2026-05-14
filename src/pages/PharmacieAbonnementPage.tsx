import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  Clock,
  Gift,
  Sparkles,
  CreditCard,
  Phone,
  ChevronRight,
  Info,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";
import { formatMoney, useMoneyFormat } from "@/lib/money-format";

type Overview = {
  subscription_id: string;
  buyer_id: string;
  status: string;
  plan_id: string;
  plan_label: string;
  volume_threshold_ht: number;
  trial_volume_ht: number;
  lifetime_volume_ht: number;
  current_phase: string;
  current_free_ends_at: string | null;
  free_days_remaining: number | null;
  threshold_progress_pct: number | null;
  has_active_extension_request: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  bonus_started_at: string | null;
  bonus_ends_at: string | null;
  extension_started_at: string | null;
  extension_ends_at: string | null;
  paid_started_at: string | null;
};

type Plan = {
  id: string;
  label: string;
  description: string | null;
  trial_months: number;
  bonus_months: number;
  extension_months: number;
  volume_threshold_ht: number;
  monthly_price_ht: number;
  vat_rate: number;
  volume_currency: string;
};

type ExtensionRequest = {
  id: string;
  status: string;
  reason: string | null;
  callback_window: string | null;
  contact_attempt_count: number | null;
  last_contact_at: string | null;
  granted_months: number | null;
  rejection_reason: string | null;
  created_at: string;
  resolved_at: string | null;
};

const PHASE_LABEL: Record<string, { label: string; tone: "default" | "secondary" | "outline" | "destructive"; icon: typeof Gift }> = {
  trial: { label: "Période d'essai", tone: "default", icon: Gift },
  bonus_free: { label: "Bonus gratuit", tone: "secondary", icon: Sparkles },
  extension: { label: "Extension commerciale", tone: "secondary", icon: Clock },
  paid: { label: "Abonnement payant", tone: "outline", icon: CreditCard },
  pending_decision: { label: "Décision en attente", tone: "destructive", icon: Info },
  cancelled: { label: "Annulé", tone: "destructive", icon: Info },
};

function fmtEURStatic(amount: number | null | undefined, locale?: string) {
  const n = Number(amount ?? 0);
  return formatMoney(n, { locale, fractionDigits: 0 });
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return formatUpdatedAt(iso);
}

export default function PharmacieAbonnementPage() {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [callbackWindow, setCallbackWindow] = useState("");
  const { locale } = useMoneyFormat();
  const fmtEUR = (amount: number | null | undefined) => fmtEURStatic(amount, locale);

  // Auto-ensure subscription exists on first visit
  useEffect(() => {
    if (!user) return;
    supabase.rpc("ensure_buyer_subscription").then(() => {
      qc.invalidateQueries({ queryKey: ["pharma-subscription-overview"] });
    });
  }, [user, qc]);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["pharma-subscription-overview", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_buyer_subscription_overview")
        .select("*")
        .eq("buyer_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Overview | null;
    },
  });

  const { data: plan } = useQuery({
    queryKey: ["pharma-plan", overview?.plan_id],
    enabled: !!overview?.plan_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_plans")
        .select("*")
        .eq("id", overview!.plan_id)
        .maybeSingle();
      if (error) throw error;
      return data as Plan | null;
    },
  });

  // Fallback plan (if no subscription yet)
  const { data: defaultPlan } = useQuery({
    queryKey: ["pharma-plan-default"],
    enabled: !overview,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_plans")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Plan | null;
    },
  });

  const { data: extensionRequests } = useQuery({
    queryKey: ["pharma-extension-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_extension_requests")
        .select("*")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as ExtensionRequest[];
    },
  });

  const requestExtension = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_subscription_extension", {
        _reason: reason || null,
        _callback_window: callbackWindow || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande envoyée — un membre de l'équipe MediKong vous contactera.");
      setReason("");
      setCallbackWindow("");
      qc.invalidateQueries({ queryKey: ["pharma-extension-requests"] });
      qc.invalidateQueries({ queryKey: ["pharma-subscription-overview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Échec de la demande"),
  });

  const activePlan = plan ?? defaultPlan ?? null;

  const phaseInfo = useMemo(() => {
    const key = overview?.current_phase ?? "trial";
    return PHASE_LABEL[key] ?? PHASE_LABEL.trial;
  }, [overview?.current_phase]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/connexion?redirect=/espace-pharmacie/abonnement" replace />;
  }

  const progress = Math.max(0, Math.min(100, overview?.threshold_progress_pct ?? 0));
  const trialVolume = Number(overview?.trial_volume_ht ?? 0);
  const threshold = Number(overview?.volume_threshold_ht ?? activePlan?.volume_threshold_ht ?? 6000);
  const remainingToThreshold = Math.max(0, threshold - trialVolume);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Helmet>
        <title>Mon abonnement pharmacien — MediKong</title>
        <meta
          name="description"
          content="Suivez votre abonnement pharmacien MediKong : période d'essai gratuite, bonus selon volume et bascule payant."
        />
      </Helmet>

      <header className="mb-8">
        <p className="text-sm text-muted-foreground mb-1">
          <Link to="/compte" className="hover:underline">Mon compte</Link>
          <ChevronRight className="inline w-3 h-3 mx-1" />
          Abonnement pharmacien
        </p>
        <h1 className="text-3xl font-bold">Mon abonnement pharmacien</h1>
        <p className="text-muted-foreground mt-2">
          Profitez de 6 mois gratuits, prolongés de 6 mois supplémentaires si votre volume d'achats dépasse{" "}
          <strong>{fmtEUR(threshold)} HT</strong>. Sinon, l'abonnement bascule à{" "}
          <strong>{fmtEUR(activePlan?.monthly_price_ht ?? 199)} HT/mois</strong>.
        </p>
      </header>

      {/* Phase & status */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <phaseInfo.icon className="w-5 h-5 text-primary" />
                {phaseInfo.label}
              </CardTitle>
              <CardDescription>{overview?.plan_label ?? activePlan?.label ?? "Offre standard pharmacien"}</CardDescription>
            </div>
            <Badge variant={phaseInfo.tone}>Statut : {overview?.status ?? "—"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loadingOverview ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Phase actuelle se termine</div>
                <div className="text-lg font-semibold">{fmtDate(overview?.current_free_ends_at)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {overview?.free_days_remaining != null ? `${overview.free_days_remaining} j restants` : "—"}
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Volume période d'essai</div>
                <div className="text-lg font-semibold">{fmtEUR(trialVolume)}</div>
                <div className="text-xs text-muted-foreground mt-1">sur {fmtEUR(threshold)} HT requis</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground mb-1">Volume cumulé</div>
                <div className="text-lg font-semibold">{fmtEUR(overview?.lifetime_volume_ht)}</div>
                <div className="text-xs text-muted-foreground mt-1">depuis votre inscription</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Volume progress */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Progression vers le bonus gratuit</CardTitle>
          <CardDescription>
            Atteignez {fmtEUR(threshold)} HT d'achats pendant les 6 mois d'essai pour débloquer 6 mois supplémentaires gratuits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progress} />
          <div className="flex flex-wrap items-center justify-between text-sm">
            <span className="font-medium">{progress}% atteint</span>
            <span className="text-muted-foreground">
              {remainingToThreshold > 0
                ? <>Encore <strong>{fmtEUR(remainingToThreshold)}</strong> pour décrocher le bonus</>
                : <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Seuil atteint — bonus garanti</span>}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Phase stepper */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Étapes de votre abonnement</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            <PhaseStep
              icon={Gift}
              title={`6 mois gratuits — période d'essai`}
              from={overview?.trial_started_at}
              to={overview?.trial_ends_at}
              active={overview?.current_phase === "trial"}
              done={!!overview?.trial_ends_at && new Date(overview.trial_ends_at) < new Date()}
            />
            <PhaseStep
              icon={Sparkles}
              title={`+6 mois bonus si volume ≥ ${fmtEUR(threshold)} HT`}
              from={overview?.bonus_started_at}
              to={overview?.bonus_ends_at}
              active={overview?.current_phase === "bonus_free"}
              done={!!overview?.bonus_ends_at && new Date(overview.bonus_ends_at) < new Date()}
            />
            <PhaseStep
              icon={Clock}
              title={`Extension commerciale (+${activePlan?.extension_months ?? 3} mois, sur demande)`}
              from={overview?.extension_started_at}
              to={overview?.extension_ends_at}
              active={overview?.current_phase === "extension"}
              done={!!overview?.extension_ends_at && new Date(overview.extension_ends_at) < new Date()}
            />
            <PhaseStep
              icon={CreditCard}
              title={`Bascule payante — ${fmtEUR(activePlan?.monthly_price_ht ?? 199)} HT/mois`}
              from={overview?.paid_started_at}
              to={null}
              active={overview?.current_phase === "paid"}
              done={false}
            />
          </ol>
        </CardContent>
      </Card>

      {/* Recap & extension request */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Récapitulatif de l'offre</CardTitle>
            <CardDescription>{activePlan?.description ?? "—"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Période gratuite" value={`${activePlan?.trial_months ?? 6} mois`} />
            <Row label="Bonus si volume atteint" value={`+${activePlan?.bonus_months ?? 6} mois gratuits`} />
            <Row label="Seuil de volume" value={`${fmtEUR(activePlan?.volume_threshold_ht ?? 6000)} HT`} />
            <Row label="Extension commerciale" value={`+${activePlan?.extension_months ?? 3} mois sur demande`} />
            <Separator className="my-2" />
            <Row label="Tarif après période gratuite" value={`${fmtEUR(activePlan?.monthly_price_ht ?? 199)} HT/mois`} highlight />
            <Row label="TVA applicable" value={`${activePlan?.vat_rate ?? 21} %`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> Demander une extension de 3 mois</CardTitle>
            <CardDescription>
              Si vous n'atteignez pas le seuil, l'équipe commerciale peut vous accorder une extension supplémentaire après échange.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview?.has_active_extension_request ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <div className="font-medium mb-1 inline-flex items-center gap-1"><Clock className="w-4 h-4" /> Demande en cours</div>
                <p className="text-muted-foreground">
                  Notre équipe vous contactera prochainement. Vous pouvez suivre l'avancement ci-dessous.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="reason">Motif (optionnel)</Label>
                  <Textarea
                    id="reason"
                    rows={3}
                    placeholder="Ex : volume saisonnier, besoin de plus de temps pour migrer mes commandes…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="callback">Créneau de rappel (optionnel)</Label>
                  <Input
                    id="callback"
                    placeholder="Ex : mardi 14-16h"
                    value={callbackWindow}
                    onChange={(e) => setCallbackWindow(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => requestExtension.mutate()}
                  disabled={requestExtension.isPending}
                >
                  {requestExtension.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Envoyer la demande
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Extension request history */}
      {extensionRequests && extensionRequests.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Historique des demandes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {extensionRequests.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-medium">Demande du {fmtDate(r.created_at)}</div>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" || r.status === "expired" ? "destructive" : "secondary"}>
                    {r.status}
                  </Badge>
                </div>
                {r.reason && <p className="text-muted-foreground mt-1">{r.reason}</p>}
                {r.callback_window && <p className="text-xs text-muted-foreground mt-1">Créneau souhaité : {r.callback_window}</p>}
                {r.granted_months ? (
                  <p className="text-xs text-emerald-600 mt-1">Extension accordée : +{r.granted_months} mois</p>
                ) : null}
                {r.rejection_reason && <p className="text-xs text-destructive mt-1">Motif de refus : {r.rejection_reason}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-semibold text-foreground" : "font-medium"}>{value}</span>
    </div>
  );
}

function PhaseStep({
  icon: Icon,
  title,
  from,
  to,
  active,
  done,
}: {
  icon: typeof Gift;
  title: string;
  from: string | null | undefined;
  to: string | null | undefined;
  active: boolean;
  done: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div
        className={`mt-0.5 w-9 h-9 shrink-0 rounded-full flex items-center justify-center border ${
          active ? "bg-primary text-primary-foreground border-primary" : done ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="font-medium">{title} {active && <Badge variant="default" className="ml-2">en cours</Badge>}</div>
        <div className="text-xs text-muted-foreground">
          {from ? `Du ${fmtDate(from)}` : "Pas encore démarré"}
          {to ? ` au ${fmtDate(to)}` : from ? " — date de fin à venir" : ""}
        </div>
      </div>
    </li>
  );
}
