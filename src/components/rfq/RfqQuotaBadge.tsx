import { Sparkles, Coins, Infinity as InfinityIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRfqQuota } from "@/hooks/useRfqQuota";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  className?: string;
  variant?: "compact" | "full";
}

/** Badge "X RFQ restantes" / "Illimité" — gating visuel uniquement. */
export default function RfqQuotaBadge({ className, variant = "compact" }: Props) {
  const { data: q, isLoading } = useRfqQuota();
  if (isLoading || !q) return null;

  if (q.unlimited) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className={`gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 ${className || ""}`}>
              <InfinityIcon className="h-3 w-3" /> Illimité
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {q.reason === "admin" ? "Compte administrateur — RFQ illimitées." : "Forfait Premium actif — RFQ illimitées."}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const remaining = q.total_remaining ?? (q.monthly_remaining + q.permanent_credits);
  const tone = remaining === 0 ? "destructive" : remaining <= 2 ? "warning" : "ok";
  const cls =
    tone === "destructive" ? "bg-red-100 text-destructive hover:bg-red-100" :
    tone === "warning" ? "bg-amber-100 text-amber-800 hover:bg-amber-100" :
    "bg-blue-50 text-primary hover:bg-blue-50";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className={`gap-1 ${cls} ${className || ""}`}>
            <Coins className="h-3 w-3" />
            {variant === "compact" ? `${remaining} RFQ` : `${remaining} demande${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          <div className="space-y-0.5">
            <div><Sparkles className="inline h-3 w-3 mr-1" />Quota mensuel : <strong>{q.monthly_remaining}/{q.monthly_quota}</strong></div>
            <div><Coins className="inline h-3 w-3 mr-1" />Crédits achetés : <strong>{q.permanent_credits}</strong></div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
