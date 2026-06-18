import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  UserPlus,
  MailCheck,
} from "lucide-react";
import { toast } from "sonner";

interface InvitationInfo {
  email: string;
  account_kind: string;
  role: string;
  expires_at: string | null;
  accepted: boolean;
  revoked: boolean;
  expired: boolean;
  user_exists: boolean;
}

export default function AccountInvitationPage() {
  const { token } = useParams<{ token?: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Token-driven invitation metadata (used to pre-fill signup when unauth)
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loadingInvitation, setLoadingInvitation] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  // Signup form state
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPassword2, setSignupPassword2] = useState("");
  const [signupFullName, setSignupFullName] = useState("");
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupNeedsEmailConfirm, setSignupNeedsEmailConfirm] = useState(false);

  const hasToken = !!token;

  // Load invitation metadata for token-based links (works without session)
  useEffect(() => {
    if (!hasToken) return;
    let cancelled = false;
    setLoadingInvitation(true);
    setInvitationError(null);
    (async () => {
      const { data, error } = await supabase.rpc("account_get_invitation_by_token", {
        _token: token!,
      });
      if (cancelled) return;
      if (error) {
        setInvitationError(error.message);
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          setInvitationError("Invitation introuvable ou déjà supprimée.");
        } else {
          setInvitation(row as InvitationInfo);
        }
      }
      setLoadingInvitation(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasToken, token]);

  const accept = async (payload: { token?: string; joinCode?: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("account_accept_invitation", {
        _token: payload.token ?? null,
        _join_code: payload.joinCode ?? null,
      });
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      const kind = row?.account_kind as string | undefined;
      toast.success("Invitation acceptée");
      setTimeout(() => {
        navigate(kind === "vendor" ? "/vendor" : "/compte", { replace: true });
      }, 600);
    } catch (e: any) {
      const msg = e?.message || "Erreur lors de l'acceptation";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-accept token-based invitation once user is logged in (also fires
  // right after a successful signup that returns a session immediately).
  useEffect(() => {
    if (!hasToken || authLoading || !user || submitting) return;
    accept({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken, authLoading, user, token]);

  const handleSignup = async () => {
    setSignupError(null);
    if (!invitation?.email) {
      setSignupError("Email d'invitation indisponible.");
      return;
    }
    if (signupPassword.length < 8) {
      setSignupError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (signupPassword !== signupPassword2) {
      setSignupError("Les mots de passe ne correspondent pas.");
      return;
    }
    setSignupSubmitting(true);
    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await supabase.auth.signUp({
        email: invitation.email,
        password: signupPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: signupFullName ? { full_name: signupFullName } : undefined,
        },
      });
      if (error) throw error;
      if (data?.session) {
        // Session immediately available → useEffect above will auto-accept.
        toast.success("Compte créé, acceptation en cours…");
      } else {
        // Email confirmation required.
        setSignupNeedsEmailConfirm(true);
      }
    } catch (e: any) {
      const msg = e?.message || "Erreur lors de la création du compte";
      setSignupError(msg);
    } finally {
      setSignupSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="animate-spin text-[#1B5BDA]" size={28} />
      </div>
    );
  }

  // ===== Unauthenticated branch (token-based invitations) =====
  if (!user && hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
        <Helmet>
          <title>Invitation MediKong</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="max-w-md w-full bg-white rounded-xl border border-[#E2E8F0] p-8 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-[#1B5BDA] flex items-center justify-center mx-auto">
              <ShieldCheck size={24} />
            </div>
            <h1 className="text-[20px] font-bold text-[#1D2530]">Rejoindre un compte</h1>
          </div>

          {loadingInvitation ? (
            <div className="flex items-center justify-center py-6 gap-2 text-[13px] text-[#616B7C]">
              <Loader2 className="animate-spin" size={16} /> Chargement…
            </div>
          ) : invitationError || !invitation ? (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={16} />
              <p className="text-[12px] text-destructive">
                {invitationError || "Invitation introuvable."}
              </p>
            </div>
          ) : invitation.revoked ? (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={16} />
              <p className="text-[12px] text-destructive">
                Cette invitation a été révoquée. Demande une nouvelle invitation à l'administrateur du compte.
              </p>
            </div>
          ) : invitation.accepted ? (
            <div className="space-y-3">
              <p className="text-[13px] text-[#616B7C]">
                Cette invitation a déjà été acceptée. Connecte-toi pour accéder au compte.
              </p>
              <Button
                className="w-full"
                onClick={() =>
                  navigate(`/connexion?redirect=${encodeURIComponent(window.location.pathname)}`)
                }
              >
                Se connecter
              </Button>
            </div>
          ) : invitation.expired ? (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={16} />
              <p className="text-[12px] text-destructive">
                Cette invitation a expiré. Demande une nouvelle invitation à l'administrateur du compte.
              </p>
            </div>
          ) : invitation.user_exists ? (
            <div className="space-y-3 text-center">
              <p className="text-[13px] text-[#616B7C]">
                Tu as déjà un compte avec <strong>{invitation.email}</strong>. Connecte-toi pour
                accepter l'invitation.
              </p>
              <Button
                className="w-full"
                onClick={() =>
                  navigate(
                    `/connexion?email=${encodeURIComponent(invitation.email)}&redirect=${encodeURIComponent(
                      window.location.pathname,
                    )}`,
                  )
                }
              >
                Se connecter
              </Button>
            </div>
          ) : signupNeedsEmailConfirm ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <MailCheck className="text-[#1B5BDA] shrink-0 mt-0.5" size={16} />
                <p className="text-[12px] text-[#1D2530]">
                  Compte créé. Confirme ton email <strong>{invitation.email}</strong> en cliquant sur
                  le lien que nous venons de t'envoyer, puis reviens sur cette page pour finaliser
                  l'acceptation.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[12px] text-[#616B7C] text-center">
                Invitation reçue pour <strong>{invitation.email}</strong>. Crée ton mot de passe pour
                rejoindre le compte {invitation.account_kind === "vendor" ? "vendeur" : "acheteur"}.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="invited-email">Email</Label>
                <Input id="invited-email" value={invitation.email} disabled readOnly />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="full-name">Nom complet (optionnel)</Label>
                <Input
                  id="full-name"
                  value={signupFullName}
                  onChange={(e) => setSignupFullName(e.target.value)}
                  placeholder="Prénom Nom"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pwd">Mot de passe (min. 8 caractères)</Label>
                <Input
                  id="pwd"
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pwd2">Confirmer le mot de passe</Label>
                <Input
                  id="pwd2"
                  type="password"
                  value={signupPassword2}
                  onChange={(e) => setSignupPassword2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {signupError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={16} />
                  <p className="text-[12px] text-destructive">{signupError}</p>
                </div>
              )}

              <Button className="w-full" disabled={signupSubmitting} onClick={handleSignup}>
                {signupSubmitting ? (
                  <Loader2 className="animate-spin mr-2" size={14} />
                ) : (
                  <UserPlus className="mr-2" size={14} />
                )}
                Créer mon compte et rejoindre
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-[11px] text-[#8B95A5] hover:text-[#1B5BDA] underline"
                  onClick={() =>
                    navigate(
                      `/connexion?email=${encodeURIComponent(invitation.email)}&redirect=${encodeURIComponent(
                        window.location.pathname,
                      )}`,
                    )
                  }
                >
                  J'ai déjà un compte, me connecter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== Unauthenticated branch (no token — join-code flow only) =====
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
        <Helmet>
          <title>Invitation MediKong</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="max-w-md w-full bg-white rounded-xl border border-[#E2E8F0] p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-[#1B5BDA] flex items-center justify-center mx-auto">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-[20px] font-bold text-[#1D2530]">Connexion requise</h1>
          <p className="text-[13px] text-[#616B7C]">
            Connecte-toi ou crée un compte pour saisir ton code d'accès.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => navigate(`/connexion?redirect=${encodeURIComponent(window.location.pathname)}`)}>
              Se connecter
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ===== Authenticated branch =====
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
      <Helmet>
        <title>Invitation MediKong</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-md w-full bg-white rounded-xl border border-[#E2E8F0] p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-[#1B5BDA] flex items-center justify-center mx-auto">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-[20px] font-bold text-[#1D2530]">Rejoindre un compte</h1>
          <p className="text-[12px] text-[#8B95A5]">Connecté en tant que <strong>{user.email}</strong></p>
        </div>

        {hasToken ? (
          <div className="text-center py-4">
            {submitting ? (
              <div className="flex items-center justify-center gap-2 text-[13px] text-[#616B7C]">
                <Loader2 className="animate-spin" size={16} /> Acceptation en cours…
              </div>
            ) : error ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-left">
                  <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={16} />
                  <p className="text-[12px] text-destructive">{error}</p>
                </div>
                <Button variant="outline" onClick={() => accept({ token })} className="w-full">
                  Réessayer
                </Button>
              </div>
            ) : (
              <p className="text-[13px] text-[#616B7C]">Préparation…</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code d'accès (6 caractères)</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC123"
                className="font-mono text-center text-[20px] tracking-[0.3em]"
                autoFocus
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={16} />
                <p className="text-[12px] text-destructive">{error}</p>
              </div>
            )}
            <Button
              className="w-full"
              disabled={code.length !== 6 || submitting}
              onClick={() => accept({ joinCode: code })}
            >
              {submitting ? <Loader2 className="animate-spin mr-2" size={14} /> : <KeyRound className="mr-2" size={14} />}
              Rejoindre
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
