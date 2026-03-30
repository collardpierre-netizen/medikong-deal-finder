import { useState, useRef, useMemo } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCategories, useCategoryCount } from "@/hooks/useAdminData";
import { useEntityTranslations, useBatchSaveTranslations, getTranslated } from "@/hooks/useTranslations";
import { autoTranslate } from "@/lib/translation-mappings";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportCategories, importCategories } from "@/lib/xlsx-utils";
import { toast } from "sonner";
import { Layers, Tag, Package, ChevronDown, ChevronRight, Download, Upload, Languages, X, Save, Wand2, Merge } from "lucide-react";

const LOCALES = ["fr", "nl", "de"] as const;

const AdminCategories = () => {
  const qc = useQueryClient();
  const { data: categoriesData = [], isLoading } = useCategories();
  const { data: translations = [] } = useEntityTranslations("category");
  const batchSave = useBatchSaveTranslations();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (file: File) => {
    toast.info("Import en cours...");
    try {
      const result = await importCategories(file);
      toast.success(`${result.created} catégories importée(s)`);
      if (result.errors.length > 0) toast.warning(`${result.errors.length} erreur(s): ${result.errors[0]}`);
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur import");
    }
  };

  const toggle = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  };

  const parents = categoriesData.filter(c => !c.parent_id);
  const children = (parentId: string) => categoriesData.filter(c => c.parent_id === parentId);
  const totalParents = parents.length;
  const totalSubs = categoriesData.filter(c => c.parent_id).length;

  // Auto-expand first parent
  if (parents.length > 0 && expanded.length === 0) {
    expanded.push(parents[0].id);
  }

  const selected = categoriesData.find(c => c.id === selectedId);

  // Initialize edit form when selection changes
  const selectCategory = (cat: any) => {
    setSelectedId(cat.id);
    const getTr = (locale: string, field: string) => getTranslated(translations, cat.id, field, locale, "");
    setEditForm({
      name_fr: getTr("fr", "name") || "",
      name_nl: getTr("nl", "name") || "",
      name_de: getTr("de", "name") || "",
      desc_fr: getTr("fr", "description") || "",
      desc_nl: getTr("nl", "description") || "",
      desc_de: getTr("de", "description") || "",
      parent_id: cat.parent_id || "none",
      icon: cat.icon || "",
      image_url: cat.image_url || "",
      vat_rate: cat.vat_rate?.toString() || "",
      is_active: cat.is_active,
      display_order: cat.display_order?.toString() || "0",
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !editForm) return;
      // Update category fields
      const { error } = await supabase.from("categories").update({
        parent_id: editForm.parent_id === "none" ? null : editForm.parent_id,
        icon: editForm.icon || null,
        image_url: editForm.image_url || null,
        vat_rate: editForm.vat_rate ? parseFloat(editForm.vat_rate) : null,
        is_active: editForm.is_active,
        display_order: parseInt(editForm.display_order) || 0,
      }).eq("id", selected.id);
      if (error) throw error;

      // Save translations
      const items: any[] = [];
      for (const locale of LOCALES) {
        const nameVal = editForm[`name_${locale}`]?.trim();
        const descVal = editForm[`desc_${locale}`]?.trim();
        if (nameVal) items.push({ entity_type: "category", entity_id: selected.id, locale, field: "name", value: nameVal });
        if (descVal) items.push({ entity_type: "category", entity_id: selected.id, locale, field: "description", value: descVal });
      }
      if (items.length > 0) await batchSave.mutateAsync(items);
    },
    onSuccess: () => {
      toast.success("Catégorie sauvegardée");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Auto-translate all categories for a locale
  const handleAutoTranslate = async (locale: "fr" | "nl" | "de") => {
    const items: any[] = [];
    for (const cat of categoriesData) {
      const existing = getTranslated(translations, cat.id, "name", locale, "");
      if (!existing) {
        const translated = autoTranslate(cat.name, locale);
        if (translated) {
          items.push({ entity_type: "category" as const, entity_id: cat.id, locale, field: "name", value: translated });
        }
      }
    }
    if (items.length === 0) {
      toast.info(`Toutes les catégories ont déjà une traduction ${locale.toUpperCase()}`);
      return;
    }
    try {
      await batchSave.mutateAsync(items);
      toast.success(`${items.length} traduction(s) ${locale.toUpperCase()} ajoutée(s)`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Translation badges for a category
  const TranslationBadges = ({ catId }: { catId: string }) => (
    <div className="flex gap-0.5">
      {LOCALES.map(l => {
        const has = translations.some(t => t.entity_id === catId && t.locale === l && t.field === "name");
        return (
          <span key={l} className="text-[8px] px-1 rounded font-bold" style={{
            backgroundColor: has ? "#ECFDF5" : "#FEF2F2",
            color: has ? "#059669" : "#EF4444",
          }}>
            {l.toUpperCase()}
          </span>
        );
      })}
    </div>
  );

  // Product count from products table (via category data)
  const getProductCount = (catId: string) => {
    // This would need a join, for now show "—"
    return null;
  };

  return (
    <div>
      <AdminTopBar title="Catégories" subtitle="Arborescence du catalogue produits"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleAutoTranslate("fr")} disabled={batchSave.isPending}>
              <Wand2 size={14} className="mr-1" />Auto FR
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAutoTranslate("nl")} disabled={batchSave.isPending}>
              <Wand2 size={14} className="mr-1" />Auto NL
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAutoTranslate("de")} disabled={batchSave.isPending}>
              <Wand2 size={14} className="mr-1" />Auto DE
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCategories()}><Download size={14} className="mr-1" />Export</Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} className="mr-1" />Import</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImport(e.target.files[0]); e.target.value = ""; }} />
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Layers} label="Catégories parentes" value={String(totalParents)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Tag} label="Sous-catégories" value={String(totalSubs)} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={Package} label="Total" value={String(categoriesData.length)} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={Languages} label="Traductions" value={String(translations.length)} iconColor="#D97706" iconBg="#FFFBEB" />
      </div>

      {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
        <div className="flex gap-4">
          {/* Tree View */}
          <div className={`bg-white rounded-lg border p-5 ${selectedId ? "flex-1" : "w-full"}`} style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Arborescence</h3>
            <div className="space-y-0.5">
              {parents.map((cat) => {
                const subs = children(cat.id);
                const isActive = selectedId === cat.id;
                return (
                  <div key={cat.id}>
                    <button
                      onClick={() => selectCategory(cat)}
                      className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-md transition-colors ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      <span onClick={(e) => { e.stopPropagation(); if (subs.length > 0) toggle(cat.id); }} className="cursor-pointer">
                        {subs.length > 0 ? (
                          expanded.includes(cat.id) ? <ChevronDown size={14} style={{ color: "#8B95A5" }} /> : <ChevronRight size={14} style={{ color: "#8B95A5" }} />
                        ) : <div className="w-3.5" />}
                      </span>
                      <Layers size={14} style={{ color: "#1B5BDA" }} />
                      <span className="text-[13px] font-semibold flex-1" style={{ color: "#1D2530" }}>
                        {getTranslated(translations, cat.id, "name", "fr", cat.name)}
                      </span>
                      <TranslationBadges catId={cat.id} />
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: cat.is_active ? "#ECFDF5" : "#FFFBEB", color: cat.is_active ? "#059669" : "#D97706" }}>
                        {cat.is_active ? "Actif" : "Inactif"}
                      </span>
                    </button>
                    {expanded.includes(cat.id) && subs.length > 0 && (
                      <div className="ml-8 space-y-0.5">
                        {subs.map((sub) => {
                          const isSubActive = selectedId === sub.id;
                          return (
                            <button key={sub.id}
                              onClick={() => selectCategory(sub)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-md w-full text-left transition-colors ${isSubActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
                            >
                              <Tag size={12} style={{ color: "#7C3AED" }} />
                              <span className="text-[12px] flex-1" style={{ color: "#616B7C" }}>
                                {getTranslated(translations, sub.id, "name", "fr", sub.name)}
                              </span>
                              <TranslationBadges catId={sub.id} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edit Panel */}
          {selected && editForm && (
            <div className="w-[380px] bg-white rounded-lg border p-5 shrink-0 overflow-y-auto max-h-[calc(100vh-220px)]" style={{ borderColor: "#E2E8F0" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-bold" style={{ color: "#1D2530" }}>Éditer la catégorie</h3>
                <button onClick={() => { setSelectedId(null); setEditForm(null); }} className="text-[#8B95A5] hover:text-[#1D2530]"><X size={16} /></button>
              </div>

              {/* Original name (read-only) */}
              <div className="mb-4">
                <Label className="text-[10px] font-semibold" style={{ color: "#8B95A5" }}>NOM ORIGINAL (EN)</Label>
                <Input value={selected.name} disabled className="mt-1 text-[12px] bg-[#F8FAFC]" />
              </div>

              {/* Translations - Name */}
              <div className="mb-4">
                <Label className="text-[10px] font-semibold flex items-center gap-1" style={{ color: "#8B95A5" }}>
                  <Languages size={12} /> TRADUCTIONS DU NOM
                </Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {LOCALES.map(l => (
                    <div key={l}>
                      <span className="text-[9px] font-bold" style={{ color: "#8B95A5" }}>{l.toUpperCase()}</span>
                      <Input
                        value={editForm[`name_${l}`] || ""}
                        onChange={e => setEditForm({ ...editForm, [`name_${l}`]: e.target.value })}
                        className="text-[11px] h-8 mt-0.5"
                        placeholder={`Nom ${l.toUpperCase()}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Translations - Description */}
              <div className="mb-4">
                <Label className="text-[10px] font-semibold flex items-center gap-1" style={{ color: "#8B95A5" }}>
                  <Languages size={12} /> TRADUCTIONS DE LA DESCRIPTION
                </Label>
                <div className="space-y-2 mt-1">
                  {LOCALES.map(l => (
                    <div key={l}>
                      <span className="text-[9px] font-bold" style={{ color: "#8B95A5" }}>{l.toUpperCase()}</span>
                      <Textarea
                        rows={2}
                        value={editForm[`desc_${l}`] || ""}
                        onChange={e => setEditForm({ ...editForm, [`desc_${l}`]: e.target.value })}
                        className="text-[11px] mt-0.5"
                        placeholder={`Description ${l.toUpperCase()}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Parent category */}
              <div className="mb-3">
                <Label className="text-[10px] font-semibold" style={{ color: "#8B95A5" }}>CATÉGORIE PARENTE</Label>
                <Select value={editForm.parent_id} onValueChange={v => setEditForm({ ...editForm, parent_id: v })}>
                  <SelectTrigger className="mt-1 h-8 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Racine —</SelectItem>
                    {parents.filter(p => p.id !== selected.id).map(p => (
                      <SelectItem key={p.id} value={p.id}>{getTranslated(translations, p.id, "name", "fr", p.name)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Other fields */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <Label className="text-[10px] font-semibold" style={{ color: "#8B95A5" }}>ICÔNE</Label>
                  <Input value={editForm.icon} onChange={e => setEditForm({ ...editForm, icon: e.target.value })} className="mt-1 h-8 text-[11px]" placeholder="Shield, Heart..." />
                </div>
                <div>
                  <Label className="text-[10px] font-semibold" style={{ color: "#8B95A5" }}>TVA (%)</Label>
                  <Input type="number" value={editForm.vat_rate} onChange={e => setEditForm({ ...editForm, vat_rate: e.target.value })} className="mt-1 h-8 text-[11px]" placeholder="21" />
                </div>
              </div>

              <div className="mb-3">
                <Label className="text-[10px] font-semibold" style={{ color: "#8B95A5" }}>IMAGE URL</Label>
                <Input value={editForm.image_url} onChange={e => setEditForm({ ...editForm, image_url: e.target.value })} className="mt-1 h-8 text-[11px]" placeholder="https://" />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                  <Label className="text-[10px] font-semibold" style={{ color: "#8B95A5" }}>ORDRE</Label>
                  <Input type="number" value={editForm.display_order} onChange={e => setEditForm({ ...editForm, display_order: e.target.value })} className="mt-1 h-8 text-[11px]" />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <Switch checked={editForm.is_active} onCheckedChange={v => setEditForm({ ...editForm, is_active: v })} />
                  <span className="text-[11px]" style={{ color: "#616B7C" }}>{editForm.is_active ? "Actif" : "Inactif"}</span>
                </div>
              </div>

              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full bg-[#1E293B] hover:bg-[#1E293B]/90">
                <Save size={14} className="mr-1" />{saveMutation.isPending ? "..." : "Sauvegarder"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminCategories;
