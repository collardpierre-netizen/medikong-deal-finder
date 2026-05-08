import { Helmet } from "react-helmet-async";
import { IS_PROD } from "@/config/env";

/**
 * Injecte une meta robots `noindex, nofollow, noarchive` sur tous les environnements non-prod.
 * Monté une seule fois sous HelmetProvider pour s'appliquer globalement.
 */
export function EnvNoIndex() {
  if (IS_PROD) return null;
  return (
    <Helmet>
      <meta name="robots" content="noindex, nofollow, noarchive" />
    </Helmet>
  );
}
