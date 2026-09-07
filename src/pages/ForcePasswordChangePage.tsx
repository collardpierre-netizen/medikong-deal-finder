import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Lock } from "lucide-react";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";

export default function ForcePasswordChangePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Mot de passe trop court", description: "8 caractères minimum.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" });
      return;
    }
    setLoading(true);
    let { error } = await supabase.auth.updateUser({
      password,
      current_password: currentPassword,
    } as Parameters<typeof supabase.auth.updateUser>[0]);
    if (error && /current[_ ]password/i.test(error.message)) {
      const retry = await supabase.auth.updateUser({ password });
      error = retry.error;
    }
    if (error) {
      setLoading(false);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.auth.updateUser({ data: { must_change_password: false } });
    await supabase.auth.refreshSession();
    setLoading(false);
    toast({ title: "Mot de passe mis à jour", description: "Vous pouvez maintenant utiliser votre compte." });
    navigate("/compte", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <img src={logoDark} alt="MediKong" className="h-8 mx-auto" />
          <div>
            <CardTitle className="flex items-center justify-center gap-2">
              <Lock className="h-5 w-5" /> Définissez votre mot de passe
            </CardTitle>
            <CardDescription className="mt-2">
              Votre accès a été créé avec un mot de passe temporaire. Choisissez votre propre mot de passe pour continuer
              {user?.email ? ` (${user.email})` : ""}.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Mot de passe temporaire</Label>
              <Input
                id="current"
                type={show ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="new"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={show ? "Masquer" : "Afficher"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmez le nouveau mot de passe</Label>
              <Input
                id="confirm"
                type={show ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer et continuer"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => signOut()}>
              Se déconnecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
