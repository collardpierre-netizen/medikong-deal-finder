import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function VendorStripeSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const vendorId = searchParams.get("vendor_id");
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    if (!vendorId) return;
    const check = async () => {
      const { data } = await supabase.functions.invoke("stripe-connect-onboarding", {
        body: { action: "check-status", vendor_id: vendorId, origin: window.location.origin },
      });
      setStatus(data);
      setChecking(false);
    };
    check();
  }, [vendorId]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#1B5BDA" }} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-20 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ backgroundColor: "#ECFDF5" }}>
        <CheckCircle2 size={32} style={{ color: "#059669" }} />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "#1D2530" }}>
        {status?.onboarded ? "Configuration terminée ✅" : "Configuration en cours..."}
      </h1>
      <p className="text-sm mb-8" style={{ color: "#616B7C" }}>
        {status?.onboarded
          ? "Votre compte paiement est prêt. Vous pouvez maintenant recevoir des paiements pour vos ventes."
          : "Stripe vérifie vos informations. Cela peut prendre quelques minutes. Vous serez notifié dès que votre compte sera activé."
        }
      </p>
      <button
        onClick={() => navigate("/vendor")}
        className="px-8 py-3 rounded-lg text-sm font-bold text-white"
        style={{ backgroundColor: "#1B5BDA" }}
      >
        Retour au tableau de bord
      </button>
    </div>
  );
}
