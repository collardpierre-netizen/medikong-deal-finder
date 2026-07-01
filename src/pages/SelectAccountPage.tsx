import { useNavigate } from "react-router-dom";
import { useActiveAccount, type AccountKind } from "@/contexts/ActiveAccountContext";
import { Building2, Store, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";

function iconFor(kind: AccountKind) {
  if (kind === "vendor") return <Store size={20} />;
  if (kind === "admin") return <ShieldCheck size={20} />;
  return <Building2 size={20} />;
}

function landingFor(kind: AccountKind): string {
  if (kind === "vendor") return "/vendor";
  if (kind === "admin") return "/admin";
  return "/mon-compte";
}

export default function SelectAccountPage() {
  const { user, loading: authLoading } = useAuth();
  const { accounts, loading, setActive, activeKind, activeId } = useActiveAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/connexion", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!loading && accounts.length === 1) {
      const a = accounts[0];
      void setActive(a.kind, a.account_id).then(() => navigate(landingFor(a.kind), { replace: true }));
    }
  }, [loading, accounts, setActive, navigate]);

  const handlePick = async (kind: AccountKind, id: string) => {
    await setActive(kind, id);
    navigate(landingFor(kind), { replace: true });
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F1F5F9" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#1B5BDA" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F1F5F9" }}>
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <img src={logoDark} alt="MediKong.pro" className="h-10" />
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-xl font-bold text-center mb-1" style={{ color: "#1D2530" }}>Choisissez un compte</h1>
          <p className="text-sm text-center mb-6" style={{ color: "#8B95A5" }}>
            Votre email est rattaché à {accounts.length} comptes. Sélectionnez celui à utiliser.
          </p>

          <div className="space-y-2">
            {accounts.map((a) => {
              const isActive = activeKind === a.kind && activeId === a.account_id;
              return (
                <button
                  key={`${a.kind}:${a.account_id}`}
                  onClick={() => handlePick(a.kind, a.account_id)}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border transition-all hover:shadow-md text-left"
                  style={{
                    borderColor: isActive ? "#1B5BDA" : "#E2E8F0",
                    backgroundColor: isActive ? "rgba(27,91,218,0.05)" : "#FFF",
                  }}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                       style={{ backgroundColor: "rgba(27,91,218,0.1)", color: "#1B5BDA" }}>
                    {iconFor(a.kind)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "#1D2530" }}>{a.display_name}</div>
                    <div className="text-xs" style={{ color: "#64748B" }}>
                      {a.kind === "buyer" ? "Acheteur" : a.kind === "vendor" ? "Vendeur" : "Admin"}
                      {" · "}{a.role}
                      {a.status !== "active" && ` · ${a.status}`}
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: "#8B95A5" }} />
                </button>
              );
            })}
            {accounts.length === 0 && (
              <p className="text-center text-sm py-8" style={{ color: "#8B95A5" }}>
                Aucun compte trouvé pour cet utilisateur.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
