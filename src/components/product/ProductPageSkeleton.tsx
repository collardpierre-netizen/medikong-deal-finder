import { Layout } from "@/components/layout/Layout";

/**
 * Squelette de la fiche produit — miroir simplifié de la structure réelle
 * (breadcrumb, galerie, colonne infos, blocs offres). Utilisé pour tous les
 * états intermédiaires (isLoading, product null pendant refetch, etc.) afin
 * de garantir un ordre de rendu stable sans early return avant les hooks de
 * ProductPage.
 */
export function ProductPageSkeleton({ notFound = false }: { notFound?: boolean }) {
  if (notFound) {
    return (
      <Layout>
        <div className="mk-container py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4" aria-hidden />
            <h1 className="text-xl font-bold text-foreground mb-2">Produit introuvable</h1>
            <p className="text-sm text-muted-foreground">
              Cette fiche n'existe pas ou n'est plus disponible.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        className="mk-container py-6"
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="Chargement de la fiche produit"
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-3 w-16 rounded bg-muted animate-pulse" />
          <div className="h-3 w-3 rounded bg-muted/60" />
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          <div className="h-3 w-3 rounded bg-muted/60" />
          <div className="h-3 w-32 rounded bg-muted animate-pulse" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-8">
          {/* Galerie + infos */}
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="aspect-square rounded-xl bg-muted animate-pulse" />
              <div className="space-y-3">
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                <div className="h-7 w-4/5 rounded bg-muted animate-pulse" />
                <div className="h-5 w-3/5 rounded bg-muted animate-pulse" />
                <div className="flex gap-2 pt-2">
                  <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
                  <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
                </div>
                <div className="pt-4 space-y-2">
                  <div className="h-3 w-full rounded bg-muted animate-pulse" />
                  <div className="h-3 w-11/12 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-9/12 rounded bg-muted animate-pulse" />
                </div>
              </div>
            </div>

            {/* Onglets offres */}
            <div className="mt-8">
              <div className="flex gap-2 mb-4">
                <div className="h-9 w-32 rounded-md bg-muted animate-pulse" />
                <div className="h-9 w-32 rounded-md bg-muted/70 animate-pulse" />
                <div className="h-9 w-28 rounded-md bg-muted/70 animate-pulse" />
              </div>
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted/70 animate-pulse" />
                ))}
              </div>
            </div>
          </div>

          {/* Colonne prix / actions */}
          <aside className="space-y-4">
            <div className="border border-border rounded-xl p-5 space-y-3">
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              <div className="h-9 w-40 rounded bg-muted animate-pulse" />
              <div className="h-3 w-32 rounded bg-muted animate-pulse" />
              <div className="pt-3 space-y-2">
                <div className="h-10 w-full rounded-lg bg-muted animate-pulse" />
                <div className="h-10 w-full rounded-lg bg-muted/70 animate-pulse" />
              </div>
            </div>
            <div className="border border-border rounded-xl p-5 space-y-2">
              <div className="h-3 w-28 rounded bg-muted animate-pulse" />
              <div className="h-3 w-full rounded bg-muted animate-pulse" />
              <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
            </div>
          </aside>
        </div>

        <span className="sr-only">Chargement en cours</span>
      </div>
    </Layout>
  );
}
