import { SellerTrustBadge } from "@/components/product/SellerTrustBadge";

export default function SellerTrustBadgeDemo() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <h1 className="text-2xl font-bold mb-8">SellerTrustBadge — Démo</h1>

      <div className="grid gap-8 max-w-md">
        {/* Case 1: no flags */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Aucune option activée</h2>
          <SellerTrustBadge />
        </section>

        {/* Case 2: 2 flags */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">2 options activées</h2>
          <SellerTrustBadge garantieAuthenticite retourGratuit />
        </section>

        {/* Case 3: all flags */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Toutes les options</h2>
          <SellerTrustBadge
            garantieAuthenticite
            retourGratuit
            remboursementNonConforme
            serviceClientVendeur
            livraisonExpress
          />
        </section>
      </div>
    </div>
  );
}
