import { ShieldCheck, FileCheck2, BadgeCheck, ScrollText, Info, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOfferTrust } from "@/hooks/useOfferTrust";
import { cn } from "@/lib/utils";

interface OfferTrustPanelProps {
  offerId: string | null | undefined;
  brandId?: string | null;
  variant?: "compact" | "full";
  className?: string;
}

/**
 * Bloc "Garanties & Vendeur" à afficher près du prix (fiche produit ou card).
 * Aucune mention "garantie MediKong 100 %" : uniquement la garantie légale
 * européenne de conformité (2 ans) + traçabilité vérifiable.
 */
export function OfferTrustPanel({ offerId, brandId, variant = "compact", className }: OfferTrustPanelProps) {
  const { data, isLoading } = useOfferTrust(offerId, brandId);

  if (!offerId || isLoading || !data) return null;

  const chips: { icon: LucideIcon; label: string; ok: boolean; tip: string }[] = [
    {
      icon: BadgeCheck,
      label: "Distributeur autorisé",
      ok: data.is_authorized_distributor,
      tip: data.is_authorized_distributor
        ? "Le vendeur a déclaré être distributeur autorisé pour les marques qu'il référence."
        : "Le vendeur n'a pas déclaré d'autorisation formelle des marques.",
    },
    {
      icon: FileCheck2,
      label: "Mandat de facturation signé",
      ok: data.billing_mandate_signed,
      tip: data.billing_mandate_signed
        ? "MediKong SRL émet la facture au nom et pour le compte du vendeur (self-billing conforme)."
        : "Aucun mandat de facturation actif pour ce vendeur.",
    },
    {
      icon: ShieldCheck,
      label: "KYC vérifié",
      ok: data.is_kyc_verified,
      tip: data.is_kyc_verified
        ? "Documents d'identité et d'entreprise vérifiés par MediKong."
        : "KYC en cours ou non complété.",
    },
  ];

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5 text-[11px]", className)}>
        {chips.filter((c) => c.ok).map(({ icon: Icon, label, tip }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700 cursor-help">
                <Icon size={11} />
                <span>{label}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">{tip}</TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 cursor-help">
              <ScrollText size={11} />
              <span>Garantie légale 2 ans</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] text-xs">
            {data.guarantee_label}. Vendeur responsable de la conformité.
          </TooltipContent>
        </Tooltip>
        <Link to="/confiance" className="text-primary hover:underline inline-flex items-center gap-0.5">
          <Info size={11} /> Traçabilité
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-3", className)}>
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#2563EB]" />
        <div>
          <p className="text-sm font-semibold text-foreground">Garanties & Vendeur</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {data.guarantee_label}. Le vendeur reste responsable de la conformité et du SAV
            conformément à la législation européenne applicable.
          </p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {chips.map(({ icon: Icon, label, ok, tip }) => (
          <li key={label} className="flex items-start gap-2 text-xs">
            <Icon size={14} className={cn("mt-0.5 shrink-0", ok ? "text-emerald-600" : "text-slate-400")} />
            <div>
              <span className={cn("font-medium", ok ? "text-foreground" : "text-muted-foreground line-through")}>{label}</span>
              <span className="ml-1 text-muted-foreground">— {tip}</span>
            </div>
          </li>
        ))}
        {data.brand_authorization && (
          <li className="flex items-start gap-2 text-xs">
            <FileCheck2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <span className="font-medium text-foreground">Autorisation de marque</span>
              <span className="ml-1 text-muted-foreground">
                — {data.brand_authorization.authorization_type}
                {data.brand_authorization.document_reference ? ` · réf. ${data.brand_authorization.document_reference}` : ""}
                {data.brand_authorization.valid_until ? ` · valide jusqu'au ${data.brand_authorization.valid_until}` : ""}
              </span>
            </div>
          </li>
        )}
      </ul>
      <div className="pt-1 text-[11px]">
        <Link to="/confiance" className="text-primary hover:underline">
          Comment MediKong vérifie ses vendeurs →
        </Link>
      </div>
    </div>
  );
}
