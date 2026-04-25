import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PageTransition } from "@/components/shared/PageTransition";
import VendorDelegateCompactDemo, {
  type DemoDelegate,
} from "@/components/vendor/VendorDelegateCompactDemo";
import {
  Mail,
  Phone,
  CalendarDays,
  MapPin,
  User as UserIcon,
  Globe,
  Briefcase,
  Star,
  Building2,
  ArrowLeft,
} from "lucide-react";

const DEMO_DELEGATE: DemoDelegate = {
  first_name: "Sophie",
  last_name: "Lambert",
  job_title: "Responsable Comptes Pharmacies — Belgique Sud",
  email: "sophie.lambert@demo-pharma.be",
  phone: "+32 470 12 34 56",
  booking_url: "https://calendly.com/demo",
  photo_url:
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face",
  isPrimary: true,
};

const DEMO_DELEGATE_SECONDARY: DemoDelegate = {
  first_name: "Karim",
  last_name: "Bensalah",
  job_title: "Account Manager — Hôpitaux & EHPAD",
  email: "karim.b@demo-pharma.be",
  phone: "+32 470 98 76 54",
  booking_url: "https://calendly.com/demo",
  photo_url:
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=face",
  isPrimary: false,
};

const PROFILE_LABELS: Record<string, string> = {
  pharmacy: "Pharmacie",
  hospital: "Hôpital",
  ehpad: "EHPAD",
  dentist: "Dentiste",
};

/**
 * Page de validation design pour les composants "Délégué".
 * Pas de connexion ni de RLS : données fictives en dur.
 * Accessible publiquement à /demo/delegues.
 */
