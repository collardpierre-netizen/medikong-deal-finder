import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "loading" | "no_vendor" | "no_session" | "error" | "redirecting";

export default function VendorStripeRefreshPage() {
  const [searchParams] = useSearchParams();
  const vendorId = searchParams.get("vendor_id");
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = async () => {
    setStatus("loading");
    setErrorMessage(null);

    if (!vendorId) {
      setStatus("no_vendor");
      return;
    }

    try {
      // Vérifie qu'on a bien une session (sinon l'edge function renverra 401
      // et la page resterait coincée sur un spinner sans feedback).
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        setStatus("no_session");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "stripe-connect-onboarding",
        {
          body: {
            action: "refresh-link",
            vendor_id: vendorId,
            origin: window.location.origin,
          },
        },
      );

      if (error) throw error;
      if (!data?.url) {
        throw new Error("Lien Stripe introuvable dans la réponse.");
      }

      setStatus("redirecting");
      window.location.href = data.url as string;
    } catch (err) {
      console.error("[VendorStripeRefreshPage] refresh-link failed", err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  useEffect(() => {
    refresh();
    // Filet de sécurité : si on est encore en "loading" après 15s, on bascule
    // en erreur pour ne jamais laisser le vendeur sur un spinner infini.
    const timeout = window.setTimeout(() => {
      setStatus((prev) => {
        if (prev === "loading") {
          setErrorMessage(
            "La regénération du lien prend trop de temps. Réessayez ou contactez le support.",
          );
          return "error";
        }
        return prev;
      });
    }, 15000);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  if (status === "loading" || status === "redirecting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#1B5BDA" }} />
        <p className="text-sm" style={{ color: "#616B7C" }}>
          {status === "redirecting"
            ? "Redirection vers Stripe…"
            : "Régénération du lien de configuration…"}
        </p>
      </div>
    );
  }

  if (status === "no_vendor") {
    return (
      <FallbackCard
        title="Lien incomplet"
        description="Ce lien ne contient pas d'identifiant vendeur. Contactez votre référent MediKong pour recevoir un nouveau lien."
      />
    );
  }

  if (status === "no_session") {
    const next = encodeURIComponent(
      `/vendor/stripe-onboarding/refresh?vendor_id=${vendorId ?? ""}`,
    );
    return (
      <FallbackCard
        title="Connexion requise"
        description="Pour regénérer votre lien Stripe, connectez-vous d'abord à votre espace vendeur MediKong. Vous serez ensuite redirigé automatiquement."
        action={
          <Button asChild style={{ backgroundColor: "#1B5BDA" }}>
            <Link to={`/vendor/login?next=${next}`}>Se connecter</Link>
          </Button>
        }
      />
    );
  }

  // status === "error"
  return (
    <FallbackCard
      title="Lien indisponible"
      description={
        errorMessage ||
        "Impossible de regénérer le lien Stripe pour le moment."
      }
      action={
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={refresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
          <Button asChild style={{ backgroundColor: "#1B5BDA" }}>
            <a href="mailto:support@medikong.pro?subject=Probl%C3%A8me%20onboarding%20Stripe">
              Contacter le support
            </a>
          </Button>
        </div>
      }
    />
  );
}

function FallbackCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-border p-6 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center bg-amber-50">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold" style={{ color: "#1D2530" }}>
            {title}
          </h1>
          <p className="text-sm" style={{ color: "#616B7C" }}>
            {description}
          </p>
        </div>
        {action && <div className="flex justify-center pt-2">{action}</div>}
      </div>
    </div>
  );
}
