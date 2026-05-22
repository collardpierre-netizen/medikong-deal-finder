import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useVendorAdminStatus } from "@/hooks/useVendorAdminStatus";

interface VendorAdminStatusBadgeProps {
  vendorId: string | undefined;
}

/**
 * Pastille de statut administratif vendeur affichée dans le header de l'espace
 * vendeur. Toujours visible. Clic → popover détaillant les groupes manquants
 * (identité, représentant, KYC, mandat) avec liens directs vers la résolution.
 */
export function VendorAdminStatusBadge({ vendorId }: VendorAdminStatusBadgeProps) {
  const { data: status, isLoading } = useVendorAdminStatus(vendorId);

  if (!vendorId) return null;
  if (isLoading || !status) {
    return (
      <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F1F5F9] text-[#8B95A5] text-[11px] font-semibold">
        <Loader2 size={12} className="animate-spin" />
        Statut admin
      </div>
    );
  }

  const ok = status.isComplete;
  const triggerClasses = ok
    ? "bg-[#E6F4EA] text-[#0F7A3A] hover:bg-[#d8eedf]"
    : "bg-[#FEF3C7] text-[#92400E] hover:bg-[#fde9aa]";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ok ? "Dossier administratif complet" : "Dossier administratif incomplet"}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${triggerClasses}`}
          title={ok ? "Dossier administratif complet" : `${status.totalMissing} élément(s) à compléter`}
        >
          {ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          <span className="hidden sm:inline">
            {ok ? "Dossier complet" : `Action requise · ${status.totalMissing}`}
          </span>
          <span className="sm:hidden">{ok ? "OK" : status.totalMissing}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        <div className={`px-4 py-3 border-b ${ok ? "bg-[#E6F4EA] border-[#bfe0c9]" : "bg-[#FEF3C7] border-[#fde0a3]"}`}>
          <div className="flex items-center gap-2">
            {ok ? (
              <CheckCircle2 size={16} className="text-[#0F7A3A]" />
            ) : (
              <AlertTriangle size={16} className="text-[#92400E]" />
            )}
            <p className="text-[13px] font-semibold text-[#1D2530]">
              {ok ? "Vous êtes en ordre" : "Dossier administratif incomplet"}
            </p>
          </div>
          <p className="text-[11px] text-[#616B7C] mt-1">
            {ok
              ? "Toutes les conditions MediKong sont remplies pour facturer et recevoir des commandes."
              : `Complétez les ${status.totalMissing} élément(s) ci-dessous pour activer pleinement votre compte.`}
          </p>
        </div>
        <ul className="divide-y divide-[#F1F5F9]">
          {status.groups.map((g) => (
            <li key={g.key} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-[#1D2530]">{g.label}</span>
                {g.ok ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0F7A3A]">
                    <CheckCircle2 size={11} /> OK
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#92400E]">
                    <AlertTriangle size={11} /> {g.missing.length}
                  </span>
                )}
              </div>
              {!g.ok && (
                <ul className="mt-1 pl-3 list-disc text-[11px] text-[#616B7C] space-y-0.5">
                  {g.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {!ok && (
          <div className="px-4 py-3 border-t border-[#F1F5F9] flex flex-wrap gap-2">
            <Link
              to="/vendor/settings"
              className="text-[11px] font-semibold text-white bg-[#1B5BDA] hover:bg-[#1547b0] px-3 py-1.5 rounded-md transition-colors"
            >
              Compléter mes informations
            </Link>
            <Link
              to="/vendor/contract"
              className="text-[11px] font-semibold text-[#1B5BDA] hover:text-[#1547b0] border border-[#1B5BDA] px-3 py-1.5 rounded-md transition-colors"
            >
              Signer la convention
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