export default function DelegateDesignDemoPage() {
  return (
    <Layout>
      <Helmet>
        <title>Démo · Fiches délégué — MediKong</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <PageTransition>
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={14} /> Accueil
            </Link>
            <h1 className="text-2xl font-bold mt-2">
              Démo design — Fiches délégué
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Aperçu des trois contextes d'affichage du délégué dédié
              (acheteur vérifié). Données fictives à but de validation visuelle.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Contexte 1 : Fiche produit (sidebar) */}
            <section className="border border-border rounded-lg overflow-hidden">
              <header className="bg-muted/40 px-4 py-2 border-b border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Contexte
                </div>
                <div className="text-sm font-semibold">
                  Fiche produit · sidebar offre
                </div>
              </header>
              <div className="p-4 space-y-3 bg-background">
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs text-muted-foreground mb-1">
                    Vendu par
                  </div>
                  <div className="font-semibold text-sm">Demo Pharma BE</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-primary">
                      12,40 €
                    </span>
                    <span className="text-xs text-muted-foreground">
                      HTVA · MOQ 6
                    </span>
                  </div>
                  <button className="mt-3 w-full bg-primary text-primary-foreground text-sm font-semibold py-2 rounded">
                    Ajouter au panier
                  </button>
                </div>
                <VendorDelegateCompactDemo delegate={DEMO_DELEGATE} variant="card" />
              </div>
            </section>

            {/* Contexte 2 : Panier */}
            <section className="border border-border rounded-lg overflow-hidden">
              <header className="bg-muted/40 px-4 py-2 border-b border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Contexte
                </div>
                <div className="text-sm font-semibold">
                  Panier · bloc vendeur
                </div>
              </header>
              <div className="p-4 bg-background">
                <div className="rounded-md border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">Demo Pharma BE</div>
                    <span className="text-xs text-muted-foreground">
                      3 articles
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Sous-total : <span className="font-semibold text-foreground">87,30 €</span>
                  </div>
                  <VendorDelegateCompactDemo
                    delegate={DEMO_DELEGATE}
                    variant="inline"
                  />
                </div>
              </div>
            </section>

            {/* Contexte 3 : Page vendeur publique */}
            <section className="border border-border rounded-lg overflow-hidden lg:col-span-2">
              <header className="bg-muted/40 px-4 py-2 border-b border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Contexte
                </div>
                <div className="text-sm font-semibold">
                  Page vendeur publique · équipe commerciale
                </div>
              </header>
              <div className="p-6 bg-background">
                <h2 className="text-lg font-semibold mb-1">
                  Notre équipe commerciale
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Vos contacts dédiés chez Demo Pharma BE.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[DEMO_DELEGATE, DEMO_DELEGATE_SECONDARY].map((d, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border p-4 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-full bg-muted border border-border overflow-hidden shrink-0">
                          {d.photo_url ? (
                            <img
                              src={d.photo_url}
                              alt={`${d.first_name} ${d.last_name}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <UserIcon size={20} className="text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm flex items-center gap-1.5">
                            {d.first_name} {d.last_name}
                            {d.isPrimary && (
                              <Star
                                size={12}
                                className="text-amber-500 fill-amber-500"
                              />
                            )}
                          </div>
                          {d.job_title && (
                            <div className="text-xs text-muted-foreground">
                              {d.job_title}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="inline-flex items-center gap-1 text-[10px] bg-accent px-1.5 py-0.5 rounded">
                              <Globe size={9} /> FR · NL
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] bg-accent px-1.5 py-0.5 rounded">
                              <MapPin size={9} /> BE
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] bg-accent px-1.5 py-0.5 rounded">
                              <Briefcase size={9} /> Pharmacie
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs">
                        {d.email && (
                          <a
                            href={`mailto:${d.email}`}
                            className="flex items-center gap-2 text-foreground hover:text-primary"
                          >
                            <Mail size={12} /> {d.email}
                          </a>
                        )}
                        {d.phone && (
                          <a
                            href={`tel:${d.phone.replace(/\s/g, "")}`}
                            className="flex items-center gap-2 text-foreground hover:text-primary"
                          >
                            <Phone size={12} /> {d.phone}
                          </a>
                        )}
                        {d.booking_url && (
                          <a
                            href={d.booking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold"
                          >
                            <CalendarDays size={11} /> Prendre rendez-vous
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Contexte 4 : Fiche délégué publique (résumé) */}
            <section className="border border-border rounded-lg overflow-hidden lg:col-span-2">
              <header className="bg-muted/40 px-4 py-2 border-b border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Contexte
                </div>
                <div className="text-sm font-semibold">
                  Fiche délégué publique · /delegue/:id
                </div>
              </header>
              <div className="p-6 bg-background">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="w-32 h-32 rounded-full bg-muted border border-border overflow-hidden shrink-0 mx-auto sm:mx-0">
                    {DEMO_DELEGATE.photo_url && (
                      <img
                        src={DEMO_DELEGATE.photo_url}
                        alt="Sophie Lambert"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Building2 size={12} /> Demo Pharma BE
                    </div>
                    <h2 className="text-2xl font-bold mt-1">
                      {DEMO_DELEGATE.first_name} {DEMO_DELEGATE.last_name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {DEMO_DELEGATE.job_title}
                    </p>
                    <p className="text-sm mt-3 text-foreground/90">
                      Sophie accompagne les pharmacies indépendantes en
                      Belgique francophone depuis 8 ans. Elle peut vous aider
                      à optimiser vos commandes, négocier des paliers tarifaires
                      et organiser vos livraisons.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <a
                        href={`mailto:${DEMO_DELEGATE.email}`}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded border border-border hover:bg-accent text-sm"
                      >
                        <Mail size={14} /> {DEMO_DELEGATE.email}
                      </a>
                      <a
                        href={`tel:${DEMO_DELEGATE.phone?.replace(/\s/g, "")}`}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded border border-border hover:bg-accent text-sm"
                      >
                        <Phone size={14} /> {DEMO_DELEGATE.phone}
                      </a>
                      <a
                        href={DEMO_DELEGATE.booking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary text-primary-foreground hover:opacity-90 text-sm font-semibold"
                      >
                        <CalendarDays size={14} /> Prendre rendez-vous
                      </a>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 bg-accent px-2 py-1 rounded">
                        <Globe size={11} /> Français · Néerlandais
                      </span>
                      <span className="inline-flex items-center gap-1 bg-accent px-2 py-1 rounded">
                        <MapPin size={11} /> Belgique (Wallonie, Bruxelles)
                      </span>
                      {Object.values(PROFILE_LABELS).map((p) => (
                        <span
                          key={p}
                          className="inline-flex items-center gap-1 bg-accent px-2 py-1 rounded"
                        >
                          <Briefcase size={11} /> {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Page de démo · données fictives · accessible uniquement via lien direct.
          </p>
        </div>
      </PageTransition>
    </Layout>
  );
}
