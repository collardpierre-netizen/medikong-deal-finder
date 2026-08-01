import { Link } from "react-router-dom";
import { Coins, History } from "lucide-react";
import { useCagnotteBalance, formatEur } from "@/hooks/useCagnotte";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Widget cagnotte pleine largeur, haut du dashboard pharmacien.
 */
export function CagnotteHero() {
  const { data, isLoading } = useCagnotteBalance();

  if (isLoading || !data) return null;

  return (
    <div
      className="rounded-xl p-5 md:p-6 mb-6 text-white"
      style={{ background: "linear-gradient(135deg, #0D5F5A 0%, #14847D 100%)" }}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-lg"
          style={{ background: "linear-gradient(135deg, #F4B942, #D89620)" }}
        >
          <Coins size={28} className="text-[#5A3E00]" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[48px] leading-none font-bold tracking-tight">
            {formatEur(data.current_balance)}
          </p>
          <p className="text-sm text-white/80 mt-2">
            Cagnotte MediKong · utilisable dès votre prochaine commande
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/catalogue"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-[#3D2A00]"
            style={{ background: "#F4B942" }}
          >
            Utiliser ma cagnotte
          </Link>
          <Link
            to="/compte?tab=commandes"
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-white/60 text-white hover:bg-white/10 inline-flex items-center gap-1.5"
          >
            <History size={14} /> Voir l'historique
          </Link>
        </div>
      </div>

      {data.amount_expiring_soon > 0 && (
        <div
          className="mt-4 rounded-lg px-3 py-2 text-sm"
          style={{ background: "rgba(244, 185, 66, 0.15)" }}
        >
          ⏰ {formatEur(data.amount_expiring_soon)} expirent le {formatDate(data.next_expiry_date)}.
          Pensez à les utiliser.
        </div>
      )}
    </div>
  );
}
