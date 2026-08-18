import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/impersonation";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import {
  Eye, Users, Store, ShoppingBag, AlertTriangle, Search, Plus,
  Ban, CheckCircle, Trash2, X, Building2, Mail, Phone, MapPin,
  Calendar, FileText, Clock, ChevronRight, UserCheck, UserX, KeyRound
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UserCreateDialog from "@/components/admin/UserCreateDialog";
import EditBuyerProfileDialog from "@/components/admin/EditBuyerProfileDialog";
import { logAdminAudit } from "@/lib/admin-audit";
import UserAuditTimeline from "@/components/admin/UserAuditTimeline";

const LANG_FLAGS: Record<string, string> = { fr: "🇫🇷 Français", nl: "🇳🇱 Nederlands", en: "🇬🇧 English", de: "🇩🇪 Deutsch" };

interface UserRow {
  id: string;
  userId: string | null;
  email: string;
  type: "vendor" | "buyer";
  company: string;
  plan: string;
  profile: string | null;
  status: string;
  lastLogin: string | null;
  createdAt: string | null;
  linked: boolean;
}

interface BuyerDetail {
  id: string;
  auth_user_id: string;
  company_name: string;
  email: string;
  phone: string | null;
  vat_number: string | null;
  country_code: string;
  city: string;
  address_line1: string;
  postal_code: string;
  customer_type: string;
  is_verified: boolean;
  is_professional: boolean;
  payment_terms_days: number;
  created_at: string;
  profile?: {
    full_name: string;
    sector: string | null;
    country: string | null;
    price_level_code: string | null;
    preferred_language: string | null;
  };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "vendor" | "buyer" | "pending">("all");
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending">("all");
  const [linkedFilter, setLinkedFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [buyerDetail, setBuyerDetail] = useState<BuyerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<UserRow | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [deleteModal, setDeleteModal] = useState<UserRow | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const { startImpersonation } = useImpersonation();
  const navigate = useNavigate();

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    const rows: UserRow[] = [];

    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, auth_user_id, email, company_name, type, is_active, created_at")
      .order("company_name");

    vendors?.forEach(v => {
      rows.push({
        id: v.id,
        userId: v.auth_user_id ?? null,
        email: v.email || "",
        type: "vendor",
        company: v.company_name || v.id,
        plan: v.type || "real",
        profile: v.type || null,
        status: v.is_active ? "active" : "inactive",
        lastLogin: null,
        createdAt: v.created_at ?? null,
        linked: !!v.auth_user_id,
      });
    });

    const { data: customers } = await supabase
      .from("customers")
      .select("id, auth_user_id, email, company_name, customer_type, is_verified, created_at")
      .order("company_name");

    customers?.forEach(b => {
      rows.push({
        id: b.id,
        userId: b.auth_user_id ?? null,
        email: b.email || "",
        type: "buyer",
        company: b.company_name,
        plan: b.customer_type || "pharmacy",
        profile: b.customer_type || null,
        status: b.is_verified ? "active" : "pending",
        lastLogin: null,
        createdAt: b.created_at ?? null,
        linked: !!b.auth_user_id,
      });
    });

    setUsers(rows);
    setLoading(false);
  }

  async function openDetail(u: UserRow) {
    setSelectedUser(u);
    if (u.type === "buyer") {
      setDetailLoading(true);
      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      let profile = null;
      if (u.userId) {
        const { data: p } = await supabase
          .from("profiles" as any)
          .select("full_name, sector, country, price_level_code, preferred_language")
          .eq("user_id", u.userId)
          .maybeSingle();
        profile = p;
      }

      if (customer) {
        setBuyerDetail({ ...customer, profile: profile || undefined } as any);
      }
      setDetailLoading(false);
    } else {
      setBuyerDetail(null);
    }
  }

  async function handleCreateAccess(u: UserRow) {
    if (u.linked) return;
    const fnName = u.type === "vendor" ? "create-vendor-account" : "create-buyer-account";
    const body = u.type === "vendor" ? { vendor_id: u.id } : { customer_id: u.id, email: u.email };
    const { data, error } = await supabase.functions.invoke(fnName, { body });

    // Extraire le vrai message d'erreur du corps de la réponse (FunctionsHttpError.context est une Response)
    let realError: string | null = null;
    if (error) {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.text === "function") {
        try {
          const txt = await ctx.text();
          try {
            const j = JSON.parse(txt);
            realError = j?.error || j?.message || txt;
          } catch { realError = txt; }
        } catch { /* ignore */ }
      }
      realError = realError || (error as any).message || "Erreur inconnue";
    } else if (data?.ok === false || data?.error) {
      realError = data?.error || "Erreur inconnue";
    }

