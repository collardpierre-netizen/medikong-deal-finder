import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Plus, Pencil, Trash2, Percent, Layers, BarChart3, Split, Star, UserPlus, Building2 } from "lucide-react";
import { useCategories, useBrands } from "@/hooks/useAdminData";
import type { Tables } from "@/integrations/supabase/types";

type MarginRule = Tables<"margin_rules">;

export default function AdminCommissions() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<MarginRule> | null>(null);
  const [assignVendorId, setAssignVendorId] = useState("");
  const [assignRuleId, setAssignRuleId] = useState("");

  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();

  // Global rules (no vendor_id)
  const { data: rules = [] } = useQuery({
    queryKey: ["admin-commission-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("margin_rules")
        .select("*")
        .is("vendor_id", null)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Vendor-specific rules
  const { data: vendorRules = [] } = useQuery({
    queryKey: ["admin-commission-vendor-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("margin_rules")
        .select("*, vendors(company_name, name)")
        .not("vendor_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-vendors-for-commission"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, company_name, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-commission-rules"] });
    queryClient.invalidateQueries({ queryKey: ["admin-commission-vendor-rules"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (rule: Partial<MarginRule>) => {
      const payload: any = {
        name: rule.name || "Nouvelle règle",
        margin_percentage: rule.margin_percentage ?? 15,
        priority: rule.priority ?? 0,
        extra_delay_days: rule.extra_delay_days ?? 2,
        round_price_to: rule.round_price_to ?? 0.01,
        is_active: rule.is_active ?? true,
        category_id: rule.category_id || null,
        brand_id: rule.brand_id || null,
        vendor_id: rule.vendor_id || null,
        min_base_price: rule.min_base_price || null,
        max_base_price: rule.max_base_price || null,
      };
      if (rule.id) {
        const { error } = await supabase.from("margin_rules").update(payload).eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("margin_rules").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Règle de marge sauvegardée");
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de la sauvegarde"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("margin_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Règle supprimée");
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ vendorId, templateId }: { vendorId: string; templateId: string }) => {
      const template = rules.find(r => r.id === templateId);
      if (!template) throw new Error("Règle introuvable");
      // Remove existing vendor-specific rules
      await supabase.from("margin_rules").delete().eq("vendor_id", vendorId);
      const { error } = await supabase.from("margin_rules").insert({
        vendor_id: vendorId,
        name: `${template.name} (vendeur)`,
        margin_percentage: template.margin_percentage,
        priority: template.priority,
        extra_delay_days: template.extra_delay_days,
        round_price_to: template.round_price_to,
        category_id: template.category_id,
        brand_id: template.brand_id,
        min_base_price: template.min_base_price,
        max_base_price: template.max_base_price,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Règle assignée au vendeur");
      setAssignOpen(false);
      setAssignVendorId("");
      setAssignRuleId("");
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const openNew = () => {
    setEditingRule({
      name: "",
      margin_percentage: 15,
      priority: 0,
      extra_delay_days: 2,
      round_price_to: 0.01,
      is_active: true,
      category_id: null,
      brand_id: null,
      vendor_id: null,
      min_base_price: null,
      max_base_price: null,
    });
    setDialogOpen(true);
  };
  const openEdit = (r: MarginRule) => { setEditingRule({ ...r }); setDialogOpen(true); };

  const vendorsWithRules = new Set(vendorRules.map((r: any) => r.vendor_id));
  const vendorsWithoutRule = vendors.filter(v => !vendorsWithRules.has(v.id));

  const getCategoryName = (id: string | null) => categories.find(c => c.id === id)?.name || "—";
  const getBrandName = (id: string | null) => brands.find(b => b.id === id)?.name || "—";

  const getRuleDetail = (r: MarginRule) => {
    const parts = [`${r.margin_percentage}%`];
    if (r.category_id) parts.push(`cat: ${getCategoryName(r.category_id)}`);
    if (r.brand_id) parts.push(`marque: ${getBrandName(r.brand_id)}`);
    if (r.min_base_price) parts.push(`≥${r.min_base_price}€`);
    if (r.max_base_price) parts.push(`≤${r.max_base_price}€`);
    parts.push(`+${r.extra_delay_days}j`);
    return parts.join(" · ");
  };

  const getRuleType = (r: MarginRule) => {
    if (r.category_id) return { label: "Par catégorie", color: "bg-amber-100 text-amber-700", icon: Layers };
    if (r.brand_id) return { label: "Par marque", color: "bg-purple-100 text-purple-700", icon: BarChart3 };
    if (r.min_base_price || r.max_base_price) return { label: "Par tranche de prix", color: "bg-emerald-100 text-emerald-700", icon: Split };
    return { label: "Taux fixe", color: "bg-blue-100 text-blue-700", icon: Percent };
  };

  // Stats for cards
  const fixedCount = rules.filter(r => !r.category_id && !r.brand_id && !r.min_base_price && !r.max_base_price).length;
  const categoryCount = rules.filter(r => r.category_id).length;
  const brandCount = rules.filter(r => r.brand_id).length;
  const priceCount = rules.filter(r => r.min_base_price || r.max_base_price).length;

  const cards = [
    { label: "Taux fixe", desc: "Pourcentage unique sur chaque vente", count: fixedCount, color: "bg-blue-100 text-blue-700", Icon: Percent },
    { label: "Par catégorie", desc: "Taux différencié par catégorie produit", count: categoryCount, color: "bg-amber-100 text-amber-700", Icon: Layers },
    { label: "Par marque", desc: "Taux spécifique par marque", count: brandCount, color: "bg-purple-100 text-purple-700", Icon: BarChart3 },
    { label: "Par tranche de prix", desc: "Taux selon le prix de base", count: priceCount, color: "bg-emerald-100 text-emerald-700", Icon: Split },
  ];

  return (
    <div>
      <AdminTopBar title="Commissions" subtitle="Gérez les règles de marge appliquées aux offres Qogita"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}><UserPlus size={14} className="mr-1" />Assigner à un vendeur</Button>
            <Button size="sm" onClick={openNew} className="bg-[#1E293B] hover:bg-[#1E293B]/90"><Plus size={14} className="mr-1" />Nouvelle règle</Button>
          </div>
        }
      />

      {/* 4 model cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-lg border p-4 flex items-start gap-3" style={{ borderColor: "#E2E8F0" }}>
            <div className={`p-2.5 rounded-lg ${c.color}`}><c.Icon className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold text-sm" style={{ color: "#1D2530" }}>{c.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "#8B95A5" }}>{c.desc}</p>
              <Badge variant="secondary" className="text-[11px] mt-2">{c.count} template{c.count > 1 ? "s" : ""}</Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Global rules table */}
      <div className="bg-white rounded-lg border mb-6" style={{ borderColor: "#E2E8F0" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Règles globales (templates)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-[11px] uppercase tracking-wide" style={{ backgroundColor: "#F8FAFC", color: "#8B95A5", borderColor: "#E2E8F0" }}>
                <th className="text-left py-2.5 px-4 font-medium">Nom</th>
                <th className="text-left py-2.5 px-4 font-medium">Type</th>
                <th className="text-left py-2.5 px-4 font-medium">Détail</th>
                <th className="text-center py-2.5 px-4 font-medium">Priorité</th>
                <th className="text-center py-2.5 px-4 font-medium">Actif</th>
                <th className="text-right py-2.5 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => {
                const rType = getRuleType(r);
                return (
                  <tr key={r.id} className="border-b hover:bg-[#F8FAFC]" style={{ borderColor: "#E2E8F0" }}>
                    <td className="py-2.5 px-4 font-medium text-[13px]" style={{ color: "#1D2530" }}>{r.name}</td>
                    <td className="py-2.5 px-4">
                      <Badge className={`${rType.color} border-0 text-[11px]`}>{rType.label}</Badge>
                    </td>
                    <td className="py-2.5 px-4 text-xs" style={{ color: "#8B95A5" }}>{getRuleDetail(r)}</td>
                    <td className="py-2.5 px-4 text-center text-[12px]" style={{ color: "#616B7C" }}>{r.priority}</td>
                    <td className="py-2.5 px-4 text-center">
                      {r.is_active ? <Badge className="bg-green-100 text-green-700 border-0 text-[11px]">Actif</Badge> : <Badge variant="secondary" className="text-[11px]">Inactif</Badge>}
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                );
              })}
              {rules.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune règle. Créez votre première règle de marge.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor-specific rules */}
      <div className="bg-white rounded-lg border" style={{ borderColor: "#E2E8F0" }}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Règles spécifiques vendeurs ({vendorRules.length})</h3>
          <span className="text-[11px]" style={{ color: "#8B95A5" }}>{vendorsWithoutRule.length} vendeur(s) sans règle spécifique</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-[11px] uppercase tracking-wide" style={{ backgroundColor: "#F8FAFC", color: "#8B95A5", borderColor: "#E2E8F0" }}>
                <th className="text-left py-2.5 px-4 font-medium">Vendeur</th>
                <th className="text-left py-2.5 px-4 font-medium">Règle</th>
                <th className="text-left py-2.5 px-4 font-medium">Marge</th>
                <th className="text-left py-2.5 px-4 font-medium">Détail</th>
                <th className="text-right py-2.5 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendorRules.map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-[#F8FAFC]" style={{ borderColor: "#E2E8F0" }}>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#1B5BDA14] flex items-center justify-center">
                        <Building2 size={13} className="text-[#1B5BDA]" />
                      </div>
                      <span className="font-medium text-[13px]" style={{ color: "#1D2530" }}>{r.vendors?.company_name || r.vendors?.name || "—"}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-[13px]" style={{ color: "#616B7C" }}>{r.name}</td>
                  <td className="py-2.5 px-4">
                    <Badge className="bg-blue-100 text-blue-700 border-0 text-[11px]">{r.margin_percentage}%</Badge>
                  </td>
                  <td className="py-2.5 px-4 text-xs" style={{ color: "#8B95A5" }}>+{r.extra_delay_days}j délai</td>
                  <td className="py-2.5 px-4 text-right space-x-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
              {vendorRules.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune règle spécifique. Tous les vendeurs utilisent les règles globales.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assigner une règle à un vendeur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vendeur</Label>
              <Select value={assignVendorId} onValueChange={setAssignVendorId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un vendeur" /></SelectTrigger>
                <SelectContent>
                  {vendors.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.company_name || v.name}
                      {vendorsWithRules.has(v.id) && " ✓"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Template de marge</Label>
              <Select value={assignRuleId} onValueChange={setAssignRuleId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un template" /></SelectTrigger>
                <SelectContent>
                  {rules.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} — {r.margin_percentage}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assignVendorId && vendorsWithRules.has(assignVendorId) && (
              <p className="text-[12px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                ⚠️ Ce vendeur a déjà une règle spécifique. Elle sera remplacée.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Annuler</Button>
            <Button
              onClick={() => assignVendorId && assignRuleId && assignMutation.mutate({ vendorId: assignVendorId, templateId: assignRuleId })}
              disabled={!assignVendorId || !assignRuleId || assignMutation.isPending}
            >
              {assignMutation.isPending ? "Assignation…" : "Assigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule?.id ? "Modifier la règle" : "Nouvelle règle de marge"}</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-4">
              <div>
                <Label>Nom</Label>
                <Input value={editingRule.name || ""} onChange={e => setEditingRule({ ...editingRule, name: e.target.value })} placeholder="Ex: Marge standard 15%" />
              </div>

              <div>
                <Label>Marge (%)</Label>
                <Input type="number" step="0.01" value={editingRule.margin_percentage ?? 15} onChange={e => setEditingRule({ ...editingRule, margin_percentage: Number(e.target.value) })} />
                <p className="text-[11px] text-muted-foreground mt-1">Pourcentage ajouté au prix de base Qogita</p>
              </div>

              <div>
                <Label>Priorité</Label>
                <Input type="number" value={editingRule.priority ?? 0} onChange={e => setEditingRule({ ...editingRule, priority: Number(e.target.value) })} />
                <p className="text-[11px] text-muted-foreground mt-1">Plus la priorité est haute, plus la règle est prioritaire</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Délai supplémentaire (jours)</Label>
                  <Input type="number" value={editingRule.extra_delay_days ?? 2} onChange={e => setEditingRule({ ...editingRule, extra_delay_days: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Arrondi prix à</Label>
                  <Input type="number" step="0.01" value={editingRule.round_price_to ?? 0.01} onChange={e => setEditingRule({ ...editingRule, round_price_to: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <Label>Catégorie (optionnel)</Label>
                <Select value={editingRule.category_id || "__none__"} onValueChange={v => setEditingRule({ ...editingRule, category_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Toutes les catégories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Toutes les catégories</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Marque (optionnel)</Label>
                <Select value={editingRule.brand_id || "__none__"} onValueChange={v => setEditingRule({ ...editingRule, brand_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Toutes les marques" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Toutes les marques</SelectItem>
                    {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prix min base (€, optionnel)</Label>
                  <Input type="number" step="0.01" value={editingRule.min_base_price ?? ""} onChange={e => setEditingRule({ ...editingRule, min_base_price: e.target.value ? Number(e.target.value) : null })} placeholder="—" />
                </div>
                <div>
                  <Label>Prix max base (€, optionnel)</Label>
                  <Input type="number" step="0.01" value={editingRule.max_base_price ?? ""} onChange={e => setEditingRule({ ...editingRule, max_base_price: e.target.value ? Number(e.target.value) : null })} placeholder="—" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={editingRule.is_active ?? true} onCheckedChange={v => setEditingRule({ ...editingRule, is_active: v })} />
                <Label>Règle active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => editingRule && saveMutation.mutate(editingRule)} disabled={saveMutation.isPending || !editingRule?.name}>
              {saveMutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
