import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Search, User, MapPin, Tag, Eye, EyeOff, Loader2, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type Delegate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  delegate_type: "commercial" | "contact_referent";
  zones: string[];
  specialties: string[];
  bio: string | null;
  is_visible: boolean;
  created_at: string;
};

type Assignment = {
  id: string;
  delegate_id: string;
  entity_type: "brand" | "manufacturer" | "vendor";
  entity_id: string;
  is_primary: boolean;
};

const ZONES = ["Bruxelles", "Wallonie", "Flandre", "Luxembourg", "Liège", "Namur", "Hainaut", "Anvers", "Gand"];

const AdminDelegues = () => {
  const [search, setSearch] = useState("");
  const [editDelegate, setEditDelegate] = useState<Delegate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: delegates = [], isLoading } = useQuery({
    queryKey: ["admin-delegates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegates")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as Delegate[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["admin-delegate-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegate_assignments")
        .select("*");
      if (error) throw error;
      return data as Assignment[];
    },
  });

  const filtered = delegates.filter(d =>
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const countAssignments = (id: string) => assignments.filter(a => a.delegate_id === id).length;

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce délégué ?")) return;
    const { error } = await supabase.from("delegates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Délégué supprimé");
      queryClient.invalidateQueries({ queryKey: ["admin-delegates"] });
    }
  };

  const handleToggleVisibility = async (d: Delegate) => {
    const { error } = await supabase.from("delegates").update({ is_visible: !d.is_visible } as any).eq("id", d.id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["admin-delegates"] });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <AdminTopBar title="Délégués" subtitle={`${delegates.length} délégué(s)`} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <button
            onClick={() => { setEditDelegate(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Aucun délégué trouvé</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(d => (
              <div key={d.id} className="border border-border rounded-xl p-4 bg-card space-y-3 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  {d.photo_url ? (
                    <img src={d.photo_url} alt={d.full_name} className="w-12 h-12 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <User size={20} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{d.full_name}</div>
                    <Badge variant={d.delegate_type === "commercial" ? "default" : "secondary"} className="text-[10px] mt-0.5">
                      {d.delegate_type === "commercial" ? "Commercial" : "Contact référent"}
                    </Badge>
                  </div>
                  <button onClick={() => handleToggleVisibility(d)} title={d.is_visible ? "Masquer" : "Rendre visible"}>
                    {d.is_visible ? <Eye size={16} className="text-emerald-600" /> : <EyeOff size={16} className="text-muted-foreground" />}
                  </button>
                </div>

                {d.email && <div className="text-xs text-muted-foreground truncate">📧 {d.email}</div>}
                {d.phone && <div className="text-xs text-muted-foreground">📞 {d.phone}</div>}

                {d.zones.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <MapPin size={12} className="text-muted-foreground" />
                    {d.zones.map(z => <Badge key={z} variant="outline" className="text-[10px]">{z}</Badge>)}
                  </div>
                )}

                {d.specialties.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Tag size={12} className="text-muted-foreground" />
                    {d.specialties.map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-[11px] text-muted-foreground">{countAssignments(d.id)} assignation(s)</span>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditDelegate(d); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DelegateFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        delegate={editDelegate}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin-delegates"] })}
      />
    </div>
  );
};

