import { useEffect, useMemo, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getProductImageSrc } from "@/lib/image-utils";

/**
 * Logo de vendeur externe avec fallback automatique :
 * - Affiche le logo si l'URL est valide et l'image se charge
 * - Sinon, affiche un badge avec les 2 premières lettres significatives du nom
 * - Tooltip non-bloquant indiquant "Logo indisponible" en cas d'échec
 *
 * Le composant gère le fallback localement, sans bloquer le rendu de l'offre.
 */

const FAILED_LOGOS: Set<string> = new Set();

function getInitials(name?: string | null): string {
  if (!name) return "?";
  // Sépare sur espaces / tirets / underscores
  const tokens = name
    .replace(/[_\-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }
  return (tokens[0][0] + tokens[1][0]).toUpperCase();
}

interface ExternalVendorLogoProps {
  name?: string | null;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}

export function ExternalVendorLogo({
  name,
  logoUrl,
  size = 40,
  className = "",
}: ExternalVendorLogoProps) {
  const initialFailed = !!logoUrl && FAILED_LOGOS.has(logoUrl);
  const [failed, setFailed] = useState(initialFailed);

  useEffect(() => {
    setFailed(!!logoUrl && FAILED_LOGOS.has(logoUrl));
  }, [logoUrl]);

  // Route external logos through image-proxy to bypass hotlink/CORS protection
  // (e.g. IIS servers like idphar.be that 403 on cross-origin Referer)
  const proxiedSrc = useMemo(
    () => (logoUrl ? getProductImageSrc(logoUrl) : null),
    [logoUrl],
  );

  const showFallback = !logoUrl || failed;
  const initials = getInitials(name);
  const dim = { width: size, height: size };

  if (showFallback) {
    const badge = (
      <div
        style={dim}
        className={`rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border border-border select-none ${className}`}
        aria-label={name || "Vendeur externe"}
      >
        {initials}
      </div>
    );

    if (failed) {
      return (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Logo indisponible — affichage du nom abrégé
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return badge;
  }

  return (
    <img
      src={logoUrl!}
      alt={name || "Vendeur externe"}
      referrerPolicy="no-referrer"
      style={dim}
      className={`rounded-lg object-contain bg-white border border-border ${className}`}
      onError={() => {
        if (logoUrl) FAILED_LOGOS.add(logoUrl);
        setFailed(true);
      }}
    />
  );
}
