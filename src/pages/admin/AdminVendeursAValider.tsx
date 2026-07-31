import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useVendors } from "@/hooks/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, AlertTriangle, CheckCircle2, XCircle, Eye, Search } from "lucide-react";

type Filter = "all" | "pending_review" | "under_review";

const LABELS: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending_review: { label: "En attente", color: "#D97706", bg: "#FFFBEB", icon: Clock },
  under_review: { label: "En cours d'analyse", color: "#2563EB", bg: "#EFF6FF", icon: AlertTriangle },
};

const AdminVendeursAValider = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: vendors = [], isLoading, error } = useVendors();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const queue = useMemo(
    () =>
      vendors.filter((v: any) =>
        ["pending_review", "under_review"].includes(String(v.validation_status || "")),
      ),
    [vendors],
  );

  const pendingCount = queue.filter((v: any) => v.validation_status === "pending_review").length;
  const underReviewCount = queue.filter((v: any) => v.validation_status === "under_review").length;

  const filtered = useMemo(
    () =>
      queue
        .filter((v: any) => filter === "all" || v.validation_status === filter)
        .filter((v: any) => {
          if (!search.trim()) return true;
          const s = search.trim().toLowerCase();
          return (
            (v.company_name || v.name || "").toLowerCase().includes(s) ||
            (v.email || "").toLowerCase().includes(s) ||
            (v.display_code || "").toLowerCase().includes(s) ||
            (v.city || "").toLowerCase().includes(s)
          );
        }),
    [queue, filter, search],
  );

  const decide = async (id: string, action: "approved" | "rejected") => {
    setBusy(id);
    const { error: err } = await supabase
      .from("vendors")
      .update({ validation_status: action, validated_at: new Date().toISOString() } as any)
      .eq("id", id);
    setBusy(null);
    if (err) {
      toast.error(err.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
    toast.success(action === "approved" ? "Vendeur validé" : "Vendeur rejeté");
  };

  const badge = (status: string) => {
    const cfg = LABELS[status] || LABELS.pending_review;
    const Icon = cfg.icon;
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
        style={{ color: cfg.color, backgroundColor: cfg.bg }}
      >
        <Icon size={11} /> {cfg.label}
      </span>
    );
  };

  return (
    <div>
      <AdminTopBar
        title="Vendeurs à valider"
        subtitle={`${queue.length} vendeur(s) en attente ou en cours d'analyse`}
      />

      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {([
            { key: "all" as const, label: "Tous", count: queue.length },
            { key: "pending_review" as const, label: "🟡 En attente", count: pendingCount },
            { key: "under_review" as const, label: "🔵 En analyse", count: underReviewCount },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-semibold border ${
                filter === tab.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}

          <div className="relative ml-auto">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un vendeur…"
              className="pl-8 pr-3 py-1.5 rounded-md border border-border bg-background text-[13px] w-64"
            />
          </div>
        </div>

        {isLoading && <p className="text-[13px] text-muted-foreground">Chargement…</p>}
        {error && <p className="text-[13px] text-destructive">Erreur de chargement des vendeurs.</p>}

        {!isLoading && filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 text-muted-foreground" size={24} />
            <p className="text-[13px] text-muted-foreground">Aucun vendeur à valider.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/50">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Vendeur</th>
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold">Statut</th>
                  <th className="px-4 py-2 font-semibold">Inscrit le</th>
                  <th className="px-4 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v: any) => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <div className="font-semibold">{v.company_name || v.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {[v.display_code, v.city, v.country_code].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{v.email || "—"}</td>
                    <td className="px-4 py-2">{badge(v.validation_status)}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {v.created_at ? new Date(v.created_at).toLocaleDateString("fr-BE") : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/admin/vendeurs/${v.id}`)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[12px] font-semibold"
                        >
                          <Eye size={12} /> Fiche
                        </button>
                        <button
                          disabled={busy === v.id}
                          onClick={() => decide(v.id, "approved")}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-semibold bg-emerald-600 text-white disabled:opacity-50"
                        >
                          <CheckCircle2 size={12} /> Valider
                        </button>
                        <button
                          disabled={busy === v.id}
                          onClick={() => decide(v.id, "rejected")}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-semibold border border-destructive text-destructive disabled:opacity-50"
                        >
                          <XCircle size={12} /> Rejeter
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminVendeursAValider;
