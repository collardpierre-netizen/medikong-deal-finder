import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Store, Eye, EyeOff } from "lucide-react";

export default function VendorLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check if this user is a vendor
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session introuvable");

      const { data: vendor } = await supabase
        .from("vendors")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!vendor) {
        await supabase.auth.signOut();
        toast.error("Ce compte n'est pas associé à un vendeur");
        return;
      }

      toast.success("Connexion réussie");
      navigate("/vendor");
    } catch (err: any) {
      toast.error(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F1F5F9" }}>
      <div className="w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: "#1B5BDA" }}>
              <Store size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold" style={{ color: "#1D2530" }}>Espace Vendeur</h1>
            <p className="text-sm mt-1" style={{ color: "#8B95A5" }}>Connectez-vous à votre tableau de bord</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label className="text-xs font-medium" style={{ color: "#616B7C" }}>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendeur@exemple.com"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-medium" style={{ color: "#616B7C" }}>Mot de passe</Label>
              <div className="relative mt-1">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#8B95A5" }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full" style={{ backgroundColor: "#1B5BDA" }}>
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <a href="/mot-de-passe-oublie" className="text-xs hover:underline" style={{ color: "#1B5BDA" }}>
              Mot de passe oublié ?
            </a>
          </div>

          <div className="mt-4 pt-4 text-center" style={{ borderTop: "1px solid #E2E8F0" }}>
            <p className="text-xs" style={{ color: "#8B95A5" }}>
              Pas encore vendeur ?{" "}
              <a href="/onboarding?role=seller" className="font-semibold hover:underline" style={{ color: "#1B5BDA" }}>
                Inscrivez-vous
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
