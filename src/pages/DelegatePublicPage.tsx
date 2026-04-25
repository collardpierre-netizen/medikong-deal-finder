import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { PageTransition } from "@/components/shared/PageTransition";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Mail,
  Phone,
  CalendarDays,
  MapPin,
  User as UserIcon,
  Lock,
  ArrowLeft,
  Globe,
  Briefcase,
  Star,
  Building2,
} from "lucide-react";

interface Delegate {
  id: string;
  vendor_id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  booking_url: string | null;
  photo_url: string | null;
  bio: string | null;
  languages: string[];
  country_codes: string[];
  regions: string[];
  postal_codes: string[];
  target_profiles: string[];
  primary_target_profiles: string[];
  is_active: boolean;
}

interface Vendor {
  id: string;
  slug: string | null;
  company_name: string | null;
  name: string | null;
  logo_url: string | null;
}

const PROFILE_LABELS: Record<string, string> = {
  pharmacy: "Pharmacie",
  parapharmacy: "Parapharmacie",
  wholesaler: "Grossiste",
  hospital: "Hôpital",
  dentist: "Dentiste",
  veterinary: "Vétérinaire",
  ehpad: "EHPAD",
  medical_practice: "Cabinet médical",
};

const COUNTRY_LABELS: Record<string, string> = {
  BE: "Belgique",
  FR: "France",
  LU: "Luxembourg",
  NL: "Pays-Bas",
  DE: "Allemagne",
};

