import React from "react";
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
import { useImportJobs } from "@/contexts/ImportContext";
import { Layers, Tag, Package, ChevronDown, ChevronRight, Download, Upload, Languages, X, Save, Wand2, Merge, ShieldOff } from "lucide-react";
import { Search, FolderTree, ArrowRight, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import CategoryKeywordDisableDialog from "@/components/admin/CategoryKeywordDisableDialog";

const LOCALES = ["fr", "nl", "de"] as const;

const AdminCategories = () => {
  const qc = useQueryClient();
  const { data: categoriesData = [], isLoading } = useCategories();
  const { data: totalCategoryCount = 0 } = useCategoryCount();
  const { data: translations = [] } = useEntityTranslations("category");
  const batchSave = useBatchSaveTranslations();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addJob, updateJob, finishJob } = useImportJobs();

  const handleImport = async (file: File) => {
    const jobId = "import-categories-" + Date.now();
    addJob(jobId, "Import catégories");
    try {
      updateJob(jobId, { phase: "Lecture du fichier…" });
      const result = await importCategories(file);
      finishJob(jobId, { success: result.created, errors: result.errors });
      if (result.created > 0) {
        toast.success(`✅ ${result.created} catégorie(s) importée(s)`);
      }
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
    } catch (e: any) {
      finishJob(jobId, { success: 0, errors: [e.message || "Erreur inconnue"] });
      toast.error(`Erreur import: ${e.message || "Erreur inconnue"}`);
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

  // Auto-translate all categories for a locale using AI edge function
  const [translating, setTranslating] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignParent, setReassignParent] = useState("none");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParent, setNewCatParent] = useState("none");
  const [showKeywordDisable, setShowKeywordDisable] = useState(false);

  const searchLower = search.toLowerCase().trim();
  const matchesSearch = (cat: any) => {
    if (!searchLower) return true;
    const frName = getTranslated(translations, cat.id, "name", "fr", "").toLowerCase();
    return cat.name.toLowerCase().includes(searchLower) || frName.includes(searchLower);
  };
  const childrenOf = (pid: string) => categoriesData.filter(c => c.parent_id === pid);
  const filteredParents = searchLower
    ? parents.filter(c => matchesSearch(c) || childrenOf(c.id).some(matchesSearch))
    : parents;

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const reassignMutation = useMutation({
    mutationFn: async () => {
      const np = reassignParent === "none" ? null : reassignParent;
      for (const id of selectedIds) await supabase.from("categories").update({ parent_id: np }).eq("id", id);
    },
    onSuccess: () => { toast.success(`${selectedIds.length} catégorie(s) réassignée(s)`); setSelectedIds([]); setShowReassign(false); qc.invalidateQueries({ queryKey: ["admin-categories"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newCatName.trim()) throw new Error("Nom requis");
      const slug = newCatName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { error } = await supabase.from("categories").insert({ name: newCatName.trim(), slug, parent_id: newCatParent === "none" ? null : newCatParent, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Catégorie créée"); setShowNewCat(false); setNewCatName(""); setNewCatParent("none"); qc.invalidateQueries({ queryKey: ["admin-categories"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("categories").update({ parent_id: null }).eq("parent_id", id);
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Catégorie supprimée"); setSelectedId(null); setEditForm(null); qc.invalidateQueries({ queryKey: ["admin-categories"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  // Global toggle: activate or deactivate ALL categories
  const toggleAllVisibility = useMutation({
    mutationFn: async (newActive: boolean) => {
      const { error, count } = await supabase
        .from("categories")
        .update({ is_active: newActive }, { count: "exact" })
        .neq("is_active", newActive);
      if (error) throw error;
      return { count: count ?? 0, newActive };
    },
    onSuccess: (result) => {
      const verb = result.newActive ? "activée(s)" : "désactivée(s)";
      toast.success(`${result.count} catégorie(s) ${verb} globalement`);
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Toggle visibility of a category + its children + cascade to products
  const toggleVisibility = useMutation({
    mutationFn: async ({ id, newActive }: { id: string; newActive: boolean }) => {
      // Collect all category IDs to update (this cat + all descendants)
      const allIds = [id];
      const collectChildren = (parentId: string) => {
        const kids = categoriesData.filter(c => c.parent_id === parentId);
        for (const kid of kids) {
          allIds.push(kid.id);
          collectChildren(kid.id);
        }
      };
      collectChildren(id);

      // Update categories
      const { error: catError } = await supabase.from("categories").update({ is_active: newActive }).in("id", allIds);
      if (catError) throw catError;

      // Cascade to products in those categories
      const { error: prodError } = await supabase.from("products").update({ is_active: newActive }).in("category_id", allIds);
      if (prodError) throw prodError;

      return { count: allIds.length, newActive };
    },
    onSuccess: (result) => {
      const verb = result.newActive ? "activée(s)" : "désactivée(s)";
      toast.success(`${result.count} catégorie(s) ${verb} + produits associés`);
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAutoTranslate = async (locale: "fr" | "nl" | "de") => {
    // Collect categories without translation
    const missing: typeof categoriesData = [];
    for (const cat of categoriesData) {
      const existing = getTranslated(translations, cat.id, "name", locale, "");
      if (!existing) missing.push(cat);
    }
    if (missing.length === 0) {
      toast.info(`Toutes les catégories ont déjà une traduction ${locale.toUpperCase()}`);
      return;
    }

    setTranslating(locale);
    const allItems: any[] = [];
    const BATCH = 20;
    let done = 0;

    try {
      for (let i = 0; i < missing.length; i += BATCH) {
        const batch = missing.slice(i, i + BATCH);
        // First try static dictionary
        const needsAi: typeof batch = [];
        for (const cat of batch) {
          const staticResult = autoTranslate(cat.name, locale);
          if (staticResult) {
            allItems.push({ entity_type: "category" as const, entity_id: cat.id, locale, field: "name", value: staticResult });
          } else {
            needsAi.push(cat);
          }
        }

        // Batch AI translate remaining
        if (needsAi.length > 0) {
          const textsObj: Record<string, string> = {};
          needsAi.forEach((cat, idx) => { textsObj[`cat_${idx}`] = cat.name; });

          const { data, error } = await supabase.functions.invoke("auto-translate", {
            body: { texts: textsObj, target_locales: [locale] },
          });

          if (!error && data?.translations?.[locale]) {
            const translated = data.translations[locale];
            needsAi.forEach((cat, idx) => {
              const val = translated[`cat_${idx}`];
              if (val && val.trim()) {
                allItems.push({ entity_type: "category" as const, entity_id: cat.id, locale, field: "name", value: val });
              }
            });
          }
        }

        done += batch.length;
        if (i + BATCH < missing.length) {
          toast.info(`Traduction ${locale.toUpperCase()} : ${done}/${missing.length}...`);
        }
      }

      if (allItems.length > 0) {
        // Save in chunks of 100
        for (let i = 0; i < allItems.length; i += 100) {
          await batchSave.mutateAsync(allItems.slice(i, i + 100));
        }
        toast.success(`${allItems.length} traduction(s) ${locale.toUpperCase()} ajoutée(s) sur ${missing.length} manquantes`);
      } else {
        toast.warning("Aucune traduction n'a pu être générée.");
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur de traduction");
    } finally {
      setTranslating(null);
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
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-muted/30" style={{ borderColor: "#E2E8F0" }}>
              <Label htmlFor="global-toggle" className="text-[12px] font-medium cursor-pointer" style={{ color: "#475569" }}>
                Tout activer
              </Label>
              <Switch
                id="global-toggle"
                checked={categoriesData.length > 0 && categoriesData.every(c => c.is_active)}
                disabled={toggleAllVisibility.isPending}
                onCheckedChange={(checked) => {
                  if (confirm(`Êtes-vous sûr de vouloir ${checked ? "activer" : "désactiver"} TOUTES les catégories ?`)) {
                    toggleAllVisibility.mutate(checked);
                  }
                }}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowKeywordDisable(true)} className="text-destructive hover:text-destructive">
              <ShieldOff size={14} className="mr-1" />Désactiver par mot-clé
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowNewCat(true)}><Plus size={14} className="mr-1" />Nouvelle</Button>
            <Button variant="outline" size="sm" onClick={() => handleAutoTranslate("fr")} disabled={!!translating}>
              <Wand2 size={14} className={`mr-1 ${translating === "fr" ? "animate-spin" : ""}`} />{translating === "fr" ? "Traduction..." : "Auto FR"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAutoTranslate("nl")} disabled={!!translating}>
              <Wand2 size={14} className={`mr-1 ${translating === "nl" ? "animate-spin" : ""}`} />{translating === "nl" ? "Traduction..." : "Auto NL"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAutoTranslate("de")} disabled={!!translating}>
              <Wand2 size={14} className={`mr-1 ${translating === "de" ? "animate-spin" : ""}`} />{translating === "de" ? "Traduction..." : "Auto DE"}
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
        <KpiCard icon={Package} label="Total" value={totalCategoryCount.toLocaleString("fr-BE")} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={Languages} label="Traductions" value={String(translations.length)} iconColor="#D97706" iconBg="#FFFBEB" />
      </div>

      {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
        <div className="flex gap-4">
          {/* Tree View */}
          <div className={`bg-white rounded-lg border p-5 ${selectedId ? "flex-1" : "w-full"}`} style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}><FolderTree size={16} className="inline mr-1" />Arborescence</h3>
              {selectedIds.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowReassign(true)} className="text-[11px] h-7">
                  <ArrowRight size={12} className="mr-1" />Réassigner ({selectedIds.length})
                </Button>
              )}
            </div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une catégorie..." className="pl-8 h-8 text-[12px]" />
            </div>
            <div className="space-y-0.5">
              {filteredParents.map((cat) => {
                const subs = childrenOf(cat.id).filter(c => !searchLower || matchesSearch(c) || matchesSearch(cat));
                const isActive = selectedId === cat.id;
                return (
                  <div key={cat.id}>
                    <button
                      onClick={() => selectCategory(cat)}
                      className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-md transition-colors ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      <Checkbox checked={selectedIds.includes(cat.id)} onCheckedChange={() => toggleSelect(cat.id)} onClick={(e: any) => e.stopPropagation()} className="mr-0.5 h-3.5 w-3.5" />
                      <span
                        onClick={(e) => { e.stopPropagation(); if (subs.length > 0) toggle(cat.id); }}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium shrink-0 ${subs.length > 0 ? "cursor-pointer border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground" : "border-transparent text-transparent"}`}
                        title={subs.length > 0 ? (expanded.includes(cat.id) ? "Replier cette catégorie" : "Déplier cette catégorie") : undefined}
                      >
                        {subs.length > 0 ? (
                          <>
                            {expanded.includes(cat.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            <span>{expanded.includes(cat.id) ? "Replier" : "Déplier"}</span>
                          </>
                        ) : (
                          <span>Vide</span>
                        )}
                      </span>
                      <Layers size={14} style={{ color: "#1B5BDA" }} />
                      <span className="text-[13px] font-semibold flex-1" style={{ color: "#1D2530" }}>
                        {getTranslated(translations, cat.id, "name", "fr", cat.name)}
                      </span>
                      <TranslationBadges catId={cat.id} />
                      <Switch
                        checked={cat.is_active}
                        onCheckedChange={(checked) => { toggleVisibility.mutate({ id: cat.id, newActive: checked }); }}
                        onClick={(e: any) => e.stopPropagation()}
                        className="scale-75"
                      />
                    </button>
                    {expanded.includes(cat.id) && subs.length > 0 && (
                      <div className="ml-8 space-y-0.5">
                        {subs.map((sub) => {
                          const isSubActive = selectedId === sub.id;
                          const grandchildren = childrenOf(sub.id);
                          const hasGrandchildren = grandchildren.length > 0;
                          return (
                            <React.Fragment key={sub.id}>
                            <button
                              onClick={() => selectCategory(sub)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-md w-full text-left transition-colors ${isSubActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
                            >
                              <Checkbox checked={selectedIds.includes(sub.id)} onCheckedChange={() => toggleSelect(sub.id)} onClick={(e: any) => e.stopPropagation()} className="mr-0.5 h-3.5 w-3.5" />
                              {hasGrandchildren ? (
                                <span
                                  onClick={(e) => { e.stopPropagation(); toggle(sub.id); }}
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer shrink-0"
                                  title={expanded.includes(sub.id) ? "Replier cette sous-catégorie" : "Déplier cette sous-catégorie"}
                                >
                                  {expanded.includes(sub.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  <span>{expanded.includes(sub.id) ? "Replier" : "Déplier"}</span>
                                </span>
                              ) : <div className="w-[62px]" />}

                              <Tag size={12} style={{ color: "#7C3AED" }} />
                              <span className="text-[12px] flex-1" style={{ color: "#616B7C" }}>
                                {getTranslated(translations, sub.id, "name", "fr", sub.name)}
                              </span>
                              {hasGrandchildren && <span className="text-[9px] text-muted-foreground">{grandchildren.length}</span>}
                              <TranslationBadges catId={sub.id} />
                            </button>
                            {/* Grandchildren - collapsible */}
                            {hasGrandchildren && expanded.includes(sub.id) && (
                              <div className="ml-6 space-y-0.5">
                                {grandchildren.map(gc => (
                                  <button key={gc.id} onClick={() => selectCategory(gc)}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md w-full text-left text-[11px] ${selectedId === gc.id ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                                    <Checkbox checked={selectedIds.includes(gc.id)} onCheckedChange={() => toggleSelect(gc.id)} onClick={(e: any) => e.stopPropagation()} className="h-3 w-3" />
                                    <span className="w-2 h-px bg-gray-300 shrink-0" />
                                    <span className="flex-1" style={{ color: "#8B95A5" }}>{getTranslated(translations, gc.id, "name", "fr", gc.name)}</span>
                                    <TranslationBadges catId={gc.id} />
                                  </button>
                                ))}
                              </div>
                            )}
                           </React.Fragment>);
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
                <h3 className="text-[15px] font-bold" style={{ color: "#1D2530" }}>Éditer</h3>
                <div className="flex gap-1.5">
                  <button onClick={() => { if (confirm("Supprimer cette catégorie ?")) deleteMutation.mutate(selected.id); }} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  <button onClick={() => { setSelectedId(null); setEditForm(null); }} className="text-[#8B95A5] hover:text-[#1D2530]"><X size={16} /></button>
                </div>
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

              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full bg-primary hover:bg-primary/90">
                <Save size={14} className="mr-1" />{saveMutation.isPending ? "..." : "Sauvegarder"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Reassign Dialog */}
      <Dialog open={showReassign} onOpenChange={setShowReassign}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Réassigner {selectedIds.length} catégorie(s)</DialogTitle></DialogHeader>
          <p className="text-[13px] text-muted-foreground mb-3">Choisissez le nouveau parent :</p>
          <Select value={reassignParent} onValueChange={setReassignParent}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Racine (pas de parent) —</SelectItem>
              {parents.filter(p => !selectedIds.includes(p.id)).map(p => (
                <SelectItem key={p.id} value={p.id}>{getTranslated(translations, p.id, "name", "fr", p.name)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReassign(false)}>Annuler</Button>
            <Button onClick={() => reassignMutation.mutate()} disabled={reassignMutation.isPending}>{reassignMutation.isPending ? "..." : "Réassigner"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Category Dialog */}
      <Dialog open={showNewCat} onOpenChange={setShowNewCat}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvelle catégorie</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground">NOM</Label>
              <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} className="mt-1" placeholder="Nom de la catégorie" />
            </div>
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground">CATÉGORIE PARENTE</Label>
              <Select value={newCatParent} onValueChange={setNewCatParent}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Racine —</SelectItem>
                  {parents.map(p => (
                    <SelectItem key={p.id} value={p.id}>{getTranslated(translations, p.id, "name", "fr", p.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCat(false)}>Annuler</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>{createMutation.isPending ? "..." : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCategories;
