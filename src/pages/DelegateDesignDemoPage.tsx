import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, CalendarDays, User as UserIcon, ExternalLink, Package, Truck, Building2, ShoppingCart, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Page de démo autonome /demo/delegues
 * Présente le composant "Mon délégué" intégré dans 3 contextes :
 *  1. Fiche produit
 *  2. Fiche vendeur publique
 *  3. QuickView produit (popup) depuis le shop d'un vendeur
 *
 * Toutes les données sont mockées (pas d'appel Supabase) pour pouvoir
 * être visible même sans utilisateur vérifié ni délégué actif en base.
 */

const mockDelegate = {
  first_name: "Sophie",
  last_name: "Lambert",
  job_title: "Déléguée commerciale Pharmacies — BeNeLux",
  email: "sophie.lambert@example.com",
  phone: "+32 470 12 34 56",
  booking_url: "https://calendly.com/example",
  photo_url: null as string | null,
  isPrimary: true,
};

function DelegateCard({ variant = "card" as "card" | "inline" }) {
  const d = mockDelegate;
  const containerClass =
    variant === "card"
      ? "rounded-lg border border-border bg-accent/30 p-3"
      : "p-2";

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {d.isPrimary ? "★ Votre référent dédié" : "Votre contact"}
        </span>
      </div>
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
          <UserIcon size={16} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate inline-flex items-center gap-1">
            {d.first_name} {d.last_name}
            <ExternalLink size={10} className="opacity-60" />
          </span>
          <div className="text-[10px] text-muted-foreground truncate">{d.job_title}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <a href={`mailto:${d.email}`} className="inline-flex items-center gap-1 text-foreground hover:text-primary">
              <Mail size={11} />
              <span className="truncate max-w-[180px]">{d.email}</span>
            </a>
            <a href={`tel:${d.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-foreground hover:text-primary">
              <Phone size={11} />
              <span>{d.phone}</span>
            </a>
            <a
              href={d.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary text-primary-foreground hover:opacity-90 text-[10px] font-semibold"
            >
              <CalendarDays size={10} />
              Prendre RDV
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockProductCard({ onQuickView }: { onQuickView: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 group">
      <div className="aspect-square rounded bg-muted flex items-center justify-center mb-2">
        <Package size={40} className="text-muted-foreground" />
      </div>
      <p className="text-[10px] text-muted-foreground uppercase">Tena</p>
      <h4 className="text-sm font-semibold text-foreground line-clamp-2">Tena Lady Normal — 12 unités</h4>
      <p className="text-base font-bold text-primary mt-1">3.45 €</p>
      <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-[11px]" onClick={onQuickView}>
        <Eye size={12} className="mr-1" /> Aperçu rapide
      </Button>
    </div>
  );
}

export default function DelegateDesignDemoPage() {
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-10">
        <header className="border-b border-border pb-4">
          <h1 className="text-2xl font-bold text-foreground">Démo — Fiche Délégué intégrée</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aperçu du composant <code className="text-xs bg-muted px-1 rounded">VendorDelegateCompact</code> dans
            les 3 contextes d'affichage (données mockées, indépendant du back).
          </p>
          <div className="mt-3 text-[12px] text-muted-foreground">
            ℹ️ En production, ce composant ne s'affiche que pour les <b>acheteurs vérifiés</b> et est filtré par
            profil professionnel + pays.
          </div>
        </header>

        {/* Contexte 1 : Fiche produit */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            1️⃣ Dans la <span className="text-primary">fiche produit</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4 rounded-xl border border-border p-4 bg-card">
            <div>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <Package size={64} className="text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mt-3 text-foreground">Tena Lady Normal — 12 unités</h3>
              <p className="text-sm text-muted-foreground">Marque Tena · GTIN 7322540762846</p>
              <p className="text-2xl font-bold text-primary mt-2">3.45 € <span className="text-xs text-muted-foreground">HTVA</span></p>
            </div>
            <aside className="space-y-3">
              <Button className="w-full"><ShoppingCart size={14} className="mr-2" /> Ajouter au panier</Button>
              <DelegateCard variant="card" />
              <p className="text-[10px] text-muted-foreground italic">↑ Encart placé sous le bouton d'achat</p>
            </aside>
          </div>
        </section>

        {/* Contexte 2 : Fiche vendeur publique */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            2️⃣ Dans la <span className="text-primary">fiche vendeur publique</span>
          </h2>
          <div className="rounded-xl border border-border p-4 bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                <Building2 size={24} className="text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Pharma Distribution SA</h3>
                <p className="text-xs text-muted-foreground">Bruxelles · Belgique · 1 245 produits</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Grossiste agréé AFMPS spécialisé en produits de soin et hygiène. Livraison J+1 sur toute la Belgique.</p>
                <div className="flex gap-2 text-[11px]">
                  <span className="px-2 py-1 bg-muted rounded">✓ Vérifié</span>
                  <span className="px-2 py-1 bg-muted rounded">⏱ Livraison 24h</span>
                </div>
              </div>
              <div>
                <DelegateCard variant="card" />
                <p className="text-[10px] text-muted-foreground italic mt-1">↑ Encart placé en colonne droite</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contexte 3 : QuickView depuis le shop vendeur */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            3️⃣ Dans le <span className="text-primary">QuickView produit</span> (popup) du shop vendeur
          </h2>
          <div className="rounded-xl border border-border p-4 bg-card">
            <p className="text-xs text-muted-foreground mb-3">
              Cliquez sur "Aperçu rapide" d'un produit pour voir le QuickView avec la fiche délégué intégrée.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <MockProductCard key={i} onQuickView={() => setQuickViewOpen(true)} />
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">← Retour à l'accueil</Link>
        </footer>
      </div>

      {/* QuickView mocké */}
      <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Aperçu produit</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">
            <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
              <Package size={48} className="text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase">Tena</p>
              <h2 className="text-base font-bold text-foreground">Tena Lady Normal — 12 unités</h2>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold text-primary">3.45 €</span>
                <span className="text-[11px] text-muted-foreground">HTVA</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Package size={12} />
                  <span className="text-emerald-600 font-medium">En stock (124)</span>
                </span>
                <span className="inline-flex items-center gap-1"><Truck size={12} /> 1j</span>
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                <Building2 size={12} /> Vendu par
                <span className="font-semibold text-foreground">Pharma Distribution SA</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <DelegateCard variant="card" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
