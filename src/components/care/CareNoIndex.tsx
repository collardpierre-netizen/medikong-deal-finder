import { Helmet } from "react-helmet-async";

/**
 * La surface Care n'est jamais indexable, quel que soit l'environnement.
 * Monté une seule fois à la racine de CareApp.
 */
export function CareNoIndex() {
  return (
    <Helmet>
      <meta name="robots" content="noindex, nofollow, noarchive" />
    </Helmet>
  );
}
