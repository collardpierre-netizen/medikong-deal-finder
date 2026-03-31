import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setEmailNotConfirmed(false);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      if (error.message?.toLowerCase().includes("email not confirmed") || error.message?.toLowerCase().includes("email_not_confirmed")) {
        setEmailNotConfirmed(true);
      } else {
        toast({ title: "Erreur de connexion", description: error.message, variant: "destructive" });
      }
    } else {
      navigate("/compte");
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await supabase.auth.resend({ type: 'signup', email });
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (e) { console.error(e); }
    setResending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-mk-alt">
      <div className="w-full max-w-[400px] p-8">
        <div className="text-center mb-8">
          <Link to="/" className="flex items-center justify-center mb-4">
            <img src={logoDark} alt="MediKong.pro" className="h-16" />
          </Link>
          <h1 className="text-xl font-bold text-mk-navy">Connectez-vous a votre compte</h1>
        </div>

        {emailNotConfirmed && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <Mail size={18} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">Email non confirmé</p>
                <p className="text-xs text-amber-700 mb-2">
                  Vous devez confirmer votre adresse email avant de pouvoir vous connecter. Vérifiez votre boîte de réception et vos spams.
                </p>
                <button
                  onClick={handleResend}
                  disabled={resending || resent}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline disabled:opacity-50"
                >
                  {resent ? "✓ Email renvoyé !" : resending ? "Envoi..." : "Renvoyer l'email de confirmation"}
                </button>
                <p className="text-[11px] text-amber-600 mt-2">
                  Problème ? Contactez <a href="mailto:support@medikong.pro" className="underline font-medium">support@medikong.pro</a>
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-mk-sec mb-1 block">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-mk-sec">Mot de passe</label>
              <Link to="/mot-de-passe-oublie" className="text-xs text-mk-blue">Mot de passe oublié ?</Link>
            </div>
            <div className="relative">
              <input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-mk-sec hover:text-mk-navy transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button disabled={loading} className="w-full bg-mk-navy text-white font-bold py-3 rounded-md text-sm disabled:opacity-50">
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-mk-line" /><span className="text-xs text-mk-ter">ou</span><div className="flex-1 h-px bg-mk-line" />
        </div>

        <Link to="/inscription" className="block w-full text-center border border-mk-navy text-mk-navy font-bold py-3 rounded-md text-sm">
          Creer un compte professionnel
        </Link>

        <div className="mt-6 bg-mk-deal rounded-lg p-4">
          <p className="text-xs text-mk-green font-medium">Plateforme B2B réservée aux professionnels</p>
          <p className="text-xs text-mk-sec mt-1">Données sécurisées et conformes RGPD</p>
        </div>
      </div>
    </div>
  );
}
