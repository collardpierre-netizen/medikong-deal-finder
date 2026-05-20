import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, AlertTriangle, UserX, ArrowRight, Store, ShoppingCart, FileCheck, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  cta?: { label: string; to: string; variant?: "default" | "outline" };
  done?: boolean;
};

export default function BuyerStatusPage() {
  const { user, buyerStatus, hasVendorAccount, verificationLoading } = useAuth();

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
              { icon: ShoppingCart, title: "Activer votre compte acheteur", description: "Complétez l'onboarding acheteur pour acheter en plus de vendre.", cta: { label: "Activer mon compte acheteur", to: "/onboarding?role=buyer" } },
              { icon: Store, title: "Retour au portail vendeur", description: "Continuer la gestion de votre catalogue et de vos commandes.", cta: { label: "Aller au portail vendeur", to: "/vendor", variant: "outline" } },
            ]
          : [
              { icon: FileCheck, title: "Créer votre profil acheteur", description: "Renseignez votre raison sociale, numéro de TVA et coordonnées.", cta: { label: "Créer mon profil acheteur", to: "/onboarding?role=buyer" } },
            ];
      case "pending":
        return [
          { icon: Clock, title: "Validation en cours", description: "Notre équipe vérifie vos pièces sous 24-48 h ouvrées.", done: true },
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

        {hasVendorAccount && buyerStatus !== "anonymous" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compte vendeur détecté</CardTitle>
              <CardDescription>Vous disposez également d'un portail vendeur actif.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link to="/vendor">Accéder au portail vendeur <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
