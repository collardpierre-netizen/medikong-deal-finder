import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Factory, Package, Tag, Plus, Search, Globe, Award, Merge, X, ExternalLink } from "lucide-react";

const COUNTRIES = [
  { code: "BE", label: "🇧🇪 Belgique" }, { code: "FR", label: "🇫🇷 France" },
  { code: "DE", label: "🇩🇪 Allemagne" }, { code: "NL", label: "🇳🇱 Pays-Bas" },
  { code: "SE", label: "🇸🇪 Suède" }, { code: "DK", label: "🇩🇰 Danemark" },
  { code: "GB", label: "🇬🇧 Royaume-Uni" }, { code: "US", label: "🇺🇸 États-Unis" },
  { code: "CH", label: "🇨🇭 Suisse" }, { code: "JP", label: "🇯🇵 Japon" },
];

const FLAG: Record<string, string> = { BE: "🇧🇪", FR: "🇫🇷", DE: "🇩🇪", NL: "🇳🇱", SE: "🇸🇪", DK: "🇩🇰", GB: "🇬🇧", US: "🇺🇸", CH: "🇨🇭", JP: "🇯🇵" };

const useManufacturers = () =>
  useQuery({
    queryKey: ["admin-manufacturers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("manufacturers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

const useBrandsForManufacturer = (manufacturerId: string | null) =>
  useQuery({
    queryKey: ["brands-for-manufacturer", manufacturerId],
    queryFn: async () => {
      if (!manufacturerId) return [];
      const { data, error } = await supabase.from("brands").select("*").eq("manufacturer_id", manufacturerId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!manufacturerId,
  });

const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function AdminFabricants() {
  const qc = useQueryClient();
  const { data: manufacturers = [], isLoading } = useManufacturers();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");

  const { data: linkedBrands = [] } = useBrandsForManufacturer(selectedId);

  const selected = manufacturers.find(m => m.id === selectedId);

  const filtered = manufacturers.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    const matchCountry = countryFilter === "all" || m.country_of_origin === countryFilter;
    return matchSearch && matchCountry;
  });

  const saveMutation = useMutation({
    mutationFn: async (form: any) => {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        legal_name: form.legal_name || null,
        logo_url: form.logo_url || null,
        website_url: form.website_url || null,
        description: form.description || null,
        country_of_origin: form.country_of_origin || null,
        year_founded: form.year_founded ? parseInt(form.year_founded) : null,
        certifications: form.certifications ? form.certifications.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        specialties: form.specialties ? form.specialties.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        is_active: true,
      };
      if (form.id) {
        const { error } = await supabase.from("manufacturers").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("manufacturers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editItem ? "Fabricant mis à jour" : "Fabricant créé");
      qc.invalidateQueries({ queryKey: ["admin-manufacturers"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) throw new Error("Sélectionnez deux fabricants différents");
      // Move brands from source to target
      await supabase.from("brands").update({ manufacturer_id: mergeTarget }).eq("manufacturer_id", mergeSource);
      // Move products from source to target
      await supabase.from("products").update({ manufacturer_id: mergeTarget }).eq("manufacturer_id", mergeSource);
      // Delete source
      const { error } = await supabase.from("manufacturers").delete().eq("id", mergeSource);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fabricants fusionnés");
      qc.invalidateQueries({ queryKey: ["admin-manufacturers"] });
      setMergeDialogOpen(false);
      setMergeSource("");
      setMergeTarget("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <AdminTopBar title="Fabricants" subtitle="Gestion des fabricants (manufacturers)"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setMergeDialogOpen(true)}>
              <Merge size={14} className="mr-1" />Fusionner
            </Button>
            <Button size="sm" onClick={() => { setEditItem(null); setDialogOpen(true); }} className="bg-[#1E293B] hover:bg-[#1E293B]/90">
              <Plus size={14} className="mr-1" />Fabricant
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard icon={Factory} label="Fabricants" value={String(manufacturers.length)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Tag} label="Marques liées" value={String(manufacturers.reduce((a, m) => a + (m.brand_count || 0), 0))} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={Package} label="Produits total" value={String(manufacturers.reduce((a, m) => a + (m.product_count || 0), 0))} iconColor="#059669" iconBg="#ECFDF5" />
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-9 h-9 text-[12px]" />
        </div>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-[160px] h-9 text-[12px]"><SelectValue placeholder="Pays" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les pays</SelectItem>
            {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-4">
        <div className={`bg-white rounded-lg border overflow-hidden ${selectedId ? "flex-1" : "w-full"}`} style={{ borderColor: "#E2E8F0" }}>
          {isLoading ? (
            <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  {["Fabricant", "Pays", "Marques", "Produits", "Certifications", "Statut", ""].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => (
                  <TableRow key={m.id} className="cursor-pointer hover:bg-blue-50/50"
                    onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
                    style={selectedId === m.id ? { backgroundColor: "#EFF6FF" } : {}}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {m.logo_url ? <img src={m.logo_url} alt="" className="w-6 h-6 rounded object-contain" /> : <Factory size={16} className="text-[#8B95A5]" />}
                        <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>{m.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[12px]">{FLAG[m.country_of_origin || ""] || m.country_of_origin || "—"}</TableCell>
                    <TableCell className="text-[11px] text-right" style={{ color: "#616B7C" }}>{m.brand_count || 0}</TableCell>
                    <TableCell className="text-[11px] text-right" style={{ color: "#616B7C" }}>{m.product_count || 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {(m.certifications || []).slice(0, 3).map((c: string) => (
                          <Badge key={c} variant="outline" className="text-[9px] px-1.5 py-0">{c}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-bold" style={{
                        backgroundColor: m.is_active ? "#ECFDF5" : "#FEF2F2",
                        color: m.is_active ? "#059669" : "#EF4444",
                        borderColor: "transparent",
                      }}>
                        {m.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-[11px] h-7" onClick={e => { e.stopPropagation(); setEditItem(m); setDialogOpen(true); }}>Éditer</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {selected && (
          <div className="w-[320px] bg-white rounded-lg border p-5 shrink-0" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {selected.logo_url ? (
                  <img src={selected.logo_url} alt={selected.name} className="w-12 h-12 rounded-lg border object-contain p-1" style={{ borderColor: "#E2E8F0" }} />
                ) : (
                  <div className="w-12 h-12 rounded-lg border flex items-center justify-center" style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}>
                    <Factory size={20} className="text-[#8B95A5]" />
                  </div>
                )}
                <h3 className="text-[16px] font-bold" style={{ color: "#1D2530" }}>{selected.name}</h3>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-[#8B95A5] hover:text-[#1D2530]"><X size={16} /></button>
            </div>
            <div className="space-y-2 text-[12px] mb-4">
              <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Pays</span><span>{FLAG[selected.country_of_origin || ""] || "—"} {selected.country_of_origin || "—"}</span></div>
              {selected.legal_name && <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Raison sociale</span><span>{selected.legal_name}</span></div>}
              {selected.year_founded && <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Fondé en</span><span>{selected.year_founded}</span></div>}
              {selected.website_url && <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Site</span><a href={selected.website_url} target="_blank" rel="noopener" className="text-[#1B5BDA] truncate max-w-[140px]">{selected.website_url.replace(/^https?:\/\//, "")}</a></div>}
            </div>

            {selected.description && <p className="text-[11px] mb-3" style={{ color: "#616B7C" }}>{selected.description}</p>}

            {(selected.certifications || []).length > 0 && (
              <div className="mb-3">
                <span className="text-[10px] font-semibold" style={{ color: "#8B95A5" }}>Certifications</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {selected.certifications.map((c: string) => <Badge key={c} variant="outline" className="text-[9px]">{c}</Badge>)}
                </div>
              </div>
            )}

            {(selected.specialties || []).length > 0 && (
              <div className="mb-3">
                <span className="text-[10px] font-semibold" style={{ color: "#8B95A5" }}>Spécialités</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {selected.specialties.map((s: string) => <Badge key={s} className="text-[9px] bg-blue-50 text-[#1B5BDA] border-0">{s}</Badge>)}
                </div>
              </div>
            )}

            <Tabs defaultValue="brands" className="mt-4">
              <TabsList className="w-full h-8">
                <TabsTrigger value="brands" className="text-[11px] flex-1">Marques ({linkedBrands.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="brands" className="mt-2">
                {linkedBrands.length === 0 ? (
                  <p className="text-[11px] text-center py-4" style={{ color: "#8B95A5" }}>Aucune marque liée</p>
                ) : (
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {linkedBrands.map(b => (
                      <div key={b.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#F8FAFC]">
                        <span className="text-[12px] font-medium">{b.name}</span>
                        <span className="text-[10px]" style={{ color: "#8B95A5" }}>{b.product_count || 0} prod.</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1 text-[12px]" onClick={() => { setEditItem(selected); setDialogOpen(true); }}>Modifier</Button>
              <Button variant="outline" size="sm" className="text-[12px]" onClick={() => window.open(`/fabricant/${selected.slug}`, '_blank')}>
                <ExternalLink size={13} className="mr-1" />Page publique
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <ManufacturerFormDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editItem} onSave={(form: any) => saveMutation.mutate(form)} saving={saveMutation.isPending} />

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Fusionner deux fabricants</DialogTitle></DialogHeader>
          <p className="text-[12px] mb-3" style={{ color: "#616B7C" }}>Les marques et produits du fabricant source seront transférés au fabricant cible. Le fabricant source sera supprimé.</p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Source (sera supprimé)</Label>
              <Select value={mergeSource} onValueChange={setMergeSource}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>{manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cible (sera conservé)</Label>
              <Select value={mergeTarget} onValueChange={setMergeTarget}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>{manufacturers.filter(m => m.id !== mergeSource).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => mergeMutation.mutate()} disabled={mergeMutation.isPending || !mergeSource || !mergeTarget} className="bg-red-600 hover:bg-red-700 text-white">
              {mergeMutation.isPending ? "..." : "Fusionner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Form Dialog ─────────────────────
function ManufacturerFormDialog({ open, onOpenChange, item, onSave, saving }: { open: boolean; onOpenChange: (o: boolean) => void; item: any; onSave: (f: any) => void; saving: boolean }) {
  const [form, setForm] = useState<any>({});

  const reset = () => {
    if (item) {
      setForm({
        id: item.id, name: item.name || "", slug: item.slug || "",
        legal_name: item.legal_name || "", logo_url: item.logo_url || "",
        website_url: item.website_url || "", description: item.description || "",
        country_of_origin: item.country_of_origin || "",
        year_founded: item.year_founded?.toString() || "",
        certifications: (item.certifications || []).join(", "),
        specialties: (item.specialties || []).join(", "),
      });
    } else {
      setForm({ name: "", slug: "", legal_name: "", logo_url: "", website_url: "", description: "", country_of_origin: "", year_founded: "", certifications: "", specialties: "" });
    }
  };

  // Reset form when dialog opens or item changes
  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) setForm({}); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? "Modifier le fabricant" : "Nouveau fabricant"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Nom *</Label><Input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} /></div>
            <div><Label className="text-xs">Slug</Label><Input value={form.slug || ""} onChange={e => setForm({ ...form, slug: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Raison sociale</Label><Input value={form.legal_name || ""} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Pays</Label>
              <Select value={form.country_of_origin || ""} onValueChange={v => setForm({ ...form, country_of_origin: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Année de fondation</Label><Input type="number" value={form.year_founded || ""} onChange={e => setForm({ ...form, year_founded: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Logo URL</Label>
              <Input value={form.logo_url || ""} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://" />
              {form.logo_url && <img src={form.logo_url} alt="Preview" className="mt-1 w-10 h-10 rounded object-contain border" style={{ borderColor: "#E2E8F0" }} />}
            </div>
          </div>
          <div><Label className="text-xs">Site web</Label><Input value={form.website_url || ""} onChange={e => setForm({ ...form, website_url: e.target.value })} placeholder="https://" /></div>
          <div><Label className="text-xs">Description</Label><Textarea rows={3} value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label className="text-xs">Certifications (virgules)</Label><Input value={form.certifications || ""} onChange={e => setForm({ ...form, certifications: e.target.value })} placeholder="ISO 13485, CE, FDA" /></div>
          <div><Label className="text-xs">Spécialités (virgules)</Label><Input value={form.specialties || ""} onChange={e => setForm({ ...form, specialties: e.target.value })} placeholder="Wound care, Incontinence" /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.name?.trim()} className="bg-[#1E293B] hover:bg-[#1E293B]/90">{saving ? "..." : item ? "Enregistrer" : "Créer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
