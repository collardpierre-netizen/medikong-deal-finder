import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdminUser } from "@/lib/admin-access";
import { Shield, Lock, Mail, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError, user: signedInUser } = await signIn(email, password);

      if (signInError) {
        setError("Email ou mot de passe incorrect.");
        return;
      }

      if (!signedInUser) {
        setError("Erreur d'authentification.");
        return;
      }

      const isAdmin = await checkIsAdminUser(signedInUser.id);

      if (!isAdmin) {
        await supabase.auth.signOut();
        setError("Accès refusé. Ce compte n'a pas les droits administrateur.");
        return;
      }

      navigate("/admin", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "La connexion admin a échoué.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0F172A", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-full max-w-[420px] p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ backgroundColor: "rgba(27, 91, 218, 0.15)" }}>
            <Shield size={28} style={{ color: "#3B82F6" }} />
          </div>
          <h1 className="text-[22px] font-bold text-white mb-1">Administration MediKong</h1>
          <p className="text-[13px]" style={{ color: "#8B95A5" }}>Accès réservé aux administrateurs</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg mb-5" style={{ backgroundColor: "rgba(239, 67, 67, 0.1)", border: "1px solid rgba(239, 67, 67, 0.3)" }}>
            <AlertCircle size={16} style={{ color: "#EF4343" }} className="shrink-0" />
            <span className="text-[12px]" style={{ color: "#FCA5A5" }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#64748B" }}>Email</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Mail size={15} style={{ color: "#64748B" }} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="admin@medikong.pro"
                className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-gray-600" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#64748B" }}>Mot de passe</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Lock size={15} style={{ color: "#64748B" }} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required placeholder="••••••••"
                className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-gray-600" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="transition-colors" style={{ color: "#64748B" }}>
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button disabled={loading} type="submit"
            className="w-full py-3 rounded-lg text-[13px] font-bold text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: "#1B5BDA", boxShadow: "0 4px 14px rgba(27, 91, 218, 0.4)" }}>
            {loading ? "Vérification..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-[12px] font-medium" style={{ color: "#64748B" }}>
            ← Retour au site
          </Link>
        </div>

        <div className="mt-8 p-3 rounded-lg text-center" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[10px]" style={{ color: "#475569" }}>Connexion sécurisée • Session chiffrée • Logs d'audit activés</p>
        </div>
      </div>
    </div>
  );
}
