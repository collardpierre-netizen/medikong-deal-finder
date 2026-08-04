// Layout du portail apporteur : gating par rôle + statut, header simple.
import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAffiliateAccount } from "@/hooks/useAffiliateAccount";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AFFILIATE_STATUS_LABELS } from "@/lib/affiliate-format";
import { Handshake, LayoutDashboard, Link2, Users, Percent, Wallet, LogOut, Eye } from "lucide-react";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";

const NAV = [
  { to: "/apporteur", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/apporteur/liens", label: "Mes liens", icon: Link2 },
  { to: "/apporteur/clients", label: "Mes clients", icon: Users },
  { to: "/apporteur/commissions", label: "Mes commissions", icon: Percent },
  { to: "/apporteur/payouts", label: "Payouts", icon: Wallet },
];

export default function AffiliateLayout() {
  const { user, loading: authLoading } = useAuth();
  const { account, impersonating, loading } = useAffiliateAccount();
  const navigate = useNavigate();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Handshake className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/connexion" replace />;

  // Ni apporteur, ni admin en "Voir comme" → pas d'accès au portail.
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 space-y-3 text-center">
            <Handshake className="h-8 w-8 mx-auto text-muted-foreground" />
            <h1 className="text-lg font-semibold">Espace apporteurs d'affaires</h1>
            <p className="text-sm text-muted-foreground">
              Ce compte n'est pas rattaché à un apporteur d'affaires MediKong.
            </p>
            <Button variant="outline" onClick={() => navigate("/")}>Retour à l'accueil</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const suspendedCopy: Record<string, string> = {
    invited: "Votre compte apporteur est créé mais pas encore activé. Cliquez sur le lien d'invitation reçu par email pour finaliser l'activation.",
    suspended: "Votre compte apporteur est temporairement suspendu. L'attribution de nouveaux clients et le calcul de nouvelles commissions sont à l'arrêt. Contactez MediKong pour en savoir plus.",
    terminated: "Votre compte apporteur a été résilié. Vos commissions déjà validées restent dues et payables.",
  };

  // Gating strict : aucune donnée n'est chargée hors statut actif.
  if (account.status !== "active" && !impersonating) {
    const info = AFFILIATE_STATUS_LABELS[account.status];
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 space-y-4 text-center">
            <Handshake className="h-8 w-8 mx-auto text-primary" />
            <h1 className="text-lg font-semibold">Compte {info?.label.toLowerCase() ?? account.status}</h1>
            <p className="text-sm text-muted-foreground">{suspendedCopy[account.status]}</p>
            <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate("/connexion"); }}>
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {impersonating && (
        <div className="bg-amber-100 text-amber-900 text-sm px-4 py-2 flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Vue apporteur : <strong>{account.display_name}</strong> — lecture seule (session admin).
        </div>
      )}
      <header className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logoDark} alt="MediKong" className="h-8" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{account.display_name}</p>
              <p className="text-xs text-muted-foreground">Apporteur {account.affiliate_code}</p>
            </div>
          </div>
          {!impersonating && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await supabase.auth.signOut(); navigate("/connexion"); }}
            >
              <LogOut className="h-4 w-4 mr-1" /> Déconnexion
            </Button>
          )}
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={impersonating ? `${item.to}?as=${account.id}` : item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2.5 text-sm border-b-2 whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
