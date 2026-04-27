import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw, AlertTriangle, CheckCircle2, ExternalLink, Search,
  Filter, Package, FileQuestion, Zap,
} from "lucide-react";
import { toast } from "sonner";

type IssueCode = "missing_moq" | "bundle_moq_mismatch" | string;

type LogRow = {
  id: string;
  product_id: string | null;
  offer_id: string | null;
  issue_code: IssueCode;
  details: any;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  product?: {
    id: string;
    name: string | null;
    gtin: string | null;
    cnk_code: string | null;
    image_url: string | null;
  } | null;
  offer?: {
    id: string;
    moq: number | null;
    price_excl_vat: number | null;
    is_active: boolean | null;
    synced_at: string | null;
    updated_at: string | null;
    vendor_id: string | null;
    vendor?: { id: string; name: string | null; company_name: string | null } | null;
  } | null;
};

const ISSUE_LABELS: Record<string, { label: string; color: string }> = {
  missing_moq: { label: "MOQ manquant", color: "bg-amber-100 text-amber-800 border-amber-300" },
  bundle_moq_mismatch: { label: "Incohérence bundle/MOQ", color: "bg-orange-100 text-orange-800 border-orange-300" },
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-BE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

export default function AdminOfferDataQuality() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState<string>("missing_moq");
  const [statusFilter, setStatusFilter] = useState<"unresolved" | "resolved" | "all">("unresolved");
  const [search, setSearch] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("offer_data_quality_logs")
        .select(`
          id, product_id, offer_id, issue_code, details,
          occurrence_count, first_seen_at, last_seen_at, resolved_at,
          product:products!offer_data_quality_logs_product_id_fkey (
            id, name, gtin, cnk_code, image_url
          ),
          offer:offers!offer_data_quality_logs_offer_id_fkey (
            id, moq, price_excl_vat, is_active, synced_at, updated_at, vendor_id,
            vendor:vendors ( id, name, company_name )
          )
        `)
        .order("last_seen_at", { ascending: false })
        .limit(500);

      if (issueFilter !== "all") q = q.eq("issue_code", issueFilter);
      if (statusFilter === "unresolved") q = q.is("resolved_at", null);
      if (statusFilter === "resolved") q = q.not("resolved_at", "is", null);

      const { data, error } = await q;
      if (error) throw error;
      setRows((data ?? []) as any);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [issueFilter, statusFilter]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const p = r.product;
      return (
        p?.name?.toLowerCase().includes(s) ||
        p?.gtin?.toLowerCase().includes(s) ||
        p?.cnk_code?.toLowerCase().includes(s) ||
        r.offer?.vendor?.company_name?.toLowerCase().includes(s) ||
        r.offer?.vendor?.name?.toLowerCase().includes(s) ||
        r.product_id?.includes(s) ||
        r.offer_id?.includes(s)
      );
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    const unresolved = rows.filter((r) => !r.resolved_at).length;
    const totalOcc = rows.reduce((sum, r) => sum + (r.occurrence_count || 0), 0);
    const stillBroken = rows.filter((r) => !r.resolved_at && r.offer && (r.offer.moq === null || r.offer.moq === 0)).length;
    return { unresolved, totalOcc, stillBroken };
  }, [rows]);

  const markResolved = async (id: string) => {
    setResolvingId(id);
    try {
      const { error } = await supabase
        .from("offer_data_quality_logs")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, resolved_at: new Date().toISOString() } : r)));
    } catch (e: any) {
      alert(e?.message ?? "Erreur");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="text-amber-600" size={24} />
            Diagnostic qualité des offres
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Offres signalées par le système de logs (MOQ manquant, incohérences post-sync, etc.).
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-card">
          <div className="text-sm text-muted-foreground">Anomalies non résolues</div>
          <div className="text-2xl font-bold mt-1">{stats.unresolved}</div>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="text-sm text-muted-foreground">Encore problématiques</div>
          <div className="text-2xl font-bold mt-1 text-amber-700">{stats.stillBroken}</div>
          <div className="text-xs text-muted-foreground">MOQ toujours vide après dernière sync</div>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="text-sm text-muted-foreground">Occurrences totales</div>
          <div className="text-2xl font-bold mt-1">{stats.totalOcc}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center p-4 rounded-xl border bg-card">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-muted-foreground" />
          <select
            value={issueFilter}
            onChange={(e) => setIssueFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background text-sm"
          >
            <option value="missing_moq">MOQ manquant</option>
            <option value="bundle_moq_mismatch">Incohérence bundle/MOQ</option>
            <option value="all">Tous les types</option>
          </select>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg border bg-background text-sm"
        >
          <option value="unresolved">Non résolus</option>
          <option value="resolved">Résolus</option>
          <option value="all">Tous</option>
        </select>
        <div className="flex-1 min-w-[240px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (produit, GTIN, CNK, vendeur, ID...)"
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Produit</th>
                <th className="px-4 py-3 font-semibold">Vendeur</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold text-right">MOQ actuel</th>
                <th className="px-4 py-3 font-semibold">Dernière sync offre</th>
                <th className="px-4 py-3 font-semibold">Dernier signalement</th>
                <th className="px-4 py-3 font-semibold text-right">#</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Chargement...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <CheckCircle2 className="mx-auto mb-2 text-green-600" size={32} />
                    Aucune anomalie pour ces filtres.
                  </td>
                </tr>
              )}
              {!loading && filtered.map((r) => {
                const issueMeta = ISSUE_LABELS[r.issue_code] ?? { label: r.issue_code, color: "bg-gray-100 text-gray-800 border-gray-300" };
                const moq = r.offer?.moq;
                const stillBroken = !r.resolved_at && r.issue_code === "missing_moq" && (moq === null || moq === 0);
                const vendorName = r.offer?.vendor?.company_name || r.offer?.vendor?.name || "—";
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {r.product?.image_url ? (
                          <img src={r.product.image_url} alt="" className="w-10 h-10 rounded object-cover border" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Package size={16} className="text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate max-w-[280px]">
                            {r.product?.name ?? <span className="text-muted-foreground italic">Produit supprimé</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.product?.gtin && <span>GTIN: {r.product.gtin}</span>}
                            {r.product?.cnk_code && <span> · CNK: {r.product.cnk_code}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.offer?.vendor_id ? (
                        <Link to={`/admin/vendeurs/${r.offer.vendor_id}`} className="text-primary hover:underline">
                          {vendorName}
                        </Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${issueMeta.color}`}>
                        {issueMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {moq === null || moq === undefined ? (
                        <span className="text-amber-700 font-semibold">—</span>
                      ) : (
                        <span className={moq === 0 ? "text-amber-700 font-semibold" : ""}>{moq}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(r.offer?.synced_at ?? r.offer?.updated_at ?? null)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(r.last_seen_at)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.occurrence_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.product_id && (
                          <Link
                            to={`/admin/produits/${r.product_id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border hover:bg-muted"
                            title="Voir produit"
                          >
                            <ExternalLink size={12} /> Produit
                          </Link>
                        )}
                        {!r.resolved_at && !stillBroken && (
                          <button
                            onClick={() => markResolved(r.id)}
                            disabled={resolvingId === r.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle2 size={12} /> Résoudre
                          </button>
                        )}
                        {r.resolved_at && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700">
                            <CheckCircle2 size={12} /> Résolu
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <FileQuestion className="inline mr-1" size={12} />
        Les anomalies sont automatiquement signalées par le catalogue (côté UI) et par les jobs de synchronisation Qogita.
        L'indicateur « Encore problématiques » liste les offres dont le MOQ est resté vide après la dernière sync.
      </p>
    </div>
  );
}
