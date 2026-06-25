import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { toast } from "sonner";
import { Search, Save, X } from "lucide-react";

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

const COUNTRIES = ["BE", "FR", "LU", "NL", "DE"];
const TYPES = ["pharmacy", "parapharmacy", "hospital", "wholesaler", "other"];

export default function AdminCustomers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Customer> | null>(null);

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
    setSelectedId(c.id);
    setForm({ ...c });
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

  const handleSave = () => {
    if (!form?.id) return;
    if (!form.company_name?.trim()) return toast.error("Raison sociale requise");
    if (!form.email?.trim()) return toast.error("Email requis");
    if (!form.address_line1?.trim() || !form.city?.trim() || !form.postal_code?.trim()) {
      return toast.error("Adresse, ville et code postal requis");
    }
    updateMut.mutate({
      id: form.id,
      company_name: form.company_name?.trim(),
      email: form.email?.trim().toLowerCase(),
      customer_type: form.customer_type,
      vat_number: form.vat_number?.trim() || null,
      phone: form.phone?.trim() || null,
      address_line1: form.address_line1?.trim(),
      address_line2: form.address_line2?.trim() || null,
      city: form.city?.trim(),
      postal_code: form.postal_code?.trim(),
      country_code: form.country_code,
      is_verified: !!form.is_verified,
      is_professional: !!form.is_professional,
    } as any);
  };

  return (
    <div className="space-y-4">
      <AdminTopBar title="Customers" subtitle="Fiches acheteurs B2B (TVA, coordonnées)" />

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        {/* List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (nom, email, TVA)..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
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
                <div className="text-sm font-medium text-slate-900">{c.company_name}</div>
                <div className="text-xs text-slate-500">
                  {c.email} · {c.country_code}
                </div>
                <div className="text-xs text-slate-400">TVA : {c.vat_number || "—"}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail / Edit */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {!selected || !form ? (
            <div className="text-sm text-slate-500">Sélectionnez un customer à gauche pour l'éditer.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selected.company_name}</h2>
                  <p className="text-xs text-slate-500">ID : {selected.id}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedId(null);
                      setForm(null);
                    }}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <X size={14} /> Fermer
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={updateMut.isPending}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Save size={14} /> {updateMut.isPending ? "Sauvegarde..." : "Sauvegarder"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Raison sociale *">
                  <input
                    value={form.company_name || ""}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    maxLength={200}
                    className="input"
                  />
                </Field>
                <Field label="Email *">
                  <input
                    type="email"
                    value={form.email || ""}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    maxLength={255}
                    className="input"
                  />
                </Field>
                <Field label="N° TVA">
                  <input
                    value={form.vat_number || ""}
                    onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
                    placeholder="BE0123456789"
                    maxLength={32}
                    className="input"
                  />
                </Field>
                <Field label="Téléphone">
                  <input
                    value={form.phone || ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    maxLength={32}
                    className="input"
                  />
                </Field>
                <Field label="Type">
                  <select
                    value={form.customer_type || "pharmacy"}
                    onChange={(e) => setForm({ ...form, customer_type: e.target.value })}
                    className="input"
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Pays">
                  <select
                    value={form.country_code || "BE"}
                    onChange={(e) => setForm({ ...form, country_code: e.target.value })}
                    className="input"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Adresse ligne 1 *" full>
                  <input
                    value={form.address_line1 || ""}
                    onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
                    maxLength={200}
                    className="input"
                  />
                </Field>
                <Field label="Adresse ligne 2" full>
                  <input
                    value={form.address_line2 || ""}
                    onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
                    maxLength={200}
                    className="input"
                  />
                </Field>
                <Field label="Code postal *">
                  <input
                    value={form.postal_code || ""}
                    onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                    maxLength={16}
                    className="input"
                  />
                </Field>
                <Field label="Ville *">
                  <input
                    value={form.city || ""}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    maxLength={120}
                    className="input"
                  />
                </Field>
                <Field label="Vérifié">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!form.is_verified}
                      onChange={(e) => setForm({ ...form, is_verified: e.target.checked })}
                    />
                    Customer vérifié
                  </label>
                </Field>
                <Field label="Professionnel">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!form.is_professional}
                      onChange={(e) => setForm({ ...form, is_professional: e.target.checked })}
                    />
                    Compte professionnel
                  </label>
                </Field>
              </div>

              <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
                Note : la gestion multi-sites de livraison n'est pas encore disponible.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.375rem;
          background: white;
        }
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
