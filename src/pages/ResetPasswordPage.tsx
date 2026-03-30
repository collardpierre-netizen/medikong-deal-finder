import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [validToken, setValidToken] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setValidToken(true);
    }

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setValidToken(true);
      }
    });

    // Also check if user is already logged in via recovery (race condition fix)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && hash) {
        setValidToken(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 6 caractères.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setDone(true);
      setTimeout(() => navigate("/connexion"), 3000);
    }
  };

  if (!validToken && !done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mk-alt">
        <div className="w-full max-w-[400px] p-8 text-center">
          <Link to="/" className="flex items-center justify-center mb-4">
            <span className="text-mk-navy font-bold text-2xl">MediKong</span>
            <span className="text-mk-blue font-bold text-2xl">.pro</span>
          </Link>
          <h1 className="text-xl font-bold text-mk-navy mb-2">Lien invalide</h1>
          <p className="text-sm text-mk-sec mb-4">Ce lien de réinitialisation est invalide ou a expiré.</p>
          <Link to="/mot-de-passe-oublie" className="text-sm text-mk-blue font-medium">Demander un nouveau lien</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mk-alt">
      <div className="w-full max-w-[400px] p-8">
        <div className="text-center mb-8">
          <Link to="/" className="flex items-center justify-center mb-4">
            <span className="text-mk-navy font-bold text-2xl">MediKong</span>
            <span className="text-mk-blue font-bold text-2xl">.pro</span>
          </Link>
          <h1 className="text-xl font-bold text-mk-navy">Nouveau mot de passe</h1>
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-mk-navy">Mot de passe modifié !</h2>
            <p className="text-sm text-mk-sec">Redirection vers la connexion...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-mk-sec mb-1 block">Nouveau mot de passe</label>
              <div className="relative">
                <input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required
                  className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm pr-10 pl-10" />
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mk-sec" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-mk-sec hover:text-mk-navy transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-mk-sec mb-1 block">Confirmer le mot de passe</label>
              <div className="relative">
                <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type={showPassword ? "text" : "password"} required
                  className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm pl-10" />
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mk-sec" />
              </div>
            </div>
            <button disabled={loading} className="w-full bg-mk-navy text-white font-bold py-3 rounded-md text-sm disabled:opacity-50">
              {loading ? "Modification..." : "Modifier le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
