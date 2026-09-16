import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, ExternalLink, Loader2, Mail, RefreshCw, Sparkles, SlidersHorizontal, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUpdatedAt } from "@/lib/format-date";
import AdminVendorMovMoqModal from "@/components/admin/AdminVendorMovMoqModal";
import AdminVendorComplianceModal from "@/components/admin/AdminVendorComplianceModal";
import { VendorPeppolBadge } from "@/components/admin/VendorPeppolBadge";
import { isBelgianVendor } from "@/lib/peppol";

type StripeStatus = "none" | "pending" | "active";

interface VendorRow {
  id: string;
  name: string | null;
  slug: string | null;
  type: string | null;
  email: string | null;
  commission_rate: number | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  country_code: string | null;
  peppol_id: string | null;
}

function statusOf(v: VendorRow): StripeStatus {
  if (v.stripe_charges_enabled && v.stripe_payouts_enabled) return "active";
  if (v.stripe_account_id) return "pending";
  return "none";
}

const StatusBadge = ({ status }: { status: StripeStatus }) => {
  const cfg = {
    none: { label: "Non onboardé", bg: "#F1F5F9", text: "#616B7C", dot: "#8B95A5" },
    pending: { label: "En cours", bg: "#FFFBEB", text: "#D97706", dot: "#F59E0B" },
    active: { label: "Activé", bg: "#F0FDF4", text: "#059669", dot: "#059669" },
  }[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  );
};

type VmiStatus = "none" | "trial" | "active" | "expired" | "cancelled";
interface VmiRow {
  vendor_id: string;
  status: VmiStatus;
  trial_ends_at: string | null;
  trial_days_remaining: number | null;
}

interface OnboardingLink {
  vendorId: string;
  name: string | null;
  email: string | null;
  url: string;
}

