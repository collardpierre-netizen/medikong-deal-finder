import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { VCard } from "@/components/vendor/ui/VCard";
import { VStat } from "@/components/vendor/ui/VStat";
import { Database } from "lucide-react";
import VendorKycStepper from "@/components/vendor/VendorKycStepper";

const today = new Date();
const dateStr = today.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function VendorDashboard() {
  const { data: vendor } = useCurrentVendor();

  const isApproved = vendor?.validation_status === "approved";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Tableau de bord</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5 capitalize">{dateStr}</p>
      </div>

      {/* Show KYC stepper if not yet approved */}
      {vendor && !isApproved && (
        <VendorKycStepper vendor={vendor} />
      )}

      {/* KPI Row — only show when approved */}
      {isApproved && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <VStat label="CA du mois" value="0 EUR" icon="Euro" color="#1B5BDA" sub="aucune vente" />
            <VStat label="Commandes" value="0" icon="ShoppingCart" color="#059669" sub="ce mois" />
            <VStat label="Offres actives" value="0" icon="Tag" color="#7C3AED" sub="aucune offre" />
            <VStat label="Taux Buy Box" value="—" icon="Trophy" color="#F59E0B" sub="pas de données" />
          </div>

          <VCard>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Database size={48} className="text-[#CBD5E1] mb-4" />
              <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Bienvenue sur votre espace vendeur</h3>
              <p className="text-[13px] text-[#8B95A5] max-w-md">
                Votre tableau de bord s'alimentera automatiquement dès que vous aurez des offres actives et des commandes.
                Commencez par créer vos premières offres dans la section "Mes Offres".
              </p>
            </div>
          </VCard>
        </>
      )}
    </div>
  );
}
