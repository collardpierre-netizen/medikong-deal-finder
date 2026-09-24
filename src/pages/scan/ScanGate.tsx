import { SCAN_BASENAME } from "@/config/surface";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import { Loader2, ScanLine, PackageX, ShoppingCart, User, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchScanAccess, type ScanCustomer } from "@/lib/scanner/api";

const ScanCtx = createContext<ScanCustomer | null>(null);
export const useScanCustomer = () => useContext(ScanCtx)!;

function Center({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">{children}</main>;
}

function Brand() {
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold text-scan-emerald">MediKong</div>
      <h1 className="text-3xl font-extrabold">Scan</h1>
    </div>
  );
}

/** Connexion par lien magique e-mail (session longue, stockée sur l'origine scan). */
function MagicLinkLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + (SCAN_BASENAME ?? ""), shouldCreateUser: false },
    });
    setBusy(false);
    if (error) { toast.error("Envoi impossible. Vérifiez l'adresse e-mail."); return; }
    setSent(true);
  };
  return (
    <Center>
      <Brand />
      {sent ? (
        <div className="rounded-xl border bg-card p-5 space-y-2">
          <Mail className="h-6 w-6 text-scan-emerald" />
          <p className="font-semibold">Vérifiez votre boîte mail</p>
          <p className="text-sm text-muted-foreground">Un lien de connexion a été envoyé à {email}. Ouvrez-le sur ce téléphone.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-muted-foreground">Recevez un lien de connexion par e-mail.</p>
          <Input type="email" required autoComplete="email" placeholder="vous@pharmacie.be" value={email}
            onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
          <Button type="submit" className="scan-tap h-12 w-full text-base" disabled={busy}>
            {busy ? "Envoi…" : "Recevoir le lien"}
          </Button>
        </form>
      )}
    </Center>
  );
}

function BottomBar() {
  const { cartCount } = useCart();
  const item = (to: string, label: string, Icon: any, soon = false, badge?: number) => (
    <NavLink to={to} end className={({ isActive }) =>
      `scan-tap relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs ${isActive ? "text-scan-emerald font-semibold" : "text-muted-foreground"}`}>
      <Icon className="h-6 w-6" />
      <span>{label}{soon ? " · bientôt" : ""}</span>
      {!!badge && <span className="absolute right-1/4 top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{badge}</span>}
    </NavLink>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card pb-[env(safe-area-inset-bottom)]">
      {item("/", "Scanner", ScanLine)}
      {item("/ruptures", "Ruptures", PackageX, true)}
      {item("/panier", "Panier", ShoppingCart, false, cartCount)}
      {item("/moi", "Moi", User, true)}
    </nav>
  );
}

/** Accès Scan = interrupteur site ET interrupteur officine. Sinon : « Accès sur invitation ». */
export default function ScanGate({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["scan-access", user?.id],
    enabled: !!user,
    queryFn: () => fetchScanAccess(user!.id),
    staleTime: 5 * 60_000,
  });

  if (loading || (user && isLoading)) {
    return <Center><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></Center>;
  }
  if (!user) return <MagicLinkLogin />;
  if (!data?.allowed || !data.customer) {
    return (
      <Center>
        <Brand />
        <div className="rounded-xl border bg-card p-5 space-y-2">
          <Lock className="h-6 w-6 text-muted-foreground" />
          <p className="font-semibold">Accès sur invitation</p>
          <p className="text-sm text-muted-foreground">MediKong Scan est en test auprès de quelques officines.</p>
        </div>
        <Button variant="outline" className="scan-tap" onClick={() => signOut()}>Se déconnecter</Button>
      </Center>
    );
  }
  return (
    <ScanCtx.Provider value={data.customer}>
      <div className="mx-auto max-w-md pb-24">{children}</div>
      <BottomBar />
    </ScanCtx.Provider>
  );
}
