import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserX,
  ArrowRight,
  Store,
  ShoppingCart,
  FileCheck,
  Mail,
  CreditCard,
  ShieldCheck,
  FileSignature,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  cta?: { label: string; to: string; variant?: "default" | "outline" };
  done?: boolean;
};

type ChecklistState = "done" | "pending" | "todo" | "blocked";

type ChecklistItem = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  state: ChecklistState;
  cta?: { label: string; to: string; variant?: "default" | "outline" };
};

const stateStyles: Record<ChecklistState, { badge: string; label: string; iconWrap: string }> = {
  done: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "OK",
    iconWrap: "bg-emerald-50 text-emerald-700",
  },
  pending: {
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    label: "En cours",
    iconWrap: "bg-amber-50 text-amber-700",
  },
  todo: {
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    label: "À faire",
    iconWrap: "bg-sky-50 text-sky-700",
  },
  blocked: {
    badge: "bg-red-50 text-red-700 border-red-200",
    label: "Bloqué",
    iconWrap: "bg-red-50 text-red-700",
  },
};

function StateIcon({ state, Fallback }: { state: ChecklistState; Fallback: React.ComponentType<{ className?: string }> }) {
  if (state === "done") return <CheckCircle2 className="h-5 w-5" />;
  if (state === "pending") return <Clock className="h-5 w-5" />;
  if (state === "blocked") return <XCircle className="h-5 w-5" />;
  return <Fallback className="h-5 w-5" />;
}

