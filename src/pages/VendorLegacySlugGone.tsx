/**
 * 🪦 Page « 410 Gone » pour l'ancienne route /vendeur/:slug.
 *
 * Contexte : depuis l'anonymisation systématique des vendeurs (cf. mem
 * `vendor-anonymity-guardrail`), les URL contenant un slug nominatif
 * (ex. /vendeur/pharma-belgique-sa) sont supprimées volontairement.
 * Seule la route /vendeur/:code (display_code 6 chars opaque) reste valide.
 *
 * Cette page :
 *   - rend un contenu minimal explicite
 *   - signale aux crawlers via <meta name="robots" content="noindex,nofollow">
 *     (équivalent en SPA du header HTTP X-Robots-Tag, qu'on ne contrôle pas
 *     depuis l'hosting Lovable)
 *   - NE FAIT AUCUN redirect (signal "supprimé volontairement, ne retente pas")
 */
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, Link } from "react-router-dom";

export default function VendorLegacySlugGone() {
  const { code } = useParams<{ code: string }>();

  // Trace côté analytics/logs serveur pour mesurer le résidu d'anciens liens.
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.info("[vendor.legacy_slug_410]", { slug: code });
    }
  }, [code]);

  return (
    <>
      <Helmet>
        <title>Page supprimée — MediKong</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="googlebot" content="noindex,nofollow" />
      </Helmet>

      <main
        role="main"
        className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center"
      >
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          410 · Gone
        </p>
        <h1 className="mb-4 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Cette page n'existe plus
        </h1>
        <p className="mb-8 text-base text-muted-foreground">
          Les pages vendeurs identifiées par leur nom commercial ont été retirées
          du site. Les fournisseurs sont désormais anonymisés par défaut sur
          MediKong.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/catalogue"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Voir le catalogue
          </Link>
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-5 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Retour à l'accueil
          </Link>
        </div>
      </main>
    </>
  );
}

/**
 * Détecte si un paramètre d'URL /vendeur/:code correspond à un ancien slug
 * nominatif (à 410) plutôt qu'à un display_code public valide.
 *
 * display_code MediKong = exactement 6 caractères alphanumériques
 * (cf. mem `vendor-display-code-vs-qogita-alias`). Tout le reste
 * (slug avec tirets, longueur ≠ 6, caractères non alphanum) est un
 * ancien lien → 410.
 */
export function isLegacyVendorSlug(value: string | undefined | null): boolean {
  if (!value) return false;
  return !/^[A-Za-z0-9]{6}$/.test(value.trim());
}
