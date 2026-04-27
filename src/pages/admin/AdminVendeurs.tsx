import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import StatusBadge from "@/components/admin/StatusBadge";
import VendorFormDialog from "@/components/admin/VendorFormDialog";
import { useI18n } from "@/contexts/I18nContext";
import { useVendors } from "@/hooks/useAdminData";
import { getVendorAdminName } from "@/lib/vendor-display";
import { Search, Plus, ExternalLink, Eye, EyeOff, LogIn, AlertTriangle, CheckCircle2, XCircle, Clock, ChevronDown, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type VStatus = "all" | "pending_review" | "under_review" | "accepted" | "approved" | "rejected";
type ActiveFilter = "all" | "active" | "inactive";

const VALIDATION_LABELS: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending_review: { label: "En attente", color: "#D97706", bg: "#FFFBEB", icon: Clock },
  under_review: { label: "En cours d'analyse", color: "#2563EB", bg: "#EFF6FF", icon: AlertTriangle },
  accepted: { label: "Candidature acceptée", color: "#7C3AED", bg: "#F5F3FF", icon: CheckCircle2 },
  approved: { label: "Validé", color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
  rejected: { label: "Rejeté", color: "#DC2626", bg: "#FEF2F2", icon: XCircle },
};

const AdminVendeurs = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data: vendors = [], isLoading } = useVendors();
  const [activeTab, setActiveTab] = useState<"all" | "medikong" | "qogita_virtual" | "real">("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<VStatus>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const toggleShowRealName = async (vendorId: string, current: boolean) => {
    await supabase.from("vendors").update({ show_real_name: !current } as any).eq("id", vendorId);
    queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
  };

  // Counts
  const pendingCount = vendors.filter(v => (v as any).validation_status === "pending_review").length;
  const underReviewCount = vendors.filter(v => (v as any).validation_status === "under_review").length;

  const tabs = [
    { key: "all" as const, label: "Tous", count: vendors.length },
    { key: "medikong" as const, label: "MediKong", count: vendors.filter(v => v.type === "medikong").length },
    { key: "qogita_virtual" as const, label: "Qogita", count: vendors.filter(v => v.type === "qogita_virtual").length },
    { key: "real" as const, label: "Réels", count: vendors.filter(v => v.type === "real").length },
  ];

  const filtered = useMemo(() => vendors
    .filter(v => activeTab === "all" || v.type === activeTab)
    .filter(v => statusFilter === "all" || (v as any).validation_status === statusFilter)
    .filter(v => activeFilter === "all" || (activeFilter === "active" ? v.is_active : !v.is_active))
    .filter(v => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (v.company_name || v.name).toLowerCase().includes(s) ||
        (v.city || "").toLowerCase().includes(s) ||
        (v.display_code || "").toLowerCase().includes(s) ||
        ((v as any).qogita_seller_alias || "").toLowerCase().includes(s) ||
        (v.email || "").toLowerCase().includes(s);
    }), [vendors, activeTab, statusFilter, activeFilter, search]);

  const allSelected = filtered.length > 0 && filtered.every(v => selected.has(v.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(v => v.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  // Bulk actions
  const bulkAction = async (action: "activate" | "deactivate" | "approve" | "reject" | "delete") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    if (action === "delete") {
      if (!window.confirm(`Supprimer définitivement ${ids.length} vendeur(s) ? Cette action est irréversible.`)) return;
      for (const id of ids) {
        await supabase.from("offers").delete().eq("vendor_id", id);
        await supabase.from("vendors").delete().eq("id", id);
      }
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      toast.success(`${ids.length} vendeur(s) supprimé(s)`);
      return;
    }

    const updates: Record<string, any> = {};
    if (action === "activate") { updates.is_active = true; }
    if (action === "deactivate") { updates.is_active = false; }
    if (action === "approve") { updates.validation_status = "approved"; updates.validated_at = new Date().toISOString(); }
    if (action === "reject") { updates.validation_status = "rejected"; updates.validated_at = new Date().toISOString(); }

    for (const id of ids) {
      await supabase.from("vendors").update(updates as any).eq("id", id);
    }
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
    toast.success(`${ids.length} vendeur(s) mis à jour`);
  };

  const renderValidationBadge = (status: string | null) => {
    const s = status || "pending_review";
    const cfg = VALIDATION_LABELS[s] || VALIDATION_LABELS.pending_review;
    const Icon = cfg.icon;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: cfg.color, backgroundColor: cfg.bg }}>
        <Icon size={11} /> {cfg.label}
      </span>
    );
  };

  return (
    <div>
      <AdminTopBar title={t("sellers")} subtitle={`${vendors.length} vendeurs enregistrés`}
        actions={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-bold text-white" style={{ backgroundColor: "#1E293B" }}>
            <Plus size={15} /> Ajouter un vendeur
          </button>
        }
      />

      {/* Warning banners */}
      {(pendingCount > 0 || underReviewCount > 0) && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {pendingCount > 0 && (
            <button onClick={() => setStatusFilter("pending_review")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A" }}>
              <AlertTriangle size={15} />
              {pendingCount} vendeur{pendingCount > 1 ? "s" : ""} en attente de validation
            </button>
          )}
          {underReviewCount > 0 && (
            <button onClick={() => setStatusFilter("under_review")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
              <Clock size={15} />
              {underReviewCount} en cours d'analyse
            </button>
          )}
        </div>
      )}

      {/* Type tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex" }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold transition-colors"
            style={{ backgroundColor: activeTab === tab.key ? "#1B5BDA" : "transparent", color: activeTab === tab.key ? "#fff" : "#616B7C" }}>
            {tab.label}
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: activeTab === tab.key ? "rgba(255,255,255,0.2)" : "#F1F5F9", color: activeTab === tab.key ? "#fff" : "#8B95A5" }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 max-w-sm" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <Search size={14} style={{ color: "#8B95A5" }} />
          <input type="text" placeholder="Rechercher un vendeur..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-[13px] outline-none bg-transparent" style={{ color: "#1D2530" }} />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as VStatus)}
            className="appearance-none px-3 py-2 pr-8 rounded-md text-[12px] font-semibold cursor-pointer"
            style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}>
            <option value="all">Tous les statuts</option>
            <option value="pending_review">🟡 En attente</option>
            <option value="under_review">🔵 En analyse</option>
            <option value="approved">🟢 Approuvé</option>
            <option value="rejected">🔴 Rejeté</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#8B95A5" }} />
        </div>

        {/* Active filter */}
        <div className="relative">
          <select value={activeFilter} onChange={e => setActiveFilter(e.target.value as ActiveFilter)}
            className="appearance-none px-3 py-2 pr-8 rounded-md text-[12px] font-semibold cursor-pointer"
            style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}>
            <option value="all">Actif & Inactif</option>
            <option value="active">Actif uniquement</option>
            <option value="inactive">Inactif uniquement</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#8B95A5" }} />
        </div>

        <span className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>{filtered.length} résultat{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-lg" style={{ backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE" }}>
          <span className="text-[13px] font-bold" style={{ color: "#3730A3" }}>{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => bulkAction("approve")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors hover:opacity-90" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
              <CheckCircle2 size={13} /> Approuver
            </button>
            <button onClick={() => bulkAction("reject")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors hover:opacity-90" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
              <XCircle size={13} /> Rejeter
            </button>
            <button onClick={() => bulkAction("activate")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors hover:opacity-90" style={{ backgroundColor: "#F0FDF4", color: "#16A34A" }}>
              <ToggleRight size={13} /> Activer
            </button>
             <button onClick={() => bulkAction("deactivate")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors hover:opacity-90" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
               <ToggleLeft size={13} /> Désactiver
             </button>
             <button onClick={() => bulkAction("delete")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors hover:opacity-90" style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}>
               <Trash2 size={13} /> Supprimer
             </button>
            <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors hover:opacity-90" style={{ color: "#64748B" }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        {isLoading ? (
          <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                <th className="px-3 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="w-4 h-4 rounded cursor-pointer accent-[#1B5BDA]" />
                </th>
                {["Vendeur", "ID MediKong", "ID Qogita", "Type", "Ville", "Comm.", "Validation", "Statut", "Inscrit", ""].map((h) => (
                  <th key={h} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const vs = (s as any).validation_status || "pending_review";
                const isSelected = selected.has(s.id);
                return (
                  <tr key={s.id}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid #F1F5F9", backgroundColor: isSelected ? "#EEF2FF" : "transparent" }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#F8FAFC"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOne(s.id)}
                        className="w-4 h-4 rounded cursor-pointer accent-[#1B5BDA]" />
                    </td>
                    <td className="px-3 py-3" onClick={() => navigate(`/admin/vendeurs/${s.id}`)}>
                      <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{getVendorAdminName(s)}</span>
                      <p className="text-[11px]" style={{ color: "#8B95A5" }}>{s.email || "—"}</p>
                    </td>
                    <td className="px-3 py-3" onClick={() => navigate(`/admin/vendeurs/${s.id}`)}>
                      <span className="px-2 py-1 rounded text-[11px] font-mono" style={{ backgroundColor: "#F1F5F9", color: "#616B7C" }}>{s.display_code || "—"}</span>
                    </td>
                    <td className="px-3 py-3" onClick={() => navigate(`/admin/vendeurs/${s.id}`)}>
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#F1F5F9", color: "#616B7C" }}>{s.type}</span>
                    </td>
                    <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }} onClick={() => navigate(`/admin/vendeurs/${s.id}`)}>{s.city || "—"}, {s.country_code}</td>
                    <td className="px-3 py-3 text-[13px]" style={{ color: "#616B7C" }} onClick={() => navigate(`/admin/vendeurs/${s.id}`)}>{s.commission_rate}%</td>
                    <td className="px-3 py-3" onClick={() => navigate(`/admin/vendeurs/${s.id}`)}>
                      {renderValidationBadge(vs)}
                    </td>
                    <td className="px-3 py-3" onClick={() => navigate(`/admin/vendeurs/${s.id}`)}>
                      <StatusBadge status={s.is_active ? "active" : "inactive"} />
                    </td>
                    <td className="px-3 py-3 text-[11px]" style={{ color: "#8B95A5" }} onClick={() => navigate(`/admin/vendeurs/${s.id}`)}>{new Date(s.created_at).toLocaleDateString("fr-BE")}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleShowRealName(s.id, !!(s as any).show_real_name); }}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold transition-opacity hover:opacity-80"
                          style={{ color: (s as any).show_real_name ? "#059669" : "#8B95A5", backgroundColor: (s as any).show_real_name ? "#ECFDF5" : "#F1F5F9" }}
                          title={(s as any).show_real_name ? "Visible publiquement" : "Anonyme"}
                        >
                          {(s as any).show_real_name ? <Eye size={10} /> : <EyeOff size={10} />}
                        </button>
                        {s.slug && (
                          <a href={`/vendeur/${s.slug}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold hover:opacity-80 transition-opacity"
                            style={{ color: "#1B5BDA", backgroundColor: "#EEF2FF" }}>
                            <ExternalLink size={10} />
                          </a>
                        )}
                        {(s as any).auth_user_id && (
                          <a href="/vendor" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold hover:opacity-80 transition-opacity"
                            style={{ color: "#059669", backgroundColor: "#ECFDF5" }}>
                            <LogIn size={10} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucun vendeur trouvé</div>
        )}
      </div>

      <VendorFormDialog open={showForm} onOpenChange={setShowForm} />
    </div>
  );
};

export default AdminVendeurs;
