import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CreditCard, CheckCircle2, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function VendorStripeOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [stripeStatus, setStripeStatus] = useState<{
    onboarded: boolean;
    charges_enabled: boolean;
    payouts_enabled: boolean;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    loadVendorAndStatus();
  }, [user]);

  const loadVendorAndStatus = async () => {
    setCheckingStatus(true);
    const { data: v } = await supabase
      .from("vendors")
      .select("id, name, stripe_account_id, stripe_onboarding_complete")
      .eq("auth_user_id", user!.id)
      .maybeSingle();

    if (!v) {
      setCheckingStatus(false);
      return;
    }

    setVendor(v);

    if (v.stripe_account_id) {
      const { data } = await supabase.functions.invoke("stripe-connect-onboarding", {
        body: { action: "check-status", vendor_id: v.id, origin: window.location.origin },
      });
      if (data) setStripeStatus(data);
    }

    setCheckingStatus(false);
  };

  const handleStartOnboarding = async () => {
    if (!vendor) return;
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("stripe-connect-onboarding", {
      body: {
        action: "create-account",
        vendor_id: vendor.id,
        origin: window.location.origin,
      },
    });

    if (error || !data?.url) {
      toast.error("Erreur lors de la création du compte paiement");
      setLoading(false);
      return;
    }

    window.location.href = data.url;
  };

  if (checkingStatus) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#1B5BDA" }} />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: "#D97706" }} />
        <h1 className="text-xl font-bold mb-2" style={{ color: "#1D2530" }}>Compte vendeur introuvable</h1>
        <p className="text-sm" style={{ color: "#616B7C" }}>Vous devez être connecté en tant que vendeur.</p>
      </div>
    );
  }

  if (stripeStatus?.onboarded) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ backgroundColor: "#ECFDF5" }}>
          <CheckCircle2 size={32} style={{ color: "#059669" }} />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#1D2530" }}>Paiements configurés ✅</h1>
        <p className="text-sm mb-6" style={{ color: "#616B7C" }}>
          Votre compte paiement est opérationnel. Vous pouvez recevoir des paiements et effectuer des virements.
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 size={16} style={{ color: "#059669" }} />
            <span>Paiements par carte : activés</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 size={16} style={{ color: "#059669" }} />
            <span>Virements bancaires : activés</span>
          </div>
        </div>
        <button
          onClick={() => navigate("/vendor")}
          className="mt-8 px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: "#1B5BDA" }}
        >
          Retour au tableau de bord
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-20 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ backgroundColor: "#EFF6FF" }}>
        <CreditCard size={32} style={{ color: "#1B5BDA" }} />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "#1D2530" }}>Configurer vos paiements</h1>
      <p className="text-sm mb-8" style={{ color: "#616B7C" }}>
        Pour recevoir les paiements de vos ventes sur MediKong, vous devez configurer votre compte paiement via notre partenaire sécurisé Stripe.
      </p>

      <div className="bg-white rounded-xl border p-6 mb-6 text-left" style={{ borderColor: "#E2E8F0" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "#1D2530" }}>Ce que vous devrez fournir :</h3>
        <ul className="space-y-2 text-sm" style={{ color: "#616B7C" }}>
          <li>• Informations de l'entreprise (nom, adresse, TVA)</li>
          <li>• Coordonnées du représentant légal</li>
          <li>• Coordonnées bancaires (IBAN)</li>
          <li>• Document d'identité du représentant</li>
        </ul>
      </div>

      <button
        onClick={handleStartOnboarding}
        disabled={loading}
        className="w-full py-3 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: "#1B5BDA", boxShadow: "0 4px 14px rgba(27,91,218,0.3)" }}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Création en cours...
          </>
        ) : (
          <>
            <ExternalLink size={16} />
            Configurer mes paiements
          </>
        )}
      </button>

      <p className="mt-4 text-xs" style={{ color: "#8B95A5" }}>
        Vous serez redirigé vers Stripe pour compléter la configuration. Processus sécurisé et confidentiel.
      </p>
    </div>
  );
}
