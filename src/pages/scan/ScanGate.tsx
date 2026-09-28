import { SCAN_BASENAME } from "@/config/surface";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import { Loader2, ScanLine, ShoppingCart, User, Lock, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OTP_LENGTH } from "@/config/otp";
import { fetchScanAccess, type ScanCustomer } from "@/lib/scanner/api";
import { installScanSessionGuard, onSessionExpired, releasePending } from "@/lib/scanner/sessionGuard";

installScanSessionGuard();

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

const LOCK_KEY = "scan-otp-lock";
const MAX_TRIES = 5;
const LOCK_MS = 15 * 60_000;
const RESEND_S = 60;

/** Connexion par code à 6 chiffres saisi dans l'app (pas de lien : un lien ouvrirait Safari). */
export function CodeLogin({ expired = false }: { expired?: boolean }) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [now, setNow] = useState(Date.now());
  const readLock = () => { try { return JSON.parse(localStorage.getItem(LOCK_KEY) || "{}") as { tries?: number; until?: number }; } catch { return {}; } };
  const [lock, setLock] = useState(readLock);
  const locked = (lock.until ?? 0) > now;
  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); setWait((w) => (w > 0 ? w - 1 : 0)); }, 1000);
    return () => clearInterval(t);
  }, []);
  const saveLock = (l: { tries?: number; until?: number }) => { localStorage.setItem(LOCK_KEY, JSON.stringify(l)); setLock(l); };
  const send = async () => {
    if (!email.trim()) { toast.error("Indiquez votre adresse e-mail."); return; }
    if (wait > 0) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + (SCAN_BASENAME ?? ""), shouldCreateUser: false },
    });
    setBusy(false);
    if (error) { toast.error("Envoi impossible. Vérifiez l'adresse e-mail."); return; }
    setWait(RESEND_S);
    setStep("code");
  };
  const verify = async (value: string) => {
    if (value.length !== OTP_LENGTH || busy || locked) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: value, type: "email" });
    setBusy(false);
    if (error) {
      const tries = (lock.tries ?? 0) + 1;
      if (tries >= MAX_TRIES) { saveLock({ tries: 0, until: Date.now() + LOCK_MS }); toast.error("Trop d'essais. Réessayez dans 15 minutes."); }
      else { saveLock({ tries }); toast.error(`Code invalide ou expiré (${MAX_TRIES - tries} essai(s) restant(s)).`); }
      setCode("");
      return;
    }
    localStorage.removeItem(LOCK_KEY);
  };
  const lockMin = Math.ceil(((lock.until ?? 0) - now) / 60_000);
  return (
    <Center>
      <Brand />
      {expired && (
        <div className="rounded-xl border bg-card p-4">
          <p className="font-semibold">Votre session a expiré</p>
          <p className="text-sm text-muted-foreground">Recevez un nouveau code pour continuer.</p>
        </div>
      )}
      {step === "email" && (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="space-y-4">
          <p className="text-muted-foreground">Entrez votre e-mail, nous vous envoyons un code à {OTP_LENGTH} chiffres.</p>
          <Input type="email" required autoComplete="email" placeholder="vous@pharmacie.be" value={email}
            onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
          <Button type="submit" className="scan-tap h-12 w-full text-base" disabled={busy || wait > 0}>
            {busy ? "Envoi…" : wait > 0 ? `Nouveau code dans ${wait} s` : "Recevoir mon code"}
          </Button>
        </form>
      )}
      {step === "code" && (
        <form onSubmit={(e) => { e.preventDefault(); verify(code); }} className="space-y-4">
          <p className="text-muted-foreground">Code envoyé à {email}. Saisissez-le ici.</p>
          <Input inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={OTP_LENGTH} disabled={locked}
            value={code} placeholder={"•".repeat(OTP_LENGTH)}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH); setCode(v); if (v.length === OTP_LENGTH) verify(v); }}
            className="h-14 text-center text-2xl tracking-[0.4em]" aria-label="Code reçu par e-mail" />
          {locked && <p className="text-sm text-destructive">Trop d'essais. Réessayez dans {lockMin} min.</p>}
          <Button type="submit" className="scan-tap h-12 w-full text-base" disabled={busy || locked || code.length !== OTP_LENGTH}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Se connecter"}
          </Button>
          <Button type="button" variant="link" className="w-full" disabled={busy || wait > 0} onClick={send}>
            {wait > 0 ? `Renvoyer un code dans ${wait} s` : "Renvoyer un code"}
          </Button>
          <Button type="button" variant="link" className="w-full" onClick={() => { setStep("email"); setCode(""); }}>
            Changer d'e-mail
          </Button>
        </form>
      )}
    </Center>
  );
}

/** Bandeau Safari « ajouter à l'écran d'accueil », affiché une seule fois, jamais dans l'app installée. */
function InstallHint() {
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);
  const [show, setShow] = useState(() => !standalone && !localStorage.getItem("scan-install-hint-seen"));
  if (!show) return null;
  const close = () => { localStorage.setItem("scan-install-hint-seen", "1"); setShow(false); };
  return (
    <div className="mx-4 mt-3 flex items-start gap-3 rounded-xl border bg-card p-3 text-sm">
      <p className="flex-1">Installez MediKong Scan : touchez <b>Partager</b> puis <b>Sur l'écran d'accueil</b>.</p>
      <Button type="button" variant="ghost" size="sm" onClick={close}>OK</Button>
    </div>
  );
}

