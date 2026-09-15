import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { careUrlFromLegacyPath } from "@/config/surface";

/**
 * Monté sur `/care/*` de la surface marketplace : renvoie vers l'origine Care
 * en conservant chemin et query string.
 *
 * Note : redirection navigateur (`location.replace`), pas un 301 HTTP —
 * l'hébergement ne lit pas de fichier de redirections. Sans impact SEO,
 * la surface Care étant en noindex global.
 */
export default function LegacyCareRedirect() {
  const location = useLocation();

  useEffect(() => {
    window.location.replace(careUrlFromLegacyPath(location.pathname, location.search));
  }, [location.pathname, location.search]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
      <p className="text-muted-foreground">
        MediKong Care a déménagé. Redirection en cours vers care.medikong.pro…
      </p>
    </div>
  );
}
