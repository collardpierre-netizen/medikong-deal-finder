import { useState, useMemo, useEffect } from "react";
import EinvoicingSettingsCard from "@/components/shared/EinvoicingSettingsCard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { toast } from "sonner";
import { Search, Save, X, Plus, Trash2, Star } from "lucide-react";
import { COUNTRY_OPTIONS } from "@/lib/countries-iso";

type Customer = {
  id: string;
  company_name: string;
  email: string;
  customer_type: string;
  vat_number: string | null;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postal_code: string;
  country_code: string;
  is_verified: boolean;
  is_professional: boolean;
  created_at: string;
};

type ShippingAddress = {
  id: string;
  customer_id: string;
  label: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address_l1: string;
  address_l2: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string;
  is_default: boolean;
  notes: string | null;
};

const COUNTRIES = COUNTRY_OPTIONS;

// Typologie complète des clients (alignée sur l'enum DB customer_type).
// Pour ajouter un nouveau type : étendre l'enum DB + cette liste.
export const CUSTOMER_TYPE_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "pharmacy",     label: "Pharmacie",          color: "#1B5BDA" },
  { value: "wholesaler",   label: "Grossiste",          color: "#7C3AED" },
  { value: "hospital",     label: "Hôpital",            color: "#EF4444" },
  { value: "clinic",       label: "Clinique",           color: "#F59E0B" },
  { value: "doctor",       label: "Médecin",            color: "#059669" },
  { value: "dentist",      label: "Dentiste",           color: "#14B8A6" },
  { value: "veterinary",   label: "Vétérinaire",        color: "#0EA5E9" },
  { value: "nursing_home", label: "MR/MRS (maison de repos)", color: "#EC4899" },
  { value: "retail",       label: "Retail",                   color: "#F97316" },
  { value: "lab",          label: "Laboratoire",        color: "#8B5CF6" },
  { value: "other",        label: "Autre",              color: "#8B95A5" },
];
const TYPES = CUSTOMER_TYPE_OPTIONS.map((o) => o.value);
const TYPE_LABEL = Object.fromEntries(CUSTOMER_TYPE_OPTIONS.map((o) => [o.value, o.label]));
const TYPE_COLOR = Object.fromEntries(CUSTOMER_TYPE_OPTIONS.map((o) => [o.value, o.color]));

