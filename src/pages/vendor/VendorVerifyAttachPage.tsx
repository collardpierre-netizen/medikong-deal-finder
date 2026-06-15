import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type State =
  | { kind: "verifying" }
  | { kind: "success"; loginEmail: string; companyName?: string | null; recoveryUrl?: string | null }
  | { kind: "expired" }
  | { kind: "already_used" }
  | { kind: "vendor_already_attached" }
  | { kind: "email_conflict" }
  | { kind: "invalid" }
  | { kind: "error"; message: string };

export default function VendorVerifyAttachPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>({ kind: "verifying" });
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    if (!token || token.length < 32) {
      setState({ kind: "invalid" });
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-vendor-attach", {
          body: { token },
        });
        if (error) {
          setState({ kind: "error", message: error.message ?? "Erreur réseau" });
          return;
        }
        if (data?.ok) {
          setState({
            kind: "success",
            loginEmail: data.login_email,
            companyName: data.company_name,
            recoveryUrl: data.recovery_url,
          });
          return;
        }
        const code = data?.code as string | undefined;
        if (code === "expired") setState({ kind: "expired" });
        else if (code === "already_consumed") setState({ kind: "already_used" });
        else if (code === "vendor_already_attached") setState({ kind: "vendor_already_attached" });
        else if (code === "email_conflict") setState({ kind: "email_conflict" });
        else if (code === "not_found" || code === "invalid_token") setState({ kind: "invalid" });
        else setState({ kind: "error", message: data?.error ?? "Erreur inconnue" });
      } catch (e: any) {
        setState({ kind: "error", message: e?.message ?? "Erreur inattendue" });
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Helmet>
        <title>Vérification accès vendeur · MediKong</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        {state.kind === "verifying" && (
          <div className="flex flex-col items-center text-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-mk-blue" />
            <h1 className="text-lg font-semibold text-slate-900">Vérification en cours…</h1>
            <p className="text-sm text-slate-600">Nous activons votre accès au portail vendeur.</p>
          </div>
        )}

        {state.kind === "success" && (
          <div className="flex flex-col items-center text-center gap-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <h1 className="text-xl font-semibold text-slate-900">Accès activé</h1>
            <p className="text-sm text-slate-600">
              Votre accès au portail vendeur{state.companyName ? ` pour « ${state.companyName} »` : ""} est désormais
              actif sur <span className="font-medium text-slate-900">{state.loginEmail}</span>.
            </p>
            <div className="w-full flex flex-col gap-2 pt-2">
              {state.recoveryUrl ? (
                <Button asChild className="w-full">
                  <a href={state.recoveryUrl}>Définir mon mot de passe</a>
                </Button>
              ) : null}
              <Button asChild variant="outline" className="w-full">
                <Link to="/vendor/login">Aller à la connexion</Link>
              </Button>
            </div>
          </div>
        )}

        {state.kind === "expired" && (
          <ResultBlock
            icon={<AlertTriangle className="w-12 h-12 text-amber-500" />}
            title="Lien expiré"
            message="Ce lien de vérification a expiré (validité 24 heures). Contactez l'administrateur MediKong qui a configuré votre accès pour en recevoir un nouveau."
          />
        )}
        {state.kind === "already_used" && (
          <ResultBlock
            icon={<CheckCircle2 className="w-12 h-12 text-slate-400" />}
            title="Lien déjà utilisé"
            message="Ce lien a déjà été utilisé. Si l'accès a été activé, vous pouvez vous connecter directement."
            cta={{ label: "Aller à la connexion", to: "/vendor/login" }}
          />
        )}
        {state.kind === "vendor_already_attached" && (
          <ResultBlock
            icon={<AlertTriangle className="w-12 h-12 text-amber-500" />}
            title="Vendeur déjà rattaché"
            message="Ce vendeur est déjà rattaché à un autre compte. Contactez l'administrateur MediKong si vous pensez qu'il s'agit d'une erreur."
          />
        )}
        {state.kind === "email_conflict" && (
          <ResultBlock
            icon={<XCircle className="w-12 h-12 text-red-500" />}
            title="Conflit d'email"
            message="Cet email est désormais rattaché à un autre vendeur. Contactez l'administrateur MediKong."
          />
        )}
        {state.kind === "invalid" && (
          <ResultBlock
            icon={<XCircle className="w-12 h-12 text-red-500" />}
            title="Lien invalide"
            message="Ce lien de vérification n'est pas valide. Assurez-vous d'avoir copié l'URL complète depuis l'email reçu."
          />
        )}
        {state.kind === "error" && (
          <ResultBlock
            icon={<XCircle className="w-12 h-12 text-red-500" />}
            title="Erreur technique"
            message={state.message}
          />
        )}
      </div>
    </div>
  );
}

function ResultBlock({
  icon,
  title,
  message,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  cta?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-col items-center text-center gap-4">
      {icon}
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-600">{message}</p>
      {cta && (
        <Button asChild variant="outline" className="w-full">
          <Link to={cta.to}>{cta.label}</Link>
        </Button>
      )}
    </div>
  );
}
