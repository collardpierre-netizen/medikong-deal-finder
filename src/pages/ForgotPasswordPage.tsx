import { Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-mk-alt">
      <div className="w-full max-w-[400px] p-8">
        <div className="text-center mb-8">
          <Link to="/" className="flex items-center justify-center mb-4">
            <span className="text-mk-navy font-bold text-2xl">MediKong</span>
            <span className="text-mk-blue font-bold text-2xl">.pro</span>
          </Link>
          <h1 className="text-xl font-bold text-mk-navy">Mot de passe oublié</h1>
          <p className="text-sm text-mk-sec mt-2">Entrez votre email pour recevoir un lien de réinitialisation.</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-mk-navy">Email envoyé !</h2>
            <p className="text-sm text-mk-sec">
              Si un compte existe avec l'adresse <strong>{email}</strong>, vous recevrez un lien de réinitialisation.
            </p>
            <Link to="/connexion" className="inline-flex items-center gap-2 text-sm text-mk-blue font-medium mt-4">
              <ArrowLeft size={14} /> Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-mk-sec mb-1 block">Email</label>
              <div className="relative">
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" required
                  className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm pl-10" placeholder="votre@email.com" />
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mk-sec" />
              </div>
            </div>
            <button disabled={loading} className="w-full bg-mk-navy text-white font-bold py-3 rounded-md text-sm disabled:opacity-50">
              {loading ? "Envoi..." : "Envoyer le lien"}
            </button>
            <Link to="/connexion" className="flex items-center justify-center gap-2 text-sm text-mk-sec hover:text-mk-navy transition-colors mt-2">
              <ArrowLeft size={14} /> Retour à la connexion
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
