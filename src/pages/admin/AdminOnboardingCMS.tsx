import { useState } from "react";
import { Plus, Save, X, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

// Stub: onboarding_testimonials table was removed in V5 migration.
// This page now manages testimonials via local state until a CMS table is re-added.

interface Testimonial {
  id: string;
  photo_url: string | null;
  quote: string;
  name: string;
  title: string;
  gradient: string;
  role_visibility: "buyer" | "seller" | "both";
  sort_order: number;
  is_active: boolean;
}

const gradientPresets = [
  { label: "Navy", value: "linear-gradient(135deg, #1a365d, #2d3748, #1a202c)" },
  { label: "Emerald", value: "linear-gradient(135deg, #064e3b, #1e3a5f, #1a202c)" },
  { label: "Purple", value: "linear-gradient(135deg, #4c1d95, #1e3a5f, #1a202c)" },
  { label: "Amber", value: "linear-gradient(135deg, #7c2d12, #1e3a5f, #1a202c)" },
];

const roleLabels: Record<string, string> = { buyer: "Acheteur", seller: "Vendeur", both: "Les deux" };
const roleBadgeColors: Record<string, string> = {
  buyer: "bg-blue-50 text-blue-700 border-blue-200",
  seller: "bg-emerald-50 text-emerald-700 border-emerald-200",
  both: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function AdminOnboardingCMS() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Partial<Testimonial>>({});

  const openEdit = (t: Testimonial) => { setForm({ ...t }); setEditing(t); setCreating(false); };
  const openCreate = () => {
    setForm({ quote: "", name: "", title: "", gradient: gradientPresets[0].value, role_visibility: "both", sort_order: testimonials.length, is_active: true, photo_url: null });
    setCreating(true); setEditing(null);
  };
  const closeForm = () => { setEditing(null); setCreating(false); setForm({}); };

  const handleSave = () => {
    if (!form.quote || !form.name || !form.title) return;
    if (editing) {
      setTestimonials(prev => prev.map(t => t.id === editing.id ? { ...t, ...form } as Testimonial : t));
    } else {
      setTestimonials(prev => [...prev, { ...form, id: crypto.randomUUID() } as Testimonial]);
    }
    toast.success("Testimonial sauvegardé (local)");
    closeForm();
  };

  const handleDelete = (id: string) => {
    if (confirm("Supprimer ce testimonial ?")) {
      setTestimonials(prev => prev.filter(t => t.id !== id));
      toast.success("Testimonial supprimé");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-mk-navy">Onboarding — Testimonials</h1>
          <p className="text-sm text-mk-sec">Gérez les témoignages affichés sur la page d'inscription.</p>
        </div>
        <button onClick={openCreate} className="bg-mk-navy text-white text-sm font-semibold px-4 py-2 rounded-md flex items-center gap-2 hover:opacity-90">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", count: testimonials.length },
          { label: "Acheteurs", count: testimonials.filter(t => t.role_visibility === "buyer" || t.role_visibility === "both").length },
          { label: "Vendeurs", count: testimonials.filter(t => t.role_visibility === "seller" || t.role_visibility === "both").length },
        ].map(s => (
          <div key={s.label} className="bg-white border border-mk-line rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-mk-navy">{s.count}</div>
            <div className="text-xs text-mk-sec">{s.label}</div>
          </div>
        ))}
      </div>

      {(editing || creating) && (
        <div className="bg-white border border-mk-line rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-mk-navy">{creating ? "Nouveau testimonial" : "Modifier"}</h3>
            <button onClick={closeForm} className="text-mk-sec hover:text-mk-navy"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-mk-sec mb-1 block">Nom *</label>
                <input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-mk-sec mb-1 block">Titre / Poste *</label>
                <input value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-mk-sec mb-1 block">Visibilité</label>
                <div className="flex gap-2">
                  {(["buyer", "seller", "both"] as const).map(r => (
                    <button key={r} onClick={() => setForm(f => ({ ...f, role_visibility: r }))}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border ${form.role_visibility === r ? "bg-mk-navy text-white border-mk-navy" : "border-mk-line text-mk-sec"}`}>
                      {roleLabels[r]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-mk-sec mb-1 block">Citation *</label>
                <textarea value={form.quote || ""} onChange={e => setForm(f => ({ ...f, quote: e.target.value }))} rows={4} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="text-xs text-mk-sec mb-1 block">Gradient de fond</label>
                <div className="flex gap-2 flex-wrap">
                  {gradientPresets.map(g => (
                    <button key={g.label} onClick={() => setForm(f => ({ ...f, gradient: g.value }))}
                      className={`w-8 h-8 rounded-md border-2 ${form.gradient === g.value ? "border-mk-navy" : "border-transparent"}`}
                      style={{ background: g.value }} title={g.label} />
                  ))}
                </div>
              </div>
              <div className="rounded-lg p-4 text-white text-xs" style={{ background: form.gradient || gradientPresets[0].value }}>
                <p className="italic mb-2">« {form.quote || "..."} »</p>
                <p className="font-bold">{form.name || "Nom"}</p>
                <p className="opacity-60">{form.title || "Titre"}</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={closeForm} className="text-sm text-mk-sec px-4 py-2 border border-mk-line rounded-md">Annuler</button>
            <button onClick={handleSave} disabled={!form.quote || !form.name || !form.title}
              className="bg-mk-navy text-white text-sm font-semibold px-4 py-2 rounded-md flex items-center gap-2 disabled:opacity-50">
              <Save size={14} /> Sauvegarder
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-mk-line rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mk-alt border-b border-mk-line text-xs text-mk-sec">
              <th className="text-left py-2.5 px-4 font-medium w-8">#</th>
              <th className="text-left py-2.5 px-4 font-medium">Nom</th>
              <th className="text-left py-2.5 px-4 font-medium">Titre</th>
              <th className="text-left py-2.5 px-4 font-medium">Visibilité</th>
              <th className="text-center py-2.5 px-4 font-medium">Actif</th>
              <th className="text-right py-2.5 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {testimonials.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-mk-sec text-xs">Aucun testimonial. Cliquez "Ajouter" pour commencer.</td></tr>
            )}
            {testimonials.map(t => (
              <tr key={t.id} className="border-b border-mk-line last:border-0 hover:bg-mk-alt/50">
                <td className="py-3 px-4 text-mk-ter">{t.sort_order}</td>
                <td className="py-3 px-4 font-medium text-mk-navy">{t.name}</td>
                <td className="py-3 px-4 text-mk-sec text-xs">{t.title}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${roleBadgeColors[t.role_visibility]}`}>
                    {roleLabels[t.role_visibility]}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  {t.is_active ? <Eye size={14} className="text-mk-green mx-auto" /> : <EyeOff size={14} className="text-mk-ter mx-auto" />}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(t)} className="text-mk-sec hover:text-mk-blue"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(t.id)} className="text-mk-sec hover:text-mk-red"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}