function DelegateFormDialog({ open, onOpenChange, delegate, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; delegate: Delegate | null; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: delegate?.full_name || "",
    email: delegate?.email || "",
    phone: delegate?.phone || "",
    photo_url: delegate?.photo_url || "",
    delegate_type: delegate?.delegate_type || "commercial",
    zones: delegate?.zones || [],
    specialties: delegate?.specialties || [],
    bio: delegate?.bio || "",
    is_visible: delegate?.is_visible ?? false,
  });

  // Reset form when delegate changes
  useState(() => {
    setForm({
      full_name: delegate?.full_name || "",
      email: delegate?.email || "",
      phone: delegate?.phone || "",
      photo_url: delegate?.photo_url || "",
      delegate_type: delegate?.delegate_type || "commercial",
      zones: delegate?.zones || [],
      specialties: delegate?.specialties || [],
      bio: delegate?.bio || "",
      is_visible: delegate?.is_visible ?? false,
    });
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const toggleZone = (z: string) => {
    set("zones", form.zones.includes(z) ? form.zones.filter(x => x !== z) : [...form.zones, z]);
  };

  const [newSpecialty, setNewSpecialty] = useState("");
  const addSpecialty = () => {
    if (newSpecialty.trim() && !form.specialties.includes(newSpecialty.trim())) {
      set("specialties", [...form.specialties, newSpecialty.trim()]);
      setNewSpecialty("");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `delegates/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("cms-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("cms-images").getPublicUrl(path);
      set("photo_url", urlData.publicUrl);
      toast.success("Photo uploadée");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        photo_url: form.photo_url.trim() || null,
        delegate_type: form.delegate_type,
        zones: form.zones,
        specialties: form.specialties,
        bio: form.bio.trim() || null,
        is_visible: form.is_visible,
      };

      if (delegate) {
        const { error } = await supabase.from("delegates").update(payload as any).eq("id", delegate.id);
        if (error) throw error;
        toast.success("Délégué mis à jour");
      } else {
        const { error } = await supabase.from("delegates").insert(payload as any);
        if (error) throw error;
        toast.success("Délégué créé");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{delegate ? "Modifier" : "Nouveau"} délégué</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {/* Photo */}
          <div>
            <Label>Photo</Label>
            <div className="flex items-center gap-3 mt-1">
              {form.photo_url ? (
                <img src={form.photo_url} alt="" className="w-12 h-12 rounded-full object-cover border border-border" />
              ) : (
                <div className="w-12 h-12 rounded-full border border-dashed border-border bg-muted flex items-center justify-center"><User size={18} className="text-muted-foreground" /></div>
              )}
              <label className="cursor-pointer px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors">
                {uploading ? "Upload..." : "Choisir"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            </div>
          </div>

          <div><Label>Nom complet *</Label><Input value={form.full_name} onChange={e => set("full_name", e.target.value)} /></div>

          <div>
            <Label>Type</Label>
            <div className="flex gap-2 mt-1">
              {(["commercial", "contact_referent"] as const).map(t => (
                <button key={t} onClick={() => set("delegate_type", t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${form.delegate_type === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {t === "commercial" ? "Commercial" : "Contact référent"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
          </div>

          {/* Zones */}
          <div>
            <Label>Zones géographiques</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ZONES.map(z => (
                <button key={z} onClick={() => toggleZone(z)}
                  className={`px-2 py-1 rounded text-[11px] border transition-colors ${form.zones.includes(z) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {z}
                </button>
              ))}
            </div>
          </div>

          {/* Specialties */}
          <div>
            <Label>Spécialités</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {form.specialties.map(s => (
                <Badge key={s} variant="secondary" className="text-[10px] gap-1">
                  {s} <X size={10} className="cursor-pointer" onClick={() => set("specialties", form.specialties.filter(x => x !== s))} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              <Input placeholder="Ajouter une spécialité" value={newSpecialty} onChange={e => setNewSpecialty(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSpecialty())} className="text-xs" />
              <button onClick={addSpecialty} className="px-3 py-1 rounded border border-border text-xs hover:bg-muted">+</button>
            </div>
          </div>

          <div>
            <Label>Bio</Label>
            <textarea className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background min-h-[50px] resize-y"
              value={form.bio} onChange={e => set("bio", e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_visible} onChange={e => set("is_visible", e.target.checked)} id="visible" />
            <Label htmlFor="visible" className="cursor-pointer text-sm">Visible publiquement</Label>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50">
            <Save size={14} /> {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AdminDelegues;
