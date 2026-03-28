import { VCard } from "@/components/vendor/ui/VCard";
import { VStat } from "@/components/vendor/ui/VStat";
import { useI18n } from "@/contexts/I18nContext";
import { vendorProfile } from "@/lib/vendor-tokens";
import { VProgressBar } from "@/components/vendor/ui/VProgressBar";

export default function VendorDashboard() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">
          {t("dashboard")}
        </h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">
          Bienvenue, {vendorProfile.name}
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <VStat label="CA du mois" value="€ 24 830" icon="Euro" color="#1B5BDA" trend={12} sub="vs mois dernier" />
        <VStat label="Commandes" value="47" icon="ShoppingCart" color="#059669" trend={8} sub="en cours : 12" />
        <VStat label="Offres actives" value="312" icon="Tag" color="#7C3AED" trend={-3} sub="sur 340 produits" />
        <VStat label="Taux de service" value="94%" icon="CircleCheck" color="#059669" trend={2} sub="objectif : 95%" />
      </div>

      {/* Score card */}
      <VCard>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#1D2530]">Santé du compte</h3>
            <p className="text-[11px] text-[#616B7C]">Niveau {vendorProfile.level} — Commission : {vendorProfile.commissionRate}%</p>
          </div>
          <div className="text-right">
            <span className="text-[22px] font-bold text-[#1D2530]">{vendorProfile.score}</span>
            <span className="text-[13px] text-[#8B95A5]"> / 100</span>
          </div>
        </div>
        <VProgressBar value={vendorProfile.score} color="#1B5BDA" />
        <p className="text-[11px] text-[#8B95A5] mt-2">
          Prochain niveau : {vendorProfile.levelNext} (score ≥ {vendorProfile.scoreToNext}) → commission réduite à 10%
        </p>
      </VCard>

      {/* Quick actions placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VCard>
          <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Commandes récentes</h3>
          <p className="text-[13px] text-[#8B95A5]">Les dernières commandes apparaîtront ici.</p>
        </VCard>
        <VCard>
          <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Alertes</h3>
          <p className="text-[13px] text-[#8B95A5]">Vos alertes de stock et de prix apparaîtront ici.</p>
        </VCard>
      </div>
    </div>
  );
}
