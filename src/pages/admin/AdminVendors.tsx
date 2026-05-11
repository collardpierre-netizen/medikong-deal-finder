import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";

type StripeStatus = "none" | "pending" | "active";

interface VendorRow {
  id: string;
  name: string | null;
  slug: string | null;
  type: string | null;
  commission_rate: number | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
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

const AdminVendors = () => {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [vmiBusyId, setVmiBusyId] = useState<string | null>(null);

  const { data: vendors = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-vendors-stripe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select(
          "id, name, slug, type, commission_rate, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled"
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

  const showOnboardingUrl = (url: string) => {
    toast.success("Lien d'onboarding Stripe généré", {
      description: url,
      duration: 30000,
      action: {
        label: "Ouvrir",
        onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
      },
      cancel: {
        label: "Copier",
        onClick: () => {
          navigator.clipboard.writeText(url);
          toast.success("URL copiée");
        },
      },
    });
  };

  const invoke = async (action: string, vendor_id: string) => {
    setBusyId(vendor_id);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboarding", {
        body: { action, vendor_id, origin: window.location.origin },
      });
      if (error) throw error;
      if (action === "create-account" || action === "refresh-link") {
        const url = (data as any)?.url || (data as any)?.onboarding_url;
        if (url) showOnboardingUrl(url);
        else toast.success("OK", { description: JSON.stringify(data) });
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
              <TableHead>Veille marché</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && vendors.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      {busy && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                      {st === "none" && (
                        <button
                          disabled={busy}
                          onClick={() => invoke("create-account", v.id)}
                          className="text-[12px] px-3 py-1.5 rounded-md bg-[#1B5BDA] text-white hover:bg-[#1747b0] disabled:opacity-50"
                        >
                          Créer compte Stripe
                        </button>
                      )}
                      {st === "pending" && (
                        <button
                          disabled={busy}
                          onClick={() => invoke("refresh-link", v.id)}
                          className="text-[12px] px-3 py-1.5 rounded-md bg-[#F59E0B] text-white hover:bg-[#d8870a] disabled:opacity-50"
                        >
                          Régénérer lien
                        </button>
                      )}
                      {st === "active" && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => invoke("check-status", v.id)}
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
    </div>
  );
};

export default AdminVendors;
