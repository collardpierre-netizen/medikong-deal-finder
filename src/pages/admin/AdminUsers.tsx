import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { Eye, MoreHorizontal, Users, Store, ShoppingBag, AlertTriangle, Search, Plus, Ban, CheckCircle, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UserCreateDialog from "@/components/admin/UserCreateDialog";

interface UserRow {
  id: string;
  userId: string;
  email: string;
  type: "vendor" | "buyer";
  company: string;
  plan: string;
  status: string;
  lastLogin: string | null;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "vendor" | "buyer" | "pending">("all");
  const [confirmModal, setConfirmModal] = useState<UserRow | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const { startImpersonation } = useImpersonation();
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const rows: UserRow[] = [];

    // Load vendors
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, auth_user_id, email, company_name, type, is_active")
      .order("company_name");

    vendors?.forEach(v => {
      if (v.auth_user_id) {
        rows.push({
          id: v.id,
          userId: v.auth_user_id,
          email: v.email || "",
          type: "vendor",
          company: v.company_name || v.id,
          plan: v.type || "real",
          status: v.is_active ? "active" : "inactive",
          lastLogin: null,
        });
      }
    });

    // Load customers as buyers
    const { data: customers } = await supabase
      .from("customers")
      .select("id, auth_user_id, email, company_name, customer_type")
      .order("company_name");

    customers?.forEach(b => {
      if (b.auth_user_id) {
        rows.push({
          id: b.id,
          userId: b.auth_user_id,
          email: b.email || "",
          type: "buyer",
          company: b.company_name,
          plan: b.customer_type || "pharmacy",
          status: (b as any).is_verified ? "active" : "pending",
          lastLogin: null,
        });
      }
    });

    setUsers(rows);
    setLoading(false);
  }

  const filtered = users.filter(u => {
    if (typeFilter === "pending") {
      if (u.status !== "pending") return false;
    } else if (typeFilter !== "all" && u.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.company.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  const vendorCount = users.filter(u => u.type === "vendor" && u.status === "active").length;
  const buyerCount = users.filter(u => u.type === "buyer" && u.status === "active").length;
  const pendingCount = users.filter(u => u.status === "pending").length;
  const suspendedCount = users.filter(u => u.status === "suspended" || u.status === "inactive").length;

  async function handleImpersonate(user: UserRow) {
    await startImpersonation(user.userId, user.email, user.type, user.company);
    setConfirmModal(null);
    setConfirmed(false);
    const target = user.type === "vendor" ? "/vendor" : "/";
    if (openInNewTab) {
      window.open(target, "_blank");
    } else {
      navigate(target);
    }
  }

  async function handleToggleStatus(user: UserRow) {
    const newStatus = user.status === "active" ? false : true;
    const table = user.type === "vendor" ? "vendors" : "customers";
    
    if (user.type === "vendor") {
      const { error } = await supabase
        .from("vendors")
        .update({ is_active: newStatus } as any)
        .eq("auth_user_id", user.userId);
      if (error) { toast.error("Erreur: " + error.message); return; }
    } else {
      const { error } = await supabase
        .from("customers")
        .update({ is_verified: newStatus } as any)
        .eq("auth_user_id", user.userId);
      if (error) { toast.error("Erreur: " + error.message); return; }
    }
    toast.success(newStatus ? "Compte activé" : "Compte suspendu");
    loadUsers();
  }

  async function handleDelete(user: UserRow) {
    if (!window.confirm(`Supprimer définitivement ${user.company} (${user.email}) ? Cette action est irréversible.`)) return;
    
    const table = user.type === "vendor" ? "vendors" : "customers";
    if (user.type === "vendor") {
      const { error } = await supabase.from("vendors").delete().eq("auth_user_id", user.userId);
      if (error) { toast.error("Erreur: " + error.message); return; }
    } else {
      const { error } = await supabase.from("customers").delete().eq("auth_user_id", user.userId);
      if (error) { toast.error("Erreur: " + error.message); return; }
    }
    toast.success("Utilisateur supprimé");
    loadUsers();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1D2530]">Gestion des Utilisateurs</h1>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus size={16} /> Créer un utilisateur
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total utilisateurs" value={String(users.length)} icon={Users} iconColor="#1B5BDA" />
        <KpiCard label="Vendeurs actifs" value={String(vendorCount)} icon={Store} iconColor="#F59E0B" />
        <KpiCard label="Acheteurs actifs" value={String(buyerCount)} icon={ShoppingBag} iconColor="#059669" />
        <KpiCard label="En attente" value={String(pendingCount)} icon={AlertTriangle} iconColor="#F59E0B" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="px-3 py-2 text-sm border border-[#E2E8F0] rounded-md bg-white">
          <option value="all">Tous</option>
          <option value="vendor">Vendeurs</option>
          <option value="buyer">Acheteurs</option>
          <option value="pending">En attente</option>
        </select>
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom ou email…" className="pl-9" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#8B95A5] uppercase tracking-wide">
              <th className="text-left px-4 py-3">Entreprise</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#8B95A5]">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#8B95A5]">Aucun utilisateur trouvé</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                <td className="px-4 py-3 font-semibold text-[#1D2530]">{u.company}</td>
                <td className="px-4 py-3 text-[#616B7C]">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${u.type === "vendor" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                    {u.type === "vendor" ? "Vendeur" : "Acheteur"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F1F5F9] text-[#616B7C] capitalize">{u.plan}</span>
                </td>
                <td className="px-4 py-3"><StatusBadge status={u.status === "active" ? "active" : "pending"} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { setConfirmModal(u); setConfirmed(false); setOpenInNewTab(false); }}
                      className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#8B95A5] hover:text-[#1B5BDA] transition-colors" title="Voir comme ce user">
                      <Eye size={16} />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#8B95A5] hover:text-[#616B7C] transition-colors" title="Plus d'actions">
                          <MoreHorizontal size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleToggleStatus(u)} className="gap-2">
                          {u.status === "active" ? <><Ban size={14} className="text-amber-500" /> Suspendre</> : <><CheckCircle size={14} className="text-emerald-500" /> Réactiver</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(u)} className="gap-2 text-destructive focus:text-destructive">
                          <Trash2 size={14} /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#E2E8F0]">
              <h2 className="text-lg font-bold text-[#1D2530]">Impersonation — {confirmModal.company}</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#616B7C]">
                Vous allez accéder à l'interface de <strong>{confirmModal.company}</strong> ({confirmModal.email}).
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800"><strong>Attention :</strong> les actions effectuées en mode shadow sont réelles.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="rounded border-[#E2E8F0] text-[#1B5BDA]" />
                <span className="text-sm text-[#1D2530]">Je comprends que mes actions seront enregistrées</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 p-6 border-t border-[#E2E8F0]">
              <button onClick={() => setConfirmModal(null)} className="px-4 py-2 text-sm rounded-md border border-[#E2E8F0] hover:bg-[#F8FAFC]">Annuler</button>
              <button disabled={!confirmed} onClick={() => handleImpersonate(confirmModal)}
                className="px-4 py-2 text-sm rounded-md text-white font-medium disabled:opacity-40 transition-colors"
                style={{ backgroundColor: confirmed ? "#1B5BDA" : "#94A3B8" }}>
                Accéder au compte
              </button>
            </div>
          </div>
        </div>
      )}
      <UserCreateDialog open={showCreate} onOpenChange={setShowCreate} onCreated={loadUsers} />
    </div>
  );
}