export default function BuyerStatusPage() {
  const { user, buyerStatus, hasVendorAccount, verificationLoading } = useAuth();

  // Vendor details for the status checklist (Stripe + validation + contract).
  const { data: vendorDetails, isLoading: vendorLoading } = useQuery({
    queryKey: ["buyer-status:vendor-details", user?.id],
    enabled: !!user?.id && hasVendorAccount,
    queryFn: async () => {
      const { data: vendor } = await supabase
        .from("vendors")
        .select(
          "id, validation_status, is_verified, stripe_account_id, stripe_onboarding_complete, commissionnaire_agreement_accepted_at"
        )
        .eq("auth_user_id", user!.id)
        .maybeSingle();

      if (!vendor) return null;

      const { data: contract } = await supabase
        .from("seller_contracts")
        .select("id, signed_at, contract_type")
        .eq("vendor_id", vendor.id)
        .eq("contract_type", "mandat_facturation")
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return { vendor, contract };
    },
  });

  const statusMeta: Record<
    typeof buyerStatus,
    { label: string; tone: "success" | "warning" | "destructive" | "muted"; icon: React.ComponentType<{ className?: string }>; headline: string; sub: string }
  > = {
    verified: {
      label: "Vérifié",
      tone: "success",
      icon: CheckCircle2,
      headline: "Votre profil acheteur est vérifié",
      sub: "Vous avez accès à toutes les fonctionnalités : prix HTVA, commandes, Bonnes Affaires, RFQ.",
    },
    pending: {
      label: "En attente",
      tone: "warning",
      icon: Clock,
      headline: "Votre profil est en attente de validation",
      sub: "Notre équipe vérifie vos informations professionnelles. Délai habituel : 24 à 48 heures ouvrées.",
    },
    missing: {
      label: "Profil manquant",
      tone: "destructive",
      icon: AlertTriangle,
      headline: "Aucun profil acheteur n'est associé à votre compte",
      sub: hasVendorAccount
        ? "Vous êtes connecté en tant que vendeur. Pour acheter sur MediKong, activez votre compte acheteur."
        : "Créez votre profil acheteur professionnel pour accéder aux prix et passer commande.",
    },
    anonymous: {
      label: "Non connecté",
      tone: "muted",
      icon: UserX,
      headline: "Vous n'êtes pas connecté",
      sub: "Connectez-vous ou créez un compte pour accéder à votre espace acheteur.",
    },
  };

  if (verificationLoading) {
    return (
      <Layout>
        <div className="container max-w-3xl py-10 space-y-6">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  const meta = statusMeta[buyerStatus];
  const Icon = meta.icon;

  const toneClass =
    meta.tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : meta.tone === "warning"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : meta.tone === "destructive"
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-muted text-muted-foreground border-border";

  // Buyer-side checklist (always shown for logged-in users)
  const buyerChecklist: ChecklistItem[] = (() => {
    if (buyerStatus === "anonymous") return [];

    if (buyerStatus === "missing") {
      return [
        {
          key: "buyer-profile",
          icon: FileCheck,
          title: "Profil acheteur",
          description: hasVendorAccount
            ? "Activez votre compte acheteur — vos infos vendeur sont pré-remplies."
            : "Créez votre profil acheteur professionnel pour accéder aux prix.",
          state: "todo",
          cta: {
            label: hasVendorAccount ? "Activer mon compte acheteur" : "Créer mon profil",
            to: hasVendorAccount ? "/compte/activer-acheteur" : "/onboarding?role=buyer",
          },
        },
      ];
    }

    return [
      {
        key: "buyer-profile",
        icon: FileCheck,
        title: "Profil acheteur",
        description: "Vos informations professionnelles ont été enregistrées.",
        state: "done",
      },
      {
        key: "buyer-verification",
        icon: ShieldCheck,
        title: "Vérification MediKong",
        description:
          buyerStatus === "verified"
            ? "Votre compte est vérifié. Vous voyez les prix HTVA et pouvez commander."
            : "Vérification manuelle par notre équipe. Délai habituel : 24 à 48 h ouvrées. Un email sera envoyé dès validation.",
        state: buyerStatus === "verified" ? "done" : "pending",
      },
    ];
  })();

  // Vendor-side checklist (only when user also has a vendor account)
  const vendorChecklist: ChecklistItem[] = (() => {
    if (!hasVendorAccount || vendorLoading || !vendorDetails) return [];
    const v = vendorDetails.vendor;
    const contract = vendorDetails.contract;

    const validationState: ChecklistState =
      v.validation_status === "approved"
        ? "done"
        : v.validation_status === "rejected"
          ? "blocked"
          : "pending";

    const stripeDone = !!v.stripe_account_id && v.stripe_onboarding_complete === true;
    const stripeState: ChecklistState = stripeDone
      ? "done"
      : v.stripe_account_id
        ? "pending"
        : "todo";

    const contractSigned = !!contract?.signed_at || !!v.commissionnaire_agreement_accepted_at;
    const contractState: ChecklistState = contractSigned ? "done" : "todo";

    return [
      {
        key: "vendor-validation",
        icon: ShieldCheck,
        title: "Validation du compte vendeur",
        description:
          validationState === "done"
            ? "Votre compte vendeur est approuvé par MediKong."
            : validationState === "blocked"
              ? "Votre dossier a été refusé. Contactez le support pour connaître les motifs."
              : "Vérification en cours par notre équipe (KYC, documents légaux). Délai 24-48 h ouvrées.",
        state: validationState,
      },
      {
        key: "vendor-stripe",
        icon: CreditCard,
        title: "Stripe Connect (encaissement)",
        description: stripeDone
          ? "Compte Stripe relié et activé — vous pouvez recevoir des paiements."
          : v.stripe_account_id
            ? "Compte Stripe créé, mais l'onboarding n'est pas terminé. Reprenez les étapes restantes."
            : "Connectez votre compte Stripe pour recevoir les paiements de vos ventes.",
        state: stripeState,
        cta: stripeDone
          ? undefined
          : {
              label: v.stripe_account_id ? "Terminer Stripe" : "Configurer Stripe",
              to: "/vendor/stripe-onboarding",
              variant: stripeState === "todo" ? "default" : "outline",
            },
      },
      {
        key: "vendor-contract",
        icon: FileSignature,
        title: "Mandat de facturation",
        description: contractSigned
          ? "Mandat signé — MediKong peut émettre les factures en votre nom."
          : "Signez le mandat de facturation pour activer la facturation automatique (self-billing).",
        state: contractState,
        cta: contractSigned
          ? undefined
          : {
              label: "Signer le mandat",
              to: "/vendor/settings?tab=contract",
            },
      },
    ];
  })();

  const steps: Step[] = (() => {
    switch (buyerStatus) {
      case "anonymous":
        return [
          { icon: ShoppingCart, title: "Se connecter", description: "Accédez à votre espace si vous avez déjà un compte.", cta: { label: "Se connecter", to: "/connexion" } },
          { icon: FileCheck, title: "Créer un compte acheteur", description: "Inscription professionnelle en quelques minutes.", cta: { label: "Créer mon compte", to: "/inscription", variant: "outline" } },
        ];
      case "missing":
        return hasVendorAccount
          ? [
              { icon: ShoppingCart, title: "Activer votre compte acheteur", description: "Vos infos vendeur sont pré-remplies — quelques secondes suffisent.", cta: { label: "Activation rapide", to: "/compte/activer-acheteur" } },
              { icon: Store, title: "Retour au portail vendeur", description: "Continuer la gestion de votre catalogue et de vos commandes.", cta: { label: "Aller au portail vendeur", to: "/vendor", variant: "outline" } },
            ]
          : [
              { icon: FileCheck, title: "Créer votre profil acheteur", description: "Renseignez votre raison sociale, numéro de TVA et coordonnées.", cta: { label: "Créer mon profil acheteur", to: "/onboarding?role=buyer" } },
            ];
      case "pending":
        return [
          { icon: Mail, title: "Surveillez vos emails", description: `Une confirmation sera envoyée à ${user?.email ?? "votre adresse email"}.` },
          { icon: ShoppingCart, title: "En attendant", description: "Vous pouvez parcourir le catalogue (les prix s'afficheront une fois vérifié).", cta: { label: "Explorer le catalogue", to: "/catalogue", variant: "outline" } },
        ];
      case "verified":
        return [
          { icon: ShoppingCart, title: "Bonnes Affaires", description: "Découvrez les promotions et déstockages en cours.", cta: { label: "Voir les Bonnes Affaires", to: "/bonnes-affaires" } },
          { icon: FileCheck, title: "Mes catégories", description: "Personnalisez le catalogue selon votre profil professionnel.", cta: { label: "Gérer mes catégories", to: "/compte/mes-categories", variant: "outline" } },
          { icon: Mail, title: "Mes demandes (RFQ)", description: "Lancez ou suivez vos appels d'offres vendeurs.", cta: { label: "Mes RFQ", to: "/compte/mes-rfq", variant: "outline" } },
        ];
    }
  })();

  const renderChecklist = (items: ChecklistItem[]) => (
    <div className="space-y-3">
      {items.map((item) => {
        const styles = stateStyles[item.state];
        return (
          <div key={item.key} className="flex items-start gap-4 rounded-lg border p-4">
            <div className={`rounded-full p-2 ${styles.iconWrap}`}>
              <StateIcon state={item.state} Fallback={item.icon} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{item.title}</p>
                <Badge variant="outline" className={styles.badge}>{styles.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
            </div>
            {item.cta && (
              <Button asChild size="sm" variant={item.cta.variant ?? "default"}>
                <Link to={item.cta.to}>
                  {item.cta.label}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Layout>
      <div className="container max-w-3xl py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">État de mon compte</h1>
          <p className="text-muted-foreground mt-1">Vue d'ensemble de votre profil acheteur et des prochaines étapes.</p>
        </div>

        <Card className={`border ${toneClass}`}>
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="rounded-full bg-background/60 p-3">
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-background/60">{meta.label}</Badge>
                {user?.email && <span className="text-xs opacity-70">{user.email}</span>}
              </div>
              <CardTitle className="text-xl">{meta.headline}</CardTitle>
              <CardDescription className="mt-1 text-current/80">{meta.sub}</CardDescription>
            </div>
          </CardHeader>
        </Card>

        {buyerChecklist.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>État de votre compte acheteur</CardTitle>
              <CardDescription>Suivi détaillé des étapes de validation côté acheteur.</CardDescription>
            </CardHeader>
            <CardContent>{renderChecklist(buyerChecklist)}</CardContent>
          </Card>
        )}

        {hasVendorAccount && (
          <Card>
            <CardHeader>
              <CardTitle>État de votre compte vendeur</CardTitle>
              <CardDescription>Validation MediKong, Stripe Connect et mandat de facturation.</CardDescription>
            </CardHeader>
            <CardContent>
              {vendorLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : vendorChecklist.length > 0 ? (
                renderChecklist(vendorChecklist)
              ) : (
                <p className="text-sm text-muted-foreground">Aucune information vendeur disponible.</p>
              )}
              <div className="mt-4">
                <Button asChild variant="outline" size="sm">
                  <Link to="/vendor">Accéder au portail vendeur <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Prochaines étapes recommandées</CardTitle>
            <CardDescription>Suivez ces actions pour tirer le meilleur parti de votre compte.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step, i) => {
              const StepIcon = step.icon;
              return (
                <div key={i} className="flex items-start gap-4 rounded-lg border p-4">
                  <div className={`rounded-full p-2 ${step.done ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {step.done ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{step.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                  {step.cta && (
                    <Button asChild size="sm" variant={step.cta.variant ?? "default"}>
                      <Link to={step.cta.to}>
                        {step.cta.label}
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
