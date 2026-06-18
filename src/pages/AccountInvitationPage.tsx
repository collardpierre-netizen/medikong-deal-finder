import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, AlertTriangle, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function AccountInvitationPage() {
  const { token } = useParams<{ token?: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const hasToken = !!token;

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
      // Small delay to ensure session/RLS reflect new membership
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

  // Auto-accept token-based invitation once user is logged in
  useEffect(() => {
    if (!hasToken || authLoading || !user || submitting) return;
    accept({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken, authLoading, user, token]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="animate-spin text-[#1B5BDA]" size={28} />
      </div>
    );
  }

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
            Connecte-toi ou crée un compte avec l'email exact qui a reçu cette invitation, puis reviens sur ce lien.
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