    if (realError) {
      console.error(`[${fnName}] failed for ${u.email}:`, realError, { data, error });
      toast.error(`Erreur : ${realError}`);
      return;
    }
    toast.success("Accès créé", {
      description: data?.temp_password
        ? `Mot de passe temporaire : ${data.temp_password}`
        : "Compte auth existant rattaché.",
      duration: 15000,
    });
    loadUsers();
  }


  function closeDetail() {
    setSelectedUser(null);
    setBuyerDetail(null);
  }

  async function handleValidate(_userId: string | null) {
    // Validate by customer row id (works even when auth account isn't created yet)
    const customerId = buyerDetail?.id || selectedUser?.id;
    if (!customerId) { toast.error("Aucun client sélectionné"); return; }
    const { data: updated, error } = await supabase
      .from("customers")
      .update({ is_verified: true } as any)
      .eq("id", customerId)
      .select("id, email, company_name, is_verified")
      .maybeSingle();
    if (error) { toast.error("Erreur: " + error.message); return; }
    if (!updated) { toast.error("Client introuvable ou déjà validé"); return; }
    toast.success("✅ Compte acheteur validé");
    logAdminAudit("customer.verify", {
      targetId: updated.id, targetType: "customer",
      metadata: { email: updated.email, company_name: updated.company_name },
    });

    // Notify buyer that their account is now verified (transactional)
    if (updated?.email) {
      supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "buyer-verified",
          recipientEmail: updated.email,
          idempotencyKey: `buyer-verified-${updated.id}`,
          templateData: { companyName: updated.company_name || undefined },
        },
      }).catch((e) => console.warn("buyer-verified email failed:", e));
    }

    loadUsers();
    if (buyerDetail) setBuyerDetail({ ...buyerDetail, is_verified: true });
  }

  async function handleSuspend(userId: string | null) {
    if (!userId) return;
    const { error } = await supabase
      .from("customers")
      .update({ is_verified: false } as any)
      .eq("auth_user_id", userId);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Compte suspendu");
    logAdminAudit("customer.suspend", { targetId: userId, targetType: "auth_user" });
    loadUsers();
    if (buyerDetail) setBuyerDetail({ ...buyerDetail, is_verified: false });
  }

  async function handleDelete(user: UserRow) {
    setDeleteModal(user);
    setDeleteReason("");
  }

  async function confirmDelete() {
    if (!deleteModal) return;
    const table = deleteModal.type === "vendor" ? "vendors" : "customers";
    // Si on a un auth_user_id, on supprime via celui-ci ; sinon via la PK de la fiche
    const query = deleteModal.userId
      ? supabase.from(table).delete().eq("auth_user_id", deleteModal.userId)
      : supabase.from(table).delete().eq("id", deleteModal.id);
    const { error } = await query;
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Utilisateur supprimé");
    setDeleteModal(null);
    closeDetail();
    loadUsers();
  }

  async function handleImpersonate(user: UserRow) {
    if (!user.userId) {
      toast.error("Impossible : ce compte n'a pas d'accès auth.");
      return;
    }
    await startImpersonation(user.userId, user.email, user.type, user.company);
    setConfirmModal(null);
    setConfirmed(false);
    navigate(user.type === "vendor" ? "/vendor" : "/");
  }

  async function handleSendPasswordReset(user: UserRow) {
    if (!user.email) {
      toast.error("Impossible : aucune adresse email pour ce compte.");
      return;
    }
    setResettingId(user.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-send-password-reset", {
        body: { user_id: user.userId ?? undefined, email: user.email },
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || "Échec de l'envoi");
      toast.success(`Email de réinitialisation envoyé à ${user.email}`);
      logAdminAudit("customer.password_reset_sent", {
        targetId: user.userId ?? user.id,
        targetType: "auth_user",
        metadata: { email: user.email },
      });
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setResettingId(null);
    }
  }



  const filtered = users.filter(u => {
    if (typeFilter === "pending") { if (u.status !== "pending") return false; }
    else if (typeFilter !== "all" && u.type !== typeFilter) return false;
    if (profileFilter !== "all" && (u.profile || "—") !== profileFilter) return false;
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    if (linkedFilter === "linked" && !u.linked) return false;
    if (linkedFilter === "unlinked" && u.linked) return false;
    if (dateFrom && (!u.createdAt || u.createdAt < dateFrom)) return false;
    if (dateTo && (!u.createdAt || u.createdAt > dateTo + "T23:59:59")) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.company.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  const profileOptions = Array.from(new Set(users.map(u => u.profile).filter(Boolean) as string[])).sort();
  const activeFiltersCount = [
    typeFilter !== "all",
    profileFilter !== "all",
    statusFilter !== "all",
    linkedFilter !== "all",
    !!dateFrom,
    !!dateTo,
    !!search,
  ].filter(Boolean).length;

  function resetFilters() {
    setTypeFilter("all");
    setProfileFilter("all");
    setStatusFilter("all");
    setLinkedFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  }

  const vendorCount = users.filter(u => u.type === "vendor" && u.status === "active").length;
  const buyerCount = users.filter(u => u.type === "buyer" && u.status === "active").length;
  const pendingCount = users.filter(u => u.status === "pending").length;
  const unlinkedCount = users.filter(u => !u.linked).length;

  const DetailField = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={15} className="text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-foreground">{value || "—"}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Gestion des Utilisateurs</h1>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus size={16} /> Créer un utilisateur
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total utilisateurs" value={String(users.length)} icon={Users} iconColor="#1B5BDA" />
        <KpiCard label="Vendeurs actifs" value={String(vendorCount)} icon={Store} iconColor="#F59E0B" />
        <KpiCard label="Acheteurs validés" value={String(buyerCount)} icon={ShoppingBag} iconColor="#059669" />
        <button onClick={() => setTypeFilter("pending")} className="text-left">
          <KpiCard label="⏳ En attente" value={String(pendingCount)} icon={AlertTriangle} iconColor={pendingCount > 0 ? "#EF4444" : "#F59E0B"} />
        </button>
      </div>

      <div className="flex flex-col gap-3 bg-card border border-border rounded-lg p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Type</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 text-sm border border-border rounded-md bg-background">
              <option value="all">Tous</option>
              <option value="vendor">Vendeurs</option>
              <option value="buyer">Acheteurs</option>
              <option value="pending">🔴 En attente ({pendingCount})</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Profil</label>
            <select value={profileFilter} onChange={e => setProfileFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-md bg-background">
              <option value="all">Tous</option>
              {profileOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Statut</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 text-sm border border-border rounded-md bg-background">
              <option value="all">Tous</option>
              <option value="active">Actif</option>
              <option value="pending">En attente</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Accès auth</label>
            <select value={linkedFilter} onChange={e => setLinkedFilter(e.target.value as any)}
              className="px-3 py-2 text-sm border border-border rounded-md bg-background">
              <option value="all">Tous</option>
              <option value="linked">Compte créé</option>
              <option value="unlinked">Compte non créé</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Inscrit du</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-[38px]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">au</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-[38px]" />
          </div>
          <div className="relative flex-1 min-w-[220px]">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground block mb-1">Recherche</label>
            <Search size={16} className="absolute left-3 top-[34px] text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom ou email…" className="pl-9" />
          </div>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 h-[38px]">
              <X size={14} /> Réinitialiser ({activeFiltersCount})
            </Button>
          )}
        </div>
        <p className="text-[12px] text-muted-foreground">
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""} sur {users.length}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className={`bg-card rounded-lg border border-border overflow-x-auto transition-all ${selectedUser ? "flex-1" : "w-full"}`}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">Entreprise</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Profil</th>
                <th className="text-left px-4 py-3">Inscrit le</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Aucun utilisateur trouvé</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id}
                  onClick={() => openDetail(u)}
                  className={`border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer ${selectedUser?.id === u.id ? "bg-accent/40" : ""}`}>
                  <td className="px-4 py-3 font-semibold text-foreground">{u.company}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${u.type === "vendor" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                      {u.type === "vendor" ? "Vendeur" : "Acheteur"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-[12px]">{u.profile || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-[12px] whitespace-nowrap">
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={u.status === "active" ? "active" : u.status === "inactive" ? "cancelled" : "pending"} />
                      {!u.linked && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Compte non créé
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!u.linked ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-[11px] h-7"
                          onClick={(e) => { e.stopPropagation(); handleCreateAccess(u); }}
                        >
                          <UserCheck size={12} /> Créer l'accès
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-[11px] h-7"
                            disabled={resettingId === u.id}
                            title="Envoyer un email de réinitialisation du mot de passe"
                            onClick={(e) => { e.stopPropagation(); handleSendPasswordReset(u); }}
                          >
                            <KeyRound size={12} />
                            {resettingId === u.id ? "Envoi…" : "Reset mot de passe"}
                          </Button>
                          <ChevronRight size={16} className="inline text-muted-foreground" />
                        </>
                      )}
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        {selectedUser && (
          <div className="w-[420px] shrink-0 bg-card rounded-lg border border-border overflow-y-auto max-h-[calc(100vh-200px)]">
            {/* Header */}
            <div className="p-5 border-b border-border flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">{selectedUser.company}</h2>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${selectedUser.type === "vendor" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                    {selectedUser.type === "vendor" ? "Vendeur" : "Acheteur"}
                  </span>
                  <StatusBadge status={selectedUser.status === "active" ? "active" : selectedUser.status === "inactive" ? "cancelled" : "pending"} />
                  {buyerDetail?.profile?.preferred_language && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                      {LANG_FLAGS[buyerDetail.profile.preferred_language] || buyerDetail.profile.preferred_language}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={closeDetail} className="p-1 rounded hover:bg-accent">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            {/* Action Buttons */}
            {selectedUser.type === "buyer" && (
              <div className="p-4 border-b border-border space-y-2">
                {buyerDetail && !buyerDetail.is_verified ? (
                  <>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 mb-3">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">Ce compte est <strong>en attente de validation</strong>. Vérifiez les informations avant d'approuver.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleValidate(selectedUser.userId)} className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                        <UserCheck size={15} /> Valider le compte
                      </Button>
                      <Button onClick={() => handleDelete(selectedUser)} variant="destructive" className="gap-1.5">
                        <UserX size={15} /> Refuser
                      </Button>
                    </div>
                  </>
                ) : buyerDetail?.is_verified ? (
                  <div className="flex gap-2">
                    <Button onClick={() => handleSuspend(selectedUser.userId)} variant="outline" className="flex-1 gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50">
                      <Ban size={15} /> Suspendre
                    </Button>
                    <Button onClick={() => { setConfirmModal(selectedUser); setConfirmed(false); }} variant="outline" className="flex-1 gap-1.5">
                      <Eye size={15} /> Impersonner
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            {selectedUser.type === "vendor" && (
              <div className="p-4 border-b border-border">
                <div className="flex gap-2">
                  <Button onClick={() => navigate(`/admin/vendeurs/${selectedUser.id}`)} variant="outline" className="flex-1 gap-1.5">
                    <FileText size={15} /> Fiche vendeur
                  </Button>
                  <Button onClick={() => { setConfirmModal(selectedUser); setConfirmed(false); }} variant="outline" className="flex-1 gap-1.5">
                    <Eye size={15} /> Impersonner
                  </Button>
                </div>
              </div>
            )}

            {/* Buyer Details */}
            {selectedUser.type === "buyer" && (
              <div className="p-5">
                {detailLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
                ) : buyerDetail ? (
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Informations du compte</h3>
                    <DetailField icon={Building2} label="Entreprise" value={buyerDetail.company_name} />
                    <DetailField icon={Mail} label="Email" value={buyerDetail.email} />
                    <DetailField icon={Phone} label="Téléphone" value={buyerDetail.phone} />
                    <DetailField icon={FileText} label="N° TVA" value={buyerDetail.vat_number} />
                    <DetailField icon={MapPin} label="Adresse" value={[buyerDetail.address_line1, buyerDetail.postal_code, buyerDetail.city].filter(Boolean).join(", ")} />
                    <DetailField icon={MapPin} label="Pays" value={buyerDetail.country_code} />
                    <DetailField icon={Users} label="Type client" value={buyerDetail.customer_type} />
                    <DetailField icon={Calendar} label="Inscrit le" value={new Date(buyerDetail.created_at).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })} />

                    {buyerDetail.profile && (
                      <>
                        <div className="border-t border-border my-3" />
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Profil utilisateur</h3>
                        <DetailField icon={Users} label="Nom complet" value={buyerDetail.profile.full_name} />
                        <DetailField icon={Building2} label="Secteur" value={buyerDetail.profile.sector} />
                        <DetailField icon={MapPin} label="Pays (profil)" value={buyerDetail.profile.country} />
                        <DetailField icon={Clock} label="Niveau de prix" value={buyerDetail.profile.price_level_code} />
                      </>
                    )}

                    <div className="border-t border-border my-3" />
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Paramètres</h3>
                    <div className="flex items-center gap-2 py-1.5">
                      <Clock size={14} className="text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Délai de paiement</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            className="w-16 text-sm font-semibold border border-border rounded px-2 py-0.5 bg-background"
                            value={buyerDetail.payment_terms_days}
                            onChange={async (e) => {
                              const val = parseInt(e.target.value) || 0;
                              const { error } = await supabase
                                .from("customers")
                                .update({ payment_terms_days: val })
                                .eq("id", buyerDetail.id);
                              if (error) {
                                // Ne jamais afficher une valeur non écrite : on remonte l'erreur
                                // et on laisse l'état local sur la valeur réellement en base.
                                toast.error(`Délai de paiement non enregistré : ${error.message}`);
                                setBuyerDetail((prev: any) => prev ? { ...prev } : prev);
                                return;
                              }
                              toast.success(`Délai de paiement enregistré (${val} jours)`);
                              setBuyerDetail((prev: any) => prev ? { ...prev, payment_terms_days: val } : prev);
                            }}
                          />
                          <span className="text-sm text-muted-foreground">jours</span>
                        </div>
                      </div>
                    </div>
                    <DetailField icon={CheckCircle} label="Professionnel" value={buyerDetail.is_professional ? "Oui" : "Non"} />
                    <DetailField icon={CheckCircle} label="Vérifié" value={buyerDetail.is_verified ? "✅ Oui" : "❌ Non"} />

                    {/* Actions */}
                    <div className="border-t border-border my-4" />
                    <Button onClick={() => setEditProfileOpen(true)} variant="outline" size="sm" className="w-full gap-1.5 mb-2">
                      <UserCheck size={14} /> Éditer profil pro
                    </Button>
                    <Button onClick={() => handleDelete(selectedUser)} variant="ghost" size="sm" className="w-full text-destructive hover:bg-destructive/10 gap-1.5">
                      <Trash2 size={14} /> Supprimer définitivement
                    </Button>

                    <UserAuditTimeline customerId={buyerDetail.id} authUserId={selectedUser?.userId || null} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée trouvée</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Impersonation modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmModal(null)}>
          <div className="bg-card rounded-xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Impersonation — {confirmModal.company}</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Vous allez accéder à l'interface de <strong>{confirmModal.company}</strong> ({confirmModal.email}).
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800"><strong>Attention :</strong> les actions effectuées en mode shadow sont réelles.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="rounded" />
                <span className="text-sm text-foreground">Je comprends que mes actions seront enregistrées</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 p-6 border-t border-border">
              <Button variant="outline" onClick={() => setConfirmModal(null)}>Annuler</Button>
              <Button disabled={!confirmed} onClick={() => handleImpersonate(confirmModal)}>
                Accéder au compte
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Refuse modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteModal(null)}>
          <div className="bg-card rounded-xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Refuser / Supprimer — {deleteModal.company}</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Vous allez supprimer <strong>{deleteModal.company}</strong> ({deleteModal.email}).
              </p>

              {buyerDetail?.profile?.preferred_language && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 items-center">
                  <span className="text-lg">{buyerDetail.profile.preferred_language === "nl" ? "🇳🇱" : buyerDetail.profile.preferred_language === "en" ? "🇬🇧" : buyerDetail.profile.preferred_language === "de" ? "🇩🇪" : "🇫🇷"}</span>
                  <p className="text-sm text-blue-800">
                    Langue du destinataire : <strong>{LANG_FLAGS[buyerDetail.profile.preferred_language] || buyerDetail.profile.preferred_language}</strong>
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Motif du refus (optionnel)</label>
                <textarea
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  placeholder={buyerDetail?.profile?.preferred_language === "nl" ? "Schrijf hier de reden van weigering..." : buyerDetail?.profile?.preferred_language === "en" ? "Write the rejection reason here..." : "Écrivez ici le motif du refus..."}
                  className="w-full min-h-[100px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>

              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex gap-2">
                <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive"><strong>Attention :</strong> cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-6 border-t border-border">
              <Button variant="outline" onClick={() => setDeleteModal(null)}>Annuler</Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Confirmer la suppression
              </Button>
            </div>
          </div>
        </div>
      )}

      <UserCreateDialog open={showCreate} onOpenChange={setShowCreate} onCreated={loadUsers} />

      {editProfileOpen && buyerDetail && (
        <EditBuyerProfileDialog
          open={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
          customerId={buyerDetail.id}
          authUserId={buyerDetail.auth_user_id || null}
          onSaved={(patch) => setBuyerDetail((prev: any) => prev ? { ...prev, ...patch } : prev)}
        />
      )}
    </div>
  );
}