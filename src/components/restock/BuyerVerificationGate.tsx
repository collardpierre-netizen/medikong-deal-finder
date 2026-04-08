import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface BuyerVerificationGateProps {
  children: React.ReactNode;
}

export function BuyerVerificationGate({ children }: BuyerVerificationGateProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: buyer, isLoading } = useQuery({
    queryKey: ["restock-buyer-status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("restock_buyers")
        .select("id, verified_status, pharmacy_name")
.eq("auth_user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Not logged in
  if (!user) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 text-center">
        <Shield size={48} className="mx-auto mb-4 text-[#1C58D9] opacity-50" />
        <h2 className="text-xl font-bold text-[#1E252F] mb-2">Connexion requise</h2>
        <p className="text-sm text-[#5C6470] mb-4">
          Connectez-vous pour accéder aux opportunités ReStock.
        </p>
        <Button onClick={() => navigate("/login")} className="bg-[#1C58D9] hover:bg-[#1549B8] text-white">
          Se connecter
        </Button>
      </div>
    );
  }

  if (isLoading) return null;

  // Not registered as buyer
  if (!buyer) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 text-center">
        <Shield size={48} className="mx-auto mb-4 text-[#F59E0B] opacity-50" />
        <h2 className="text-xl font-bold text-[#1E252F] mb-2">Inscription acheteur requise</h2>
        <p className="text-sm text-[#5C6470] mb-4">
          Pour accéder aux offres ReStock, inscrivez-vous en tant qu'acheteur pharmacien.
        </p>
        <Button onClick={() => navigate("/restock")} className="bg-[#1C58D9] hover:bg-[#1549B8] text-white">
          S'inscrire
        </Button>
      </div>
    );
  }

  // Pending verification
  if (buyer.verified_status === "pending") {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 text-center">
        <Clock size={48} className="mx-auto mb-4 text-[#F59E0B] opacity-50" />
        <h2 className="text-xl font-bold text-[#1E252F] mb-2">Vérification en cours</h2>
        <p className="text-sm text-[#5C6470] mb-4">
          Votre demande d'accès est en cours de vérification par l'équipe MediKong.
          Vous serez notifié dès validation.
        </p>
        <div className="bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-xl p-4 text-sm text-[#92400E]">
          <AlertTriangle size={16} className="inline mr-2" />
          Vous pouvez consulter les offres mais pas encore acheter.
        </div>
      </div>
    );
  }

  // Rejected
  if (buyer.verified_status === "rejected") {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 text-center">
        <AlertTriangle size={48} className="mx-auto mb-4 text-[#E54545] opacity-50" />
        <h2 className="text-xl font-bold text-[#1E252F] mb-2">Accès refusé</h2>
        <p className="text-sm text-[#5C6470] mb-4">
          Votre demande d'accès a été refusée. Contactez l'équipe MediKong pour plus d'informations.
        </p>
      </div>
    );
  }

  // Verified — allow through (also allow if verified_status is null for backwards compat)
  return <>{children}</>;
}

export function useIsVerifiedBuyer() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["restock-buyer-verified", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("restock_buyers")
        .select("verified_status")
.eq("auth_user_id", user!.id)
        .maybeSingle();
      return data?.verified_status === "approved" || data?.verified_status === null;
    },
  });

  return { isVerified: !!data, isLoading };
}