export default function AdminCustomers() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<Partial<Customer> | null>(null);

  const emptyCustomer = (): Partial<Customer> => ({
    company_name: "",
    email: "",
    customer_type: "pharmacy",
    vat_number: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postal_code: "",
    country_code: "BE",
    is_verified: false,
    is_professional: true,
  });

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });

  // Auto-sélection via ?id=...
  useEffect(() => {
    const id = searchParams.get("id");
    if (id && customers.length && id !== selectedId) {
      const c = customers.find((x) => x.id === id);
      if (c) {
        setSelectedId(id);
        setForm({ ...c });
        // Scroll vers le bloc shipping si #shipping est présent
        if (window.location.hash === "#shipping") {
          setTimeout(() => {
            document.getElementById("shipping-block")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 200);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.company_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        (c.vat_number || "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  const selected = customers.find((c) => c.id === selectedId) || null;

  const handleSelect = (c: Customer) => {
    setIsCreating(false);
    setSelectedId(c.id);
    setForm({ ...c });
    setSearchParams((sp) => { sp.set("id", c.id); return sp; }, { replace: true });
  };

  const updateMut = useMutation({
    mutationFn: async (payload: Partial<Customer> & { id: string }) => {
      const { id, ...patch } = payload;
      const { error } = await supabase.from("customers").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche customer mise à jour");
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (e: any) => toast.error(e?.message || "Échec de la mise à jour"),
  });

  const createMut = useMutation({
    mutationFn: async (payload: Partial<Customer>) => {
      const { data, error } = await supabase.from("customers").insert(payload as any).select("*").single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: (newCustomer) => {
      toast.success("Client créé");
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      setIsCreating(false);
      setSelectedId(newCustomer.id);
      setForm({ ...newCustomer });
      setSearchParams((sp) => { sp.set("id", newCustomer.id); return sp; }, { replace: true });
    },
    onError: (e: any) => toast.error(e?.message || "Échec de la création"),
  });

  const handleSave = () => {
    if (!form) return;
    if (!form.company_name?.trim()) return toast.error("Raison sociale requise");
    if (!form.email?.trim()) return toast.error("Email requis");
    if (!form.address_line1?.trim() || !form.city?.trim()) {
      return toast.error("Adresse et ville requises");
    }
    const payload = {
      company_name: form.company_name?.trim(),
      email: form.email?.trim().toLowerCase(),
      customer_type: form.customer_type || "pharmacy",
      vat_number: form.vat_number?.trim() || null,
      phone: form.phone?.trim() || null,
      address_line1: form.address_line1?.trim(),
      address_line2: form.address_line2?.trim() || null,
      city: form.city?.trim(),
      postal_code: form.postal_code?.trim() || null,
      country_code: form.country_code || "BE",
      is_verified: !!form.is_verified,
      is_professional: !!form.is_professional,
    };
    if (isCreating) {
      createMut.mutate(payload);
    } else if (form.id) {
      updateMut.mutate({ id: form.id, ...payload } as any);
    }
  };

  return (
    <div className="space-y-4">
      <AdminTopBar title="Customers" subtitle="Fiches acheteurs B2B (TVA, coordonnées, sites de livraison)" />

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        {/* List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-200 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (nom, email, TVA)..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <button
              onClick={() => {
                setIsCreating(true);
                setSelectedId(null);
                setForm(emptyCustomer());
                setSearchParams((sp) => { sp.delete("id"); return sp; }, { replace: true });
              }}
              className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-1.5"
            >
              <Plus size={14} /> Nouveau client
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {isLoading && <div className="p-4 text-sm text-slate-500">Chargement...</div>}
            {!isLoading && filtered.length === 0 && (
              <div className="p-4 text-sm text-slate-500">Aucun customer.</div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                className={`w-full text-left px-3 py-2.5 border-b border-slate-100 hover:bg-slate-50 ${
                  selectedId === c.id ? "bg-blue-50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-900 truncate">{c.company_name}</div>
                  {c.customer_type && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        color: TYPE_COLOR[c.customer_type] || "#8B95A5",
                        backgroundColor: (TYPE_COLOR[c.customer_type] || "#8B95A5") + "1A",
                      }}
                    >
                      {TYPE_LABEL[c.customer_type] || c.customer_type}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {c.email} · {c.country_code}
                </div>
                <div className="text-xs text-slate-400">TVA : {c.vat_number || "—"}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail / Edit */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            {(!selected && !isCreating) || !form ? (
              <div className="text-sm text-slate-500">Sélectionnez un customer à gauche pour l'éditer, ou cliquez sur « Nouveau client » pour en créer un.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{isCreating ? "Nouveau client" : selected?.company_name}</h2>
                    {!isCreating && selected && <p className="text-xs text-slate-500">ID : {selected.id}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setSelectedId(null);
                        setForm(null);
                        setSearchParams((sp) => { sp.delete("id"); return sp; }, { replace: true });
                      }}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <X size={14} /> Fermer
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={updateMut.isPending || createMut.isPending}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Save size={14} /> {createMut.isPending ? "Création..." : updateMut.isPending ? "Sauvegarde..." : isCreating ? "Créer" : "Sauvegarder"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Raison sociale *">
                    <input value={form.company_name || ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} maxLength={200} className="input" />
                  </Field>
                  <Field label="Email *">
                    <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} className="input" />
                  </Field>
                  <Field label="N° TVA intracommunautaire">
                    <input value={form.vat_number || ""} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} placeholder="BE0123456789" maxLength={32} className="input" />
                  </Field>
                  <Field label="Téléphone">
                    <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={32} className="input" />
                  </Field>
                  <Field label="Type">
                    <select value={form.customer_type || "pharmacy"} onChange={(e) => setForm({ ...form, customer_type: e.target.value })} className="input">
                      {CUSTOMER_TYPE_OPTIONS.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                    </select>
                  </Field>
                  <Field label="Pays">
                    <select value={form.country_code || "BE"} onChange={(e) => setForm({ ...form, country_code: e.target.value })} className="input">
                      {COUNTRIES.map((c) => (<option key={c.code} value={c.code}>{c.name} ({c.code})</option>))}
                    </select>
                  </Field>
                  <Field label="Adresse facturation ligne 1 *" full>
                    <input value={form.address_line1 || ""} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} maxLength={200} className="input" />
                  </Field>
                  <Field label="Adresse facturation ligne 2" full>
                    <input value={form.address_line2 || ""} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} maxLength={200} className="input" />
                  </Field>
                  <Field label="Code postal">
                    <input value={form.postal_code || ""} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} maxLength={16} className="input" placeholder="Optionnel (certains pays n'en ont pas)" />
                  </Field>
                  <Field label="Ville *">
                    <input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={120} className="input" />
                  </Field>
                  <Field label="Vérifié">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!form.is_verified} onChange={(e) => setForm({ ...form, is_verified: e.target.checked })} />
                      Customer vérifié
                    </label>
                  </Field>
                  <Field label="Professionnel">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!form.is_professional} onChange={(e) => setForm({ ...form, is_professional: e.target.checked })} />
                      Compte professionnel
                    </label>
                  </Field>
                </div>
              </div>
            )}
          </div>

          {selected && !isCreating && <EinvoicingSettingsCard customerId={selected.id} variant="admin" />}

          {selected && <ShippingAddressesBlock customerId={selected.id} defaultCountry={selected.country_code || "BE"} />}
        </div>
      </div>

      <style>{`
        .input { width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; background: white; }
        .input:focus { outline: none; box-shadow: 0 0 0 2px rgba(59,130,246,0.4); border-color: #3b82f6; }
      `}</style>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

// =========================================================================
// Shipping addresses (multi-sites de livraison par customer)
// =========================================================================

function emptyAddress(customerId: string, defaultCountry: string): Partial<ShippingAddress> {
  return {
    customer_id: customerId,
    label: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    address_l1: "",
    address_l2: "",
    postal_code: "",
    city: "",
    country_code: defaultCountry,
    is_default: false,
    notes: "",
  };
}

function ShippingAddressesBlock({ customerId, defaultCountry }: { customerId: string; defaultCountry: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<ShippingAddress> | null>(null);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["admin-customer-shipping-addresses", customerId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_shipping_addresses")
        .select("*")
        .eq("customer_id", customerId)
        .order("is_default", { ascending: false })
        .order("label", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ShippingAddress[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-customer-shipping-addresses", customerId] });

  const saveMut = useMutation({
    mutationFn: async (a: Partial<ShippingAddress>) => {
      if (!a.label?.trim()) throw new Error("Libellé requis (ex. « Pharmacie centre »)");
      if (!a.address_l1?.trim()) throw new Error("Adresse ligne 1 requise");
      const payload: any = {
        customer_id: customerId,
        label: a.label.trim(),
        contact_name: a.contact_name?.trim() || null,
        contact_phone: a.contact_phone?.trim() || null,
        contact_email: a.contact_email?.trim() || null,
        address_l1: a.address_l1.trim(),
        address_l2: a.address_l2?.trim() || null,
        postal_code: a.postal_code?.trim() || null,
        city: a.city?.trim() || null,
        country_code: a.country_code || defaultCountry,
        notes: a.notes?.trim() || null,
      };
      // Gestion du flag is_default : on n'envoie pas is_default ici pour éviter conflit unique index
      if (a.id) {
        const { error } = await (supabase as any).from("customer_shipping_addresses").update(payload).eq("id", a.id);
        if (error) throw error;
        return a.id as string;
      } else {
        const { data, error } = await (supabase as any).from("customer_shipping_addresses").insert(payload).select("id").single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (id, vars) => {
      toast.success(vars.id ? "Adresse mise à jour" : "Adresse ajoutée");
      setEditing(null);
      invalidate();
      // si user a coché par défaut au moment du save, on applique séparément
      if (vars.is_default) setDefaultMut.mutate(id);
    },
    onError: (e: any) => toast.error(e?.message || "Échec"),
  });

  const setDefaultMut = useMutation({
    mutationFn: async (id: string) => {
      // Démarque tout, puis marque celui-ci. Unique index garantit qu'on ne casse rien.
      const { error: e1 } = await (supabase as any).from("customer_shipping_addresses").update({ is_default: false }).eq("customer_id", customerId).neq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await (supabase as any).from("customer_shipping_addresses").update({ is_default: true }).eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Adresse par défaut mise à jour");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Échec"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("customer_shipping_addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adresse supprimée");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Échec"),
  });

  return (
    <div id="shipping-block" className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Sites de livraison</h3>
          <p className="text-xs text-slate-500">Plusieurs adresses possibles. L'adresse marquée ⭐ est sélectionnée par défaut sur les commandes.</p>
        </div>
        <button
          onClick={() => setEditing(emptyAddress(customerId, defaultCountry))}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5"
        >
          <Plus size={14} /> Ajouter un site
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">Chargement…</div>
      ) : addresses.length === 0 ? (
        <div className="text-sm text-slate-500 italic">Aucun site de livraison enregistré.</div>
      ) : (
        <div className="space-y-2">
          {addresses.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 p-3 border border-slate-100 rounded-md hover:bg-slate-50">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{a.label}</span>
                  {a.is_default && <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Par défaut</span>}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {a.address_l1}{a.address_l2 ? `, ${a.address_l2}` : ""} · {a.postal_code} {a.city} ({a.country_code})
                </div>
                {(a.contact_name || a.contact_phone || a.contact_email) && (
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {[a.contact_name, a.contact_phone, a.contact_email].filter(Boolean).join(" · ")}
                  </div>
                )}
                {a.notes && <div className="text-[11px] text-slate-400 mt-0.5 italic">{a.notes}</div>}
              </div>
              <div className="flex items-center gap-1">
                {!a.is_default && (
                  <button
                    onClick={() => setDefaultMut.mutate(a.id)}
                    title="Définir par défaut"
                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                  >
                    <Star size={14} />
                  </button>
                )}
                <button
                  onClick={() => setEditing(a)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-white"
                >
                  Éditer
                </button>
                <button
                  onClick={() => { if (confirm(`Supprimer le site « ${a.label} » ?`)) deleteMut.mutate(a.id); }}
                  title="Supprimer"
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h4 className="text-sm font-semibold mb-3">{editing.id ? "Modifier l'adresse" : "Nouvelle adresse de livraison"}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Libellé * (ex. Officine centre)">
              <input value={editing.label || ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} maxLength={120} className="input" />
            </Field>
            <Field label="Contact (nom)">
              <input value={editing.contact_name || ""} onChange={(e) => setEditing({ ...editing, contact_name: e.target.value })} maxLength={120} className="input" />
            </Field>
            <Field label="Téléphone contact">
              <input value={editing.contact_phone || ""} onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })} maxLength={32} className="input" />
            </Field>
            <Field label="Email contact">
              <input type="email" value={editing.contact_email || ""} onChange={(e) => setEditing({ ...editing, contact_email: e.target.value })} maxLength={255} className="input" />
            </Field>
            <Field label="Adresse ligne 1 *" full>
              <input value={editing.address_l1 || ""} onChange={(e) => setEditing({ ...editing, address_l1: e.target.value })} maxLength={200} className="input" />
            </Field>
            <Field label="Adresse ligne 2" full>
              <input value={editing.address_l2 || ""} onChange={(e) => setEditing({ ...editing, address_l2: e.target.value })} maxLength={200} className="input" />
            </Field>
            <Field label="Code postal">
              <input value={editing.postal_code || ""} onChange={(e) => setEditing({ ...editing, postal_code: e.target.value })} maxLength={16} className="input" />
            </Field>
            <Field label="Ville">
              <input value={editing.city || ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} maxLength={120} className="input" />
            </Field>
            <Field label="Pays">
              <select value={editing.country_code || defaultCountry} onChange={(e) => setEditing({ ...editing, country_code: e.target.value })} className="input">
                {COUNTRIES.map((c) => (<option key={c.code} value={c.code}>{c.name} ({c.code})</option>))}
              </select>
            </Field>
            <Field label="Par défaut">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editing.is_default} onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })} />
                Utiliser comme adresse par défaut
              </label>
            </Field>
            <Field label="Notes internes" full>
              <textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} maxLength={500} rows={2} className="input" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50">Annuler</button>
            <button
              onClick={() => saveMut.mutate(editing)}
              disabled={saveMut.isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMut.isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
