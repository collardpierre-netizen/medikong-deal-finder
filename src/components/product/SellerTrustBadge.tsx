import { Shield, CheckCircle, Undo2, RefreshCcw, Headphones, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SellerTrustBadgeProps {
  garantieAuthenticite?: boolean;
  retourGratuit?: boolean;
  remboursementNonConforme?: boolean;
  serviceClientVendeur?: boolean;
  livraisonExpress?: boolean;
  className?: string;
}

const trustLines = [
  { key: "garantieAuthenticite", icon: CheckCircle, text: "Ce vendeur garantit l'authenticité et la conformité de ses produits" },
  { key: "retourGratuit", icon: Undo2, text: "Retour gratuit sous 14 jours auprès de ce vendeur" },
  { key: "remboursementNonConforme", icon: RefreshCcw, text: "Remboursement intégral par le vendeur si le produit ne correspond pas à la description" },
  { key: "serviceClientVendeur", icon: Headphones, text: "Service client dédié disponible pour toute réclamation" },
  { key: "livraisonExpress", icon: Truck, text: "Expédition sous 24h par ce vendeur" },
] as const;

export function SellerTrustBadge(props: SellerTrustBadgeProps) {
  const { className, ...flags } = props;
  const activeLines = trustLines.filter((l) => flags[l.key]);

  return (
    <div className={cn("rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-3", className)}>
      {/* Base block */}
      <div className="flex items-start gap-2.5">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#2563EB]" />
        <div>
          <p className="text-sm font-semibold text-foreground">Achetez en confiance sur MediKong</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            MediKong référence uniquement des vendeurs professionnels du secteur santé et beauté.
            Chaque vendeur est responsable de la conformité de ses produits et du respect de ses obligations légales envers les acheteurs.
          </p>
        </div>
      </div>

      {/* Conditional lines */}
      {activeLines.length > 0 && (
        <>
          <div className="border-t border-blue-200/60" />
          <ul className="space-y-2">
            {activeLines.map(({ key, icon: Icon, text }) => (
              <li key={key} className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
                <span className="text-xs text-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
