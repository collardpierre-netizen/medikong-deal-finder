import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useVendorMarketIntelEntitlement, useVendorMarketIntelPlans } from "@/hooks/useVendorMarketIntelEntitlement";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BarChart3, Lock, Sparkles, CalendarClock, ShieldCheck, CheckCircle2, Loader2, MailQuestion } from "lucide-react";
import { useMoneyFormat, formatMoneyFromCents } from "@/lib/money-format";

function formatPrice(cents: number, locale?: string) {
  return formatMoneyFromCents(cents, { locale, fractionDigits: 0 });
}

/**
 * Gating wrapper for the Veille Marché module.
 * - If vendor has access (trial in progress OR active subscription) → renders children
 * - Else shows the upgrade screen (essai expiré OU pas encore activé).
 *
 * Trial activation is admin-only. The vendor can request activation via mailto/contact.
 */
export function VendorMarketIntelGate({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { data: ent, isLoading } = useVendorMarketIntelEntitlement();
  const { data: plans = [] } = useVendorMarketIntelPlans();
  const { data: vendor } = useCurrentVendor();
  const { user } = useAuth();
  const { locale } = useMoneyFormat();
  const [activating, setActivating] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewMsg, setRenewMsg] = useState("");
  const [renewSubmitting, setRenewSubmitting] = useState(false);

  const buildVendorMeta = () => ({
    vendorCompanyName: (vendor as any)?.company_name || (vendor as any)?.name || null,
    vendorContactEmail: (vendor as any)?.email || user?.email || null,
    vendorId: (vendor as any)?.id || null,
    occurredAtFormatted: new Date().toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" }),
  });

  const notifyAdmin = async (payload: Record<string, any>) => {
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "admin-vendor-market-intel-notification",
          recipientEmail: "admin@medikong.pro",
          idempotencyKey: payload.idempotencyKey,
          templateData: payload.templateData,
        },
      });
    } catch (err) {
      // best-effort: ne pas bloquer l'utilisateur
      console.error("[VMI] admin notification failed", err);
    }
  };

  const handleSelfActivate = async () => {
    setActivating(true);
    try {
      const { data, error } = await supabase.rpc("self_start_vendor_market_intel_trial" as any);
      if (error) throw error;
      toast.success("Essai gratuit activé — 180 jours offerts !");
      await qc.invalidateQueries({ queryKey: ["vmi-entitlement"] });
      const meta = buildVendorMeta();
      const trialEnds = (data as any)?.trial_ends_at;
      void notifyAdmin({
        idempotencyKey: `vmi-self-activated-${meta.vendorId || user?.id}-${trialEnds || Date.now()}`,
        templateData: {
          eventKind: "self_activated",
          ...meta,
          trialEndsAtFormatted: trialEnds ? new Date(trialEnds).toLocaleDateString("fr-BE") : null,
        },
      });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("trial_already_used")) {
        toast.error("Vous avez déjà utilisé votre essai gratuit. Demandez une prolongation à l'équipe MediKong.");
        setRenewOpen(true);
      } else {
        toast.error(msg || "Impossible d'activer l'essai");
      }
    } finally {
      setActivating(false);
    }
  };

  const handleRenewSubmit = async () => {
    setRenewSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("request_vendor_market_intel_trial_renewal" as any, { _message: renewMsg });
      if (error) throw error;
      toast.success("Demande envoyée à l'équipe MediKong — réponse sous 48h ouvrées.");
      const meta = buildVendorMeta();
      const requestId = (data as any)?.id;
      const userMessage = renewMsg;
      setRenewOpen(false);
      setRenewMsg("");
      void notifyAdmin({
        idempotencyKey: `vmi-renewal-${requestId || `${meta.vendorId}-${Date.now()}`}`,
        templateData: {
          eventKind: "renewal_requested",
          ...meta,
          message: userMessage || null,
        },
      });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("request_already_pending")) {
        toast.info("Une demande est déjà en cours de traitement.");
        setRenewOpen(false);
      } else {
        toast.error(msg || "Impossible d'envoyer la demande");
      }
    } finally {
      setRenewSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  const hasAccess = !!ent?.has_access;
  const inTrial = ent?.status === "trial";
  const trialDays = ent?.trial_days_remaining ?? 0;

  if (hasAccess) {
    return (
      <>
        {inTrial && trialDays <= 30 && (
          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0" />
            <span>
              Essai gratuit en cours — il vous reste <strong>{trialDays} jour{trialDays > 1 ? "s" : ""}</strong>.
              Pensez à activer votre abonnement pour ne pas perdre l'accès.
            </span>
          </div>
        )}
        {inTrial && trialDays > 30 && (
          <div className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              Essai gratuit actif — <strong>{trialDays} jours restants</strong>. Profitez-en pour explorer toutes les fonctionnalités.
            </span>
          </div>
        )}
        {children}
      </>
    );
  }

  // Pas d'accès : essai expiré ou jamais activé
  const expired = ent?.status === "expired" || ent?.status === "cancelled";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530] flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Veille marché
        </h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">
          Module premium — classement, comparaison concurrentielle et alertes prix par EAN.
        </p>
      </div>

      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/10 p-3 shrink-0">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <Badge variant={expired ? "destructive" : "secondary"} className="mb-2">
                {expired ? "Essai gratuit expiré" : "Module non activé"}
              </Badge>
              <h2 className="text-lg font-bold mb-1">
                {expired
                  ? "Votre essai gratuit de 180 jours est terminé"
                  : "Découvrez la Veille Marché — 180 jours offerts"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {expired
                  ? "Pour continuer à suivre vos prix concurrents et recevoir des alertes, choisissez un abonnement ci-dessous et contactez votre référent MediKong."
                  : "Bénéficiez de 180 jours d'essai gratuit pour évaluer le module sans engagement. L'activation est faite par votre référent MediKong sur simple demande."}
              </p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {plans.map((p: any) => (
                  <div key={p.id} className="rounded-xl border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.label}</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatPrice(p.monthly_price_cents)}
                      <span className="text-sm font-normal text-muted-foreground">/mois</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.ean_quota ? `${p.ean_quota.toLocaleString("fr-BE")} EAN suivis` : "EAN illimités"}
                    </p>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-2">{p.description}</p>
                    )}
                  </div>
                ))}
              </div>

              <ul className="mt-5 space-y-1.5 text-sm">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Classement EAN par rapport à la concurrence</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Alertes prix automatiques (seuils personnalisables)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Comparaison HTVA et TVAC, multi-pays</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Paiement sécurisé Stripe ou facturation MediKong au choix</li>
              </ul>

              <div className="mt-6 flex flex-wrap gap-2">
                {expired ? (
                  <>
                    <Button onClick={() => setRenewOpen(true)}>
                      <MailQuestion className="h-4 w-4 mr-2" /> Demander une prolongation
                    </Button>
                    <Button asChild variant="outline">
                      <a href="mailto:contact@medikong.pro?subject=Activation%20abonnement%20Veille%20March%C3%A9">
                        Activer mon abonnement
                      </a>
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleSelfActivate} disabled={activating}>
                    {activating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Activer mes 180 jours d'essai
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link to="/vendor/dashboard">Retour au tableau de bord</Link>
                </Button>
              </div>
              {!expired && (
                <p className="text-xs text-muted-foreground mt-2">
                  Activation immédiate, sans engagement. Une seule activation gratuite par compte vendeur.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={renewOpen} onOpenChange={(o) => !o && setRenewOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander une prolongation d'essai</DialogTitle>
            <DialogDescription>
              Votre essai gratuit a déjà été utilisé. L'équipe MediKong examine votre demande et vous répond sous 48h ouvrées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">Message (optionnel)</label>
            <Textarea
              rows={4}
              placeholder="Expliquez brièvement votre besoin (volumes, marques suivies, contexte…)"
              value={renewMsg}
              onChange={(e) => setRenewMsg(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>Annuler</Button>
            <Button onClick={handleRenewSubmit} disabled={renewSubmitting}>
              {renewSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
