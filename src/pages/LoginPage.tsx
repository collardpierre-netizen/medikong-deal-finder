import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: "Erreur de connexion", description: error.message, variant: "destructive" });
    } else {
      navigate("/compte");
    }
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
