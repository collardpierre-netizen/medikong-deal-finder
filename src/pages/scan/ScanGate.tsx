import { SCAN_BASENAME } from "@/config/surface";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import { Loader2, ScanLine, PackageX, ShoppingCart, User, Lock, Mail, type LucideIcon } from "lucide-react";
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
  const item = (to: string, label: string, Icon: LucideIcon, soon = false, badge?: number) => {
    const content = (
      <>
        <span className="relative flex h-6 w-6 items-center justify-center">
          <Icon className="h-6 w-6" />
          {soon && (
            <span className="absolute -right-5 -top-2 whitespace-nowrap rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium leading-none text-muted-foreground">
              bientôt
            </span>
          )}
          {!!badge && (
            <span className="absolute -right-3 -top-2 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground">
              {badge}
            </span>
          )}
        </span>
        <span className="whitespace-nowrap text-center text-xs leading-none">{label}</span>
      </>
    );

    if (soon) {
      return (
        <Button
          type="button"
          variant="ghost"
          className="scan-tap h-auto min-h-11 w-full flex-col gap-1 rounded-none px-0 py-2 font-normal text-muted-foreground/60 hover:bg-muted/50 hover:text-muted-foreground"
          onClick={() => toast.info("Disponible prochainement")}
          aria-label={`${label} — bientôt disponible`}
        >
          {content}
        </Button>
      );
    }

    return (
      <NavLink
        to={to}
        end
        className={({ isActive }) =>
          `scan-tap flex min-h-11 w-full flex-col items-center justify-center gap-1 px-0 py-2 ${isActive ? "font-semibold text-scan-emerald" : "text-muted-foreground"}`
        }
      >
        {content}
      </NavLink>
    );
  };
  return (
    <nav
      aria-label="Navigation Scan"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto grid w-full max-w-md grid-cols-4 border-t bg-card pb-[calc(env(safe-area-inset-bottom)+8px)]"
    >
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
