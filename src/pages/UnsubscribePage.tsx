import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid === false && data.reason === "already_unsubscribed") setStatus("already");
        else if (data.valid) setStatus("valid");
        else setStatus("invalid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const handleUnsubscribe = async () => {
    setStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) setStatus("success");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <Layout>
      <div className="mk-container py-20 text-center max-w-md mx-auto">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-mk-blue" />
            <p className="text-mk-sec">Vérification en cours…</p>
          </div>
        )}

        {status === "valid" && (
          <div className="flex flex-col items-center gap-5">
            <MailX className="w-12 h-12 text-mk-navy" />
            <h1 className="text-2xl font-bold text-mk-navy">Se désabonner</h1>
            <p className="text-mk-sec text-sm">
              Vous ne recevrez plus d'emails de notre part. Êtes-vous sûr ?
            </p>
            <Button onClick={handleUnsubscribe} className="bg-mk-navy hover:bg-mk-navy/90 text-white">
              Confirmer le désabonnement
            </Button>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="w-12 h-12 text-mk-green" />
            <h1 className="text-2xl font-bold text-mk-navy">Désabonnement confirmé</h1>
            <p className="text-mk-sec text-sm">Vous ne recevrez plus nos emails.</p>
          </div>
        )}

        {status === "already" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="w-12 h-12 text-mk-sec" />
            <h1 className="text-2xl font-bold text-mk-navy">Déjà désabonné</h1>
            <p className="text-mk-sec text-sm">Vous êtes déjà désabonné de nos emails.</p>
          </div>
        )}

        {status === "invalid" && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-12 h-12 text-mk-red" />
            <h1 className="text-2xl font-bold text-mk-navy">Lien invalide</h1>
            <p className="text-mk-sec text-sm">Ce lien de désabonnement est invalide ou expiré.</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-12 h-12 text-mk-red" />
            <h1 className="text-2xl font-bold text-mk-navy">Erreur</h1>
            <p className="text-mk-sec text-sm">Une erreur est survenue. Veuillez réessayer.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
