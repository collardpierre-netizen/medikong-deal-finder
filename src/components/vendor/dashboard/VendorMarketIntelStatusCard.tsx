import { Link } from "react-router-dom";
import { BarChart3, Sparkles, CheckCircle2, AlertTriangle, Lock, ArrowRight } from "lucide-react";
import { useVendorMarketIntelEntitlement } from "@/hooks/useVendorMarketIntelEntitlement";
import { VCard } from "@/components/vendor/ui/VCard";
import { formatUpdatedAt } from "@/lib/format-date";

type Variant = {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const VARIANTS: Record<"none" | "trial" | "active" | "expired" | "cancelled", Variant> = {
  none:      { label: "Module non activé", bg: "#F1F5F9", text: "#616B7C", border: "#E2E8F0", icon: Lock },
  trial:     { label: "Essai gratuit en cours", bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", icon: Sparkles },
  active:    { label: "Abonnement actif", bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", icon: CheckCircle2 },
  expired:   { label: "Essai expiré", bg: "#FFFBEB", text: "#B45309", border: "#FDE68A", icon: AlertTriangle },
  cancelled: { label: "Abonnement résilié", bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA", icon: AlertTriangle },
};

export default function VendorMarketIntelStatusCard() {
  const { data, isLoading } = useVendorMarketIntelEntitlement();
  if (isLoading || !data) return null;

  const status = (data.status ?? "none") as keyof typeof VARIANTS;
  const v = VARIANTS[status] ?? VARIANTS.none;
  const Icon = v.icon;

  const deadline =
    status === "trial" ? data.trial_ends_at :
    status === "active" ? data.subscription_current_period_end :
    null;

  const daysLeft = data.trial_days_remaining;

  return (
    <VCard className="!p-0 overflow-hidden">
      <div
        className="flex items-center justify-between gap-4 p-4"
        style={{ backgroundColor: v.bg, borderLeft: `4px solid ${v.text}` }}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#fff", border: `1px solid ${v.border}` }}
          >
            <Icon size={18} className="" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <BarChart3 size={14} style={{ color: v.text }} />
              <span className="text-[13px] font-bold" style={{ color: v.text }}>
                Veille marché — {v.label}
              </span>
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: v.text, opacity: 0.85 }}>
              {status === "trial" && deadline && (
                <>Fin d'essai le <strong>{formatUpdatedAt(deadline)}</strong>{daysLeft != null && ` · ${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`}</>
              )}
              {status === "active" && (
                <>
                  {data.plan_label || "Plan actif"}
                  {deadline && <> · prochaine échéance <strong>{formatUpdatedAt(deadline)}</strong></>}
                </>
              )}
              {status === "expired" && "Réactivez le module pour retrouver l'accès à la comparaison concurrentielle."}
              {status === "cancelled" && "Votre abonnement a été résilié. Contactez votre référent MediKong pour le réactiver."}
              {status === "none" && "Classement EAN, comparaison HTVA/TVAC et alertes prix automatiques."}
            </p>
          </div>
        </div>

        <Link
          to="/vendor/market-intel"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-md shrink-0"
          style={{ backgroundColor: "#fff", color: v.text, border: `1px solid ${v.border}` }}
        >
          {status === "active" || status === "trial" ? "Ouvrir Veille marché" : "Découvrir le module"}
          <ArrowRight size={12} />
        </Link>
      </div>
    </VCard>
  );
}