const AdminVendors = () => {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [onboardingLink, setOnboardingLink] = useState<OnboardingLink | null>(null);
  const [vmiBusyId, setVmiBusyId] = useState<string | null>(null);
  const [movMoqVendor, setMovMoqVendor] = useState<{ id: string; name: string | null } | null>(null);
  const [complianceVendor, setComplianceVendor] = useState<{ id: string; name: string | null } | null>(null);

  const { data: vendors = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-vendors-stripe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select(
          "id, name, slug, type, email, commission_rate, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled, country_code, peppol_id"
        )
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as VendorRow[];
    },
    enabled: isAdmin,
  });

  const { data: vmiByVendor = {}, refetch: refetchVmi } = useQuery({
    queryKey: ["admin-vendors-vmi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_market_intel_status_v" as any)
        .select("vendor_id, status, trial_ends_at, trial_days_remaining");
      if (error) throw error;
      const map: Record<string, VmiRow> = {};
      ((data as unknown as VmiRow[]) ?? []).forEach((r) => { map[r.vendor_id] = r; });
      return map;
    },
    enabled: isAdmin,
  });

  const { data: complianceByVendor = {} } = useQuery({
    queryKey: ["admin-vendors-compliance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, is_authorized_distributor, mandate_signed_at");
      if (error) throw error;
      const map: Record<string, { auth: boolean; mandate: boolean }> = {};
      ((data ?? []) as Array<{ id: string; is_authorized_distributor: boolean | null; mandate_signed_at: string | null }>)
        .forEach((r) => {
          map[r.id] = {
            auth: !!r.is_authorized_distributor,
            mandate: !!r.mandate_signed_at,
          };
        });
      return map;
    },
    enabled: isAdmin,
  });

  const startTrial = async (vendor_id: string, vendor_name: string | null) => {
    if (!confirm(`Démarrer l'essai 180 jours pour ${vendor_name ?? vendor_id} ?`)) return;
    setVmiBusyId(vendor_id);
    try {
      const { error } = await supabase.rpc("start_vendor_market_intel_trial" as any, {
        _vendor_id: vendor_id,
        _trial_days: 180,
      });
      if (error) throw error;
      toast.success("Essai 180 j activé");
      await refetchVmi();
    } catch (e: any) {
      toast.error("Erreur", { description: e?.message ?? String(e) });
    } finally {
      setVmiBusyId(null);
    }
  };


  if (authLoading) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié");
    } catch {
      toast.error("Copie impossible", { description: "Sélectionne le lien puis copie-le manuellement." });
    }
  };

  const openMailDraft = (link: OnboardingLink) => {
    if (!link.email) {
      toast.error("Aucune adresse e-mail pour ce vendeur", {
        description: "Renseigne son e-mail dans sa fiche, ou copie le lien et envoie-le manuellement.",
      });
      return;
    }
    const subject = "Finalisez votre inscription Stripe pour MediKong";
    const body = [
      `Bonjour ${link.name ?? ""},`.trim(),
      "",
      "Pour recevoir vos paiements via MediKong, il reste à finaliser votre inscription Stripe (identité, société, coordonnées bancaires).",
      "",
      "Lien sécurisé à compléter :",
      link.url,
      "",
      "Ce lien est temporaire : s'il a expiré, répondez à cet e-mail et nous vous en renverrons un nouveau.",
      "",
      "Bien à vous,",
      "L'équipe MediKong",
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(link.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Renvoie le JWT courant, rafraîchi seulement lorsqu'il manque ou arrive à expiration.
  // La validation définitive reste faite par la fonction sécurisée côté serveur.
  const getFreshAccessToken = async (forceRefresh = false) => {
    const { data: sess } = await supabase.auth.getSession();
    const currentSession = sess.session;
    const expiresAt = currentSession?.expires_at ?? 0;
    const expiringSoon = !expiresAt || expiresAt * 1000 - Date.now() < 60_000;

    if (forceRefresh || !currentSession?.access_token || expiringSoon) {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.data.session?.access_token) {
        return refreshed.data.session.access_token;
      }

      // Le stockage d'authentification de l'aperçu peut refuser un refresh tout
      // en conservant un jeton courant encore valide. Ne pas déconnecter l'admin
      // dans ce cas : le serveur vérifiera lui-même ce jeton.
      if (!forceRefresh && currentSession?.access_token && expiresAt * 1000 > Date.now()) {
        return currentSession.access_token;
      }

      return null;
    }

    return currentSession.access_token;
  };

  const invoke = async (action: string, vendor: VendorRow) => {
    const vendor_id = vendor.id;
    setBusyId(vendor_id);
    try {
      // Sans session valide, `functions.invoke` envoie la clé anon en
      // Authorization et la fonction répond 401 "Non autorisé".
      // On rafraîchit/valide la session et on passe le JWT explicitement.
      let accessToken = await getFreshAccessToken();
      if (!accessToken) {
        throw new Error("Session expirée — reconnecte-toi pour gérer Stripe Connect.");
      }

      const call = (token: string) =>
        supabase.functions.invoke("stripe-connect-onboarding", {
          body: { action, vendor_id, origin: window.location.origin },
          headers: { Authorization: `Bearer ${token}` },
        });

      let { data, error } = await call(accessToken);

      // Jeton rejeté malgré tout : on force un refresh et on retente une fois.
      if (error) {
        const retried = await getFreshAccessToken(true);
        if (retried) {
          accessToken = retried;
          ({ data, error } = await call(retried));
        }
      }

      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 401) {
          throw new Error("Session expirée — reconnecte-toi puis réessaie.");
        }
        if (status === 403) {
          throw new Error("Accès refusé : compte administrateur requis.");
        }
        throw error;
      }
      if (action === "create-account" || action === "refresh-link") {
        const url = (data as any)?.url || (data as any)?.onboarding_url;
        if (url) {
          setOnboardingLink({ vendorId: vendor.id, name: vendor.name, email: vendor.email, url });
          toast.success("Lien Stripe généré");
        } else {
          toast.success("OK", { description: JSON.stringify(data) });
        }
      } else if (action === "check-status") {
        toast.success("Statut mis à jour", {
          description: `charges=${(data as any)?.charges_enabled} · payouts=${(data as any)?.payouts_enabled}`,
        });
      }
      await refetch();
    } catch (e: any) {
      toast.error("Erreur", { description: e?.message ?? String(e) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold" style={{ color: "#1D2530" }}>
            Vendors — Stripe Connect
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Onboarding et statut des comptes Stripe Express pour chaque vendeur.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9]"
        >
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Stripe</TableHead>
              <TableHead>Peppol</TableHead>
              <TableHead>Conformité</TableHead>
              <TableHead>Veille marché</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && vendors.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Aucun vendor.
                </TableCell>
              </TableRow>
            )}
            {vendors.map((v) => {
              const st = statusOf(v);
              const busy = busyId === v.id;
              return (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{v.slug ?? "—"}</TableCell>
                  <TableCell>{v.type ?? "—"}</TableCell>
                  <TableCell>
                    {v.commission_rate != null ? `${(v.commission_rate * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={st} /></TableCell>
                  <TableCell>
                    <VendorPeppolBadge peppolId={v.peppol_id} isBelgian={isBelgianVendor(v.country_code)} />
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const c = complianceByVendor[v.id];
                      const ok = !!(c?.auth && c?.mandate);
                      const partial = !!(c?.auth || c?.mandate);
                      const cfg = ok
                        ? { bg: "#F0FDF4", text: "#059669", label: "Conforme", Icon: ShieldCheck }
                        : partial
                          ? { bg: "#FFFBEB", text: "#D97706", label: c?.auth ? "Sans mandat" : "Non déclaré", Icon: ShieldAlert }
                          : { bg: "#FEF2F2", text: "#B91C1C", label: "Non conforme", Icon: ShieldAlert };
                      return (
                        <button
                          onClick={() => setComplianceVendor({ id: v.id, name: v.name })}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold hover:brightness-95"
                          style={{ backgroundColor: cfg.bg, color: cfg.text }}
                          title="Modifier la conformité"
                        >
                          <cfg.Icon size={11} /> {cfg.label}
                        </button>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const vmi = vmiByVendor[v.id];
                      const status = vmi?.status ?? "none";
                      const vmiBusy = vmiBusyId === v.id;
                      if (status === "trial") {
                        return (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Sparkles size={11} /> Essai · fin {vmi?.trial_ends_at ? formatUpdatedAt(vmi.trial_ends_at) : "—"}
                          </span>
                        );
                      }
                      if (status === "active") {
                        return <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Abonné</span>;
                      }
                      return (
                        <button
                          disabled={vmiBusy}
                          onClick={() => startTrial(v.id, v.name)}
                          className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {vmiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          Démarrer l'essai 180 j
                        </button>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      {busy && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                      <button
                        onClick={() => setMovMoqVendor({ id: v.id, name: v.name })}
                        className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9]"
                        title="Éditer MOV / MOQ"
                      >
                        <SlidersHorizontal size={12} /> MOV/MOQ
                      </button>
                      {st === "none" && (
                        <button
                          disabled={busy}
                          onClick={() => invoke("create-account", v)}
                          className="text-[12px] px-3 py-1.5 rounded-md bg-[#1B5BDA] text-white hover:bg-[#1747b0] disabled:opacity-50"
                        >
                          Créer compte Stripe
                        </button>
                      )}
                      {st === "pending" && (
                        <button
                          disabled={busy}
                          onClick={() => invoke("refresh-link", v)}
                          className="text-[12px] px-3 py-1.5 rounded-md bg-[#F59E0B] text-white hover:bg-[#d8870a] disabled:opacity-50"
                        >
                          Régénérer lien
                        </button>
                      )}
                      {st === "active" && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => invoke("check-status", v)}
                            className="text-[12px] px-3 py-1.5 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] disabled:opacity-50"
                          >
                            Vérifier statut
                          </button>
                          <a
                            href={`https://dashboard.stripe.com/connect/accounts/${v.stripe_account_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-md bg-[#1B5BDA] text-white hover:bg-[#1747b0]"
                          >
                            <ExternalLink size={12} /> Ouvrir compte
                          </a>
                        </>
                      )}
                      {st !== "active" && v.stripe_account_id && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(v.stripe_account_id!);
                            toast.success("Account ID copié");
                          }}
                          className="text-[12px] px-2 py-1.5 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9]"
                          title={v.stripe_account_id}
                        >
                          <Copy size={12} />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AdminVendorMovMoqModal
        vendorId={movMoqVendor?.id ?? null}
        vendorName={movMoqVendor?.name ?? null}
        open={!!movMoqVendor}
        onOpenChange={(v) => { if (!v) setMovMoqVendor(null); }}
      />

      <AdminVendorComplianceModal
        vendorId={complianceVendor?.id ?? null}
        vendorName={complianceVendor?.name ?? null}
        open={!!complianceVendor}
        onOpenChange={(v) => { if (!v) setComplianceVendor(null); }}
      />

      <Dialog open={!!onboardingLink} onOpenChange={(o) => { if (!o) setOnboardingLink(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Lien Stripe à envoyer</DialogTitle>
            <DialogDescription>
              {onboardingLink?.name ?? "Vendeur"} doit ouvrir ce lien pour finaliser son inscription Stripe.
              Le lien est temporaire : régénère-le s'il a expiré.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <textarea
              readOnly
              value={onboardingLink?.url ?? ""}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-24 text-[12px] font-mono p-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] break-all"
            />
            <p className="text-[12px] text-muted-foreground">
              Destinataire :{" "}
              {onboardingLink?.email ? (
                <span className="font-medium">{onboardingLink.email}</span>
              ) : (
                <span className="text-[#B91C1C]">aucune adresse e-mail enregistrée pour ce vendeur</span>
              )}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <button
              onClick={() => onboardingLink && copyLink(onboardingLink.url)}
              className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9]"
            >
              <Copy size={12} /> Copier le lien
            </button>
            <button
              onClick={() => onboardingLink && openMailDraft(onboardingLink)}
              className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md bg-[#1B5BDA] text-white hover:bg-[#1747b0]"
            >
              <Mail size={12} /> Préparer l'e-mail
            </button>
            <a
              href={onboardingLink?.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9]"
            >
              <ExternalLink size={12} /> Ouvrir
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminVendors;