export default function DelegatePublicPage() {
  const { delegateId } = useParams<{ delegateId: string }>();
  const navigate = useNavigate();
  const { user, isVerifiedBuyer, loading: authLoading } = useAuth();

  const { data: delegate, isLoading } = useQuery<Delegate | null>({
    queryKey: ["delegate-public", delegateId],
    queryFn: async () => {
      if (!delegateId) return null;
      const { data, error } = await supabase
        .from("vendor_delegates" as any)
        .select("*")
        .eq("id", delegateId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Delegate) || null;
    },
    enabled: !!delegateId && isVerifiedBuyer,
  });

  const { data: vendor } = useQuery<Vendor | null>({
    queryKey: ["delegate-public-vendor", delegate?.vendor_id],
    queryFn: async () => {
      if (!delegate?.vendor_id) return null;
      const { data } = await supabase
        .from("vendors")
        .select("id, slug, company_name, name, logo_url")
        .eq("id", delegate.vendor_id)
        .maybeSingle();
      return (data as unknown as Vendor) || null;
    },
    enabled: !!delegate?.vendor_id,
  });

  // Si non authentifié → redirige
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/connexion?redirect=/delegue/${delegateId}`);
    }
  }, [authLoading, user, navigate, delegateId]);

  if (authLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-muted-foreground">
          Chargement…
        </div>
      </Layout>
    );
  }

  // Acheteur connecté mais pas vérifié → message d'accès
  if (user && !isVerifiedBuyer) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="rounded-xl border border-border bg-accent/30 p-8 text-center">
            <Lock className="mx-auto mb-3 text-muted-foreground" size={32} />
            <h1 className="text-xl font-bold text-foreground mb-2">
              Accès réservé aux acheteurs vérifiés
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Les fiches contact des délégués commerciaux ne sont visibles que par les
              acheteurs professionnels vérifiés. Faites vérifier votre compte pour
              accéder aux coordonnées et prendre rendez-vous.
            </p>
            <Link
              to="/compte"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90"
            >
              Faire vérifier mon compte
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-muted-foreground">
          Chargement de la fiche…
        </div>
      </Layout>
    );
  }

  if (!delegate) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">
            Délégué introuvable
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Cette fiche n'existe pas ou n'est plus active.
          </p>
          <Link
            to="/recherche"
            className="text-sm font-semibold text-primary hover:underline"
          >
            ← Retour au catalogue
          </Link>
        </div>
      </Layout>
    );
  }

  const fullName = `${delegate.first_name} ${delegate.last_name}`;
  const vendorName = vendor?.company_name || vendor?.name || "Fournisseur";
  const pageTitle = `${fullName}${delegate.job_title ? ` — ${delegate.job_title}` : ""} | ${vendorName}`;

  return (
    <Layout>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <PageTransition>
        <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
          {/* Breadcrumb / retour */}
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            {vendor?.slug && (
              <Link
                to={`/vendeur/${vendor.slug}`}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <ArrowLeft size={14} />
                Retour à {vendorName}
              </Link>
            )}
          </div>

          {/* Header carte */}
          <div className="rounded-2xl border border-border bg-background overflow-hidden">
            <div className="bg-gradient-to-br from-primary/10 to-accent/30 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-background border-4 border-background shadow-md flex items-center justify-center overflow-hidden shrink-0">
                  {delegate.photo_url ? (
                    <img
                      src={delegate.photo_url}
                      alt={fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon size={40} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {fullName}
                  </h1>
                  {delegate.job_title && (
                    <p className="text-sm sm:text-base text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Briefcase size={14} />
                      {delegate.job_title}
                    </p>
                  )}
                  {vendor && (
                    <Link
                      to={vendor.slug ? `/vendeur/${vendor.slug}` : "#"}
                      className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      {vendor.logo_url && (
                        <img
                          src={vendor.logo_url}
                          alt={vendorName}
                          className="w-5 h-5 rounded object-contain"
                        />
                      )}
                      <Building2 size={14} />
                      {vendorName}
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Bio */}
            {delegate.bio && (
              <div className="px-6 sm:px-8 py-5 border-b border-border">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  À propos
                </h2>
                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                  {delegate.bio}
                </p>
              </div>
            )}

            {/* CTA principal */}
            {delegate.booking_url && (
              <div className="px-6 sm:px-8 py-5 border-b border-border bg-accent/20">
                <a
                  href={delegate.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
                >
                  <CalendarDays size={18} />
                  Prendre rendez-vous
                </a>
                <p className="text-xs text-muted-foreground mt-2">
                  Choisissez un créneau directement dans l'agenda du délégué.
                </p>
              </div>
            )}

            {/* Coordonnées */}
            <div className="px-6 sm:px-8 py-5 border-b border-border">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Coordonnées
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {delegate.email && (
                  <a
                    href={`mailto:${delegate.email}`}
                    className="flex items-center gap-2.5 p-3 rounded-lg border border-border hover:border-primary hover:bg-accent/30 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Mail size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Email
                      </div>
                      <div className="text-sm font-medium text-foreground truncate">
                        {delegate.email}
                      </div>
                    </div>
                  </a>
                )}
                {delegate.phone && (
                  <a
                    href={`tel:${delegate.phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-2.5 p-3 rounded-lg border border-border hover:border-primary hover:bg-accent/30 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Phone size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Téléphone
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {delegate.phone}
                      </div>
                    </div>
                  </a>
                )}
              </div>
            </div>

            {/* Couverture */}
            {(delegate.country_codes.length > 0 ||
              delegate.regions.length > 0 ||
              delegate.postal_codes.length > 0 ||
              delegate.languages.length > 0) && (
              <div className="px-6 sm:px-8 py-5 border-b border-border">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Zone de couverture
                </h2>
                <div className="space-y-3 text-sm">
                  {delegate.country_codes.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Globe size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex flex-wrap gap-1.5">
                        {delegate.country_codes.map((c) => (
                          <span
                            key={c}
                            className="text-xs px-2 py-0.5 rounded bg-accent text-foreground font-medium"
                          >
                            {COUNTRY_LABELS[c] || c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {delegate.regions.length > 0 && (
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex flex-wrap gap-1.5">
                        {delegate.regions.map((r) => (
                          <span
                            key={r}
                            className="text-xs px-2 py-0.5 rounded bg-accent text-foreground"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {delegate.postal_codes.length > 0 && (
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground self-center mr-1">
                          Codes postaux :
                        </span>
                        {delegate.postal_codes.slice(0, 30).map((p) => (
                          <span
                            key={p}
                            className="text-xs px-1.5 py-0.5 rounded bg-accent/60 text-muted-foreground font-mono"
                          >
                            {p}
                          </span>
                        ))}
                        {delegate.postal_codes.length > 30 && (
                          <span className="text-xs text-muted-foreground self-center">
                            +{delegate.postal_codes.length - 30}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {delegate.languages.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 shrink-0">
                        Langues :
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {delegate.languages.map((l) => (
                          <span
                            key={l}
                            className="text-xs px-2 py-0.5 rounded bg-accent text-foreground uppercase font-medium"
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cibles */}
            {delegate.target_profiles.length > 0 && (
              <div className="px-6 sm:px-8 py-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Profils d'acheteurs ciblés
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {delegate.target_profiles.map((p) => {
                    const isPrimary = (delegate.primary_target_profiles || []).includes(p);
                    return (
                      <span
                        key={p}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border ${
                          isPrimary
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : "bg-accent text-foreground border-border"
                        }`}
                      >
                        {isPrimary && <Star size={10} fill="currentColor" />}
                        {PROFILE_LABELS[p] || p}
                      </span>
                    );
                  })}
                </div>
                {delegate.primary_target_profiles.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    ★ Référent principal sur ces segments
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </PageTransition>
    </Layout>
  );
}