function BottomBar() {
  const { items } = useCart();
  // Lignes indisponibles (offre/produit plus lisible) exclues du badge
  const cartCount = items.filter((i) => i.product && Number(i.price_excl_vat) > 0).reduce((s, i) => s + i.quantity, 0);
  // Rebond de l'icône panier quand le nombre d'articles augmente
  const prevCount = useRef(cartCount);
  const [bounce, setBounce] = useState(0);
  useEffect(() => {
    if (cartCount > prevCount.current) setBounce((n) => n + 1);
    prevCount.current = cartCount;
  }, [cartCount]);
  const item = (to: string, label: string, Icon: LucideIcon, soon = false, badge?: number) => {
    const content = (
      <>
        <span key={badge != null ? `b${bounce}` : undefined} className={`relative flex h-6 w-6 items-center justify-center ${badge != null && bounce ? "scan-bounce" : ""}`}>
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
      className="fixed inset-x-0 bottom-0 z-40 mx-auto grid w-full max-w-md grid-cols-3 border-t bg-card pb-[calc(env(safe-area-inset-bottom)+8px)]"
    >
      {item("/", "Scanner", ScanLine)}
      {item("/panier", "Panier", ShoppingCart, false, cartCount)}
      {item("/moi", "Moi", User)}
    </nav>
  );
}

/** Accès Scan = interrupteur site ET interrupteur officine. Sinon : « Accès sur invitation ». */
export default function ScanGate({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const qc = useQueryClient();
  const hadUser = useRef(false);
  const [expired, setExpired] = useState(false);
  if (user) hadUser.current = true;
  const lastCustomer = useRef<ScanCustomer | null>(null);
  useEffect(() => { const off = onSessionExpired((v) => { if (v) setExpired(true); }); return () => { off(); }; }, []);
  // Reconnexion : renvoyer les appels mis en attente pendant l'expiration
  useEffect(() => {
    if (!user) return;
    supabase.auth.getSession().then(({ data: s }) => releasePending(s.session?.access_token ?? null));
  }, [user]);
  // Au retour au premier plan : vérifier/rafraîchir la session avant toute lecture
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const left = (s.session.expires_at ?? 0) * 1000 - Date.now();
      if (left < 5 * 60_000) {
        const { error } = await supabase.auth.refreshSession();
        if (error) { setExpired(true); return; }
      }
      qc.invalidateQueries();
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => { document.removeEventListener("visibilitychange", check); window.removeEventListener("online", check); };
  }, [qc]);
  useEffect(() => { if (user) setExpired(false); else if (hadUser.current && !sessionStorage.getItem("scan-manual-logout")) setExpired(true); sessionStorage.removeItem("scan-manual-logout"); }, [user]);
  const { data, isLoading } = useQuery({
    queryKey: ["scan-access", user?.id],
    enabled: !!user,
    queryFn: () => fetchScanAccess(user!.id),
    staleTime: 5 * 60_000,
  });

  if (loading || (user && isLoading)) {
    return <Center><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></Center>;
  }
  if (data?.allowed && data.customer) lastCustomer.current = data.customer;
  // Session expirée en cours d'usage : l'écran reste en place (saisies conservées), code demandé par-dessus
  if ((!user || expired) && expired && lastCustomer.current) {
    return (
      <ScanCtx.Provider value={lastCustomer.current}>
        <div className="mx-auto max-w-md pb-[calc(64px+env(safe-area-inset-bottom))]" aria-hidden>{children}</div>
        <div className="fixed inset-0 z-50 overflow-auto bg-background/95"><CodeLogin expired /></div>
      </ScanCtx.Provider>
    );
  }
  if (!user) return <CodeLogin expired={expired} />;
  if (!data?.allowed || !data.customer) {
    return (
      <Center>
        <Brand />
        <div className="rounded-xl border bg-card p-5 space-y-2">
          <Lock className="h-6 w-6 text-muted-foreground" />
          <p className="font-semibold">Accès sur invitation</p>
          <p className="text-sm text-muted-foreground">MediKong Scan est en phase pilote, sur invitation.</p>
          <p className="text-sm text-muted-foreground">Contact : <a className="underline" href="mailto:contact@medikong.pro">contact@medikong.pro</a></p>
        </div>
        <Button variant="outline" className="scan-tap" onClick={() => { sessionStorage.setItem("scan-manual-logout", "1"); signOut(); }}>Se déconnecter</Button>
      </Center>
    );
  }
  return (
    <ScanCtx.Provider value={data.customer}>
      <div className="mx-auto max-w-md pb-[calc(64px+env(safe-area-inset-bottom))]"><InstallHint />{children}</div>
      <BottomBar />
    </ScanCtx.Provider>
  );
}
