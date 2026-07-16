import { Lock, Sparkles, MailQuestion, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useIntelligenceModuleSettings,
  useIntelligencePlans,
  type IntelligenceModule,
  type IntelEntitlementRow,
} from "@/hooks/useIntelligenceEntitlement";
import { useMoneyFormat, formatMoneyFromCents } from "@/lib/money-format";

/**
 * Lockcard inline pour un onglet payant sans accès.
 * Utilisé quand le module a d'autres onglets gratuits — on ne bloque pas toute la page.
 */
export function TabLockCard({
  module,
  tabLabel,
  entitlement,
}: {
  module: IntelligenceModule;
  tabLabel: string;
  entitlement: IntelEntitlementRow | null | undefined;
}) {
  const qc = useQueryClient();
  const { data: settings } = useIntelligenceModuleSettings(module);
  const { data: plans = [] } = useIntelligencePlans(module);
  const { locale } = useMoneyFormat();
  const [activating, setActivating] = useState(false);

  const moduleLabel = settings?.label || module;
  const trialDays = settings?.default_trial_days ?? 180;
  const expired = entitlement?.status === "expired" || entitlement?.status === "cancelled";
  const canSelfActivate = !entitlement?.trial_started_at && !expired;

  const handleSelfActivate = async () => {
    setActivating(true);
    try {
      const { error } = await supabase.rpc("intelligence_start_trial" as any, { _module: module });
      if (error) throw error;
      toast.success(`Essai gratuit activé — ${trialDays} jours offerts !`);
      await qc.invalidateQueries({ queryKey: ["intel-entitlement", module] });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("trial_already_used")) {
        toast.error("Essai déjà utilisé. Contactez MediKong pour une prolongation.");
      } else {
        toast.error(msg || "Impossible d'activer l'essai");
      }
    } finally {
      setActivating(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-primary/10 p-3 shrink-0">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <Badge variant={expired ? "destructive" : "secondary"} className="mb-2">
              {expired ? "Essai expiré" : "Onglet premium"}
            </Badge>
            <h3 className="text-base font-bold mb-1">
              « {tabLabel} » — inclus dans {moduleLabel}
            </h3>
            <p className="text-sm text-muted-foreground">
              {expired
                ? "Votre essai est terminé. Activez un abonnement pour retrouver cet onglet."
                : `Débloquez ${moduleLabel} pour accéder à cet onglet et à toutes les analyses associées.`}
            </p>

            {plans.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {plans.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs"
                  >
                    <span className="font-medium">{p.label}</span>
                    <span className="text-muted-foreground">
                      {formatMoneyFromCents(p.monthly_price_cents, { locale, fractionDigits: 0 })}/mois
                    </span>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {canSelfActivate ? (
                <Button size="sm" onClick={handleSelfActivate} disabled={activating}>
                  {activating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Débloquer — {trialDays} jours d'essai
                </Button>
              ) : (
                <Button size="sm" asChild>
                  <a
                    href={`mailto:contact@medikong.pro?subject=Activation%20${encodeURIComponent(moduleLabel)}`}
                  >
                    <MailQuestion className="h-4 w-4 mr-2" /> Contacter MediKong
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline" asChild>
                <Link to="/vendor/dashboard">Retour au tableau de bord</Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
