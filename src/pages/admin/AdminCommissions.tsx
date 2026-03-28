import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Plus, Pencil, Trash2, Percent, Layers, BarChart3, Split, Star, UserPlus, Building2 } from "lucide-react";

type CommissionModel = "fixed_rate" | "tiered_gmv" | "category_based" | "margin_split";

interface Tier { from: number; to: number | null; rate: number }

interface CommissionRule {
  id: string;
  vendor_id: string | null;
  model: CommissionModel;
  name: string;
  is_default: boolean;
  fixed_rate: number | null;
  tiers: Tier[];
  category_rates: Record<string, number>;
  margin_split_mk: number;
  margin_split_vendor: number;
  min_commission: number;
  max_commission: number;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
}

const modelLabels: Record<CommissionModel, string> = {
  fixed_rate: "Taux fixe",
  tiered_gmv: "Paliers GMV",
  category_based: "Par catégorie",
  margin_split: "Split marge",
};

const modelIcons: Record<CommissionModel, React.ElementType> = {
  fixed_rate: Percent,
  tiered_gmv: BarChart3,
  category_based: Layers,
  margin_split: Split,
};

const modelColors: Record<CommissionModel, string> = {
  fixed_rate: "bg-blue-100 text-blue-700",
  tiered_gmv: "bg-purple-100 text-purple-700",
  category_based: "bg-amber-100 text-amber-700",
  margin_split: "bg-emerald-100 text-emerald-700",
};

const emptyRule: Partial<CommissionRule> = {
  name: "",
  model: "fixed_rate",
  is_default: false,
  fixed_rate: 12,
  tiers: [],
  category_rates: {},
  margin_split_mk: 50,
  margin_split_vendor: 50,
  min_commission: 0,
  max_commission: 100,
  notes: "",
};

export default function AdminCommissions() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<CommissionRule> | null>(null);
  const [assignVendorId, setAssignVendorId] = useState("");
  const [assignRuleId, setAssignRuleId] = useState("");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["admin-commission-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("margin_rules")
        .select("*")
        .is("vendor_id", null)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data as unknown as CommissionRule[];
    },
  });

  const { data: vendorRules = [] } = useQuery({
    queryKey: ["admin-commission-vendor-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("margin_rules")
        .select("*, vendors(company_name)")
        .not("vendor_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-vendors-for-commission"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, company_name, is_active, name").eq("is_active", true).order("company_name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (rule: Partial<CommissionRule>) => {
      const payload = {
        name: rule.name,
        model: rule.model,
        is_default: rule.is_default,
        fixed_rate: rule.fixed_rate,
        tiers: JSON.parse(JSON.stringify(rule.tiers || [])),
        category_rates: JSON.parse(JSON.stringify(rule.category_rates || {})),
        margin_split_mk: rule.margin_split_mk,
        margin_split_vendor: rule.margin_split_vendor,
        min_commission: rule.min_commission,
        max_commission: rule.max_commission,
        notes: rule.notes,
      };
      if (rule.id) {
        const { error } = await supabase.from("commission_rules").update(payload).eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("commission_rules").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-commission-rules"] });
      toast.success("Règle de commission sauvegardée");
      setDialogOpen(false);
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commission_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-commission-rules"] });
      queryClient.invalidateQueries({ queryKey: ["admin-commission-vendor-rules"] });
      toast.success("Règle supprimée");
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ vendorId, templateId }: { vendorId: string; templateId: string }) => {
      const template = rules.find(r => r.id === templateId);
      if (!template) throw new Error("Règle introuvable");
      // Delete existing vendor-specific rules
      await supabase.from("commission_rules").delete().eq("vendor_id", vendorId);
      // Clone template for vendor
      const { error } = await supabase.from("commission_rules").insert({
        vendor_id: vendorId,
        name: template.name,
        model: template.model,
        is_default: false,
        fixed_rate: template.fixed_rate,
        tiers: JSON.parse(JSON.stringify(template.tiers || [])),
        category_rates: JSON.parse(JSON.stringify(template.category_rates || {})),
        margin_split_mk: template.margin_split_mk,
        margin_split_vendor: template.margin_split_vendor,
        min_commission: template.min_commission,
        max_commission: template.max_commission,
        notes: `Assigné depuis le template "${template.name}"`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-commission-vendor-rules"] });
      toast.success("Règle assignée au vendeur");
      setAssignOpen(false);
      setAssignVendorId("");
      setAssignRuleId("");
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const openNew = () => { setEditingRule({ ...emptyRule }); setDialogOpen(true); };
  const openEdit = (r: CommissionRule) => { setEditingRule({ ...r }); setDialogOpen(true); };

  // Vendors without a specific rule
  const vendorsWithRules = new Set(vendorRules.map((r: any) => r.vendor_id));
  const vendorsWithoutRule = vendors.filter(v => !vendorsWithRules.has(v.id));

  return (
    <div>
      <AdminTopBar title="Commissions" subtitle="Gérez les modèles de commission appliqués aux vendeurs"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}><UserPlus size={14} className="mr-1" />Assigner à un vendeur</Button>
            <Button size="sm" onClick={openNew} className="bg-[#1E293B] hover:bg-[#1E293B]/90"><Plus size={14} className="mr-1" />Nouvelle règle</Button>
          </div>
        }
      />

      {/* 4 model cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {(["fixed_rate", "tiered_gmv", "category_based", "margin_split"] as CommissionModel[]).map(m => {
          const Icon = modelIcons[m];
          const count = rules.filter(r => r.model === m).length;
          const vendorCount = vendorRules.filter((r: any) => r.model === m).length;
          return (
            <div key={m} className="bg-white rounded-lg border p-4 flex items-start gap-3" style={{ borderColor: "#E2E8F0" }}>
              <div className={`p-2.5 rounded-lg ${modelColors[m]}`}><Icon className="h-5 w-5" /></div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "#1D2530" }}>{modelLabels[m]}</p>
                <p className="text-xs mt-0.5" style={{ color: "#8B95A5" }}>
                  {m === "fixed_rate" && "Pourcentage unique sur chaque vente"}
                  {m === "tiered_gmv" && "Taux dégressif selon le volume mensuel"}
                  {m === "category_based" && "Taux différencié par catégorie produit"}
                  {m === "margin_split" && "Partage de la marge vendeur/MediKong"}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="text-[11px]">{count} template{count > 1 ? "s" : ""}</Badge>
                  {vendorCount > 0 && <Badge variant="outline" className="text-[11px]">{vendorCount} vendeur{vendorCount > 1 ? "s" : ""}</Badge>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rules table */}
      <div className="bg-white rounded-lg border mb-6" style={{ borderColor: "#E2E8F0" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Règles globales (templates)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-[11px] uppercase tracking-wide" style={{ backgroundColor: "#F8FAFC", color: "#8B95A5", borderColor: "#E2E8F0" }}>
                <th className="text-left py-2.5 px-4 font-medium">Nom</th>
                <th className="text-left py-2.5 px-4 font-medium">Modèle</th>
                <th className="text-left py-2.5 px-4 font-medium">Détail</th>
                <th className="text-center py-2.5 px-4 font-medium">Défaut</th>
                <th className="text-center py-2.5 px-4 font-medium">Vendeurs</th>
                <th className="text-right py-2.5 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => {
                const vendorsOnRule = vendorRules.filter((vr: any) => vr.name === r.name).length;
                return (
                  <tr key={r.id} className="border-b hover:bg-[#F8FAFC]" style={{ borderColor: "#E2E8F0" }}>
                    <td className="py-2.5 px-4 font-medium text-[13px]" style={{ color: "#1D2530" }}>{r.name}</td>
                    <td className="py-2.5 px-4">
                      <Badge className={`${modelColors[r.model]} border-0 text-[11px]`}>{modelLabels[r.model]}</Badge>
                    </td>
                    <td className="py-2.5 px-4 text-xs" style={{ color: "#8B95A5" }}>
                      {r.model === "fixed_rate" && `${r.fixed_rate}%`}
                      {r.model === "tiered_gmv" && `${(r.tiers as Tier[])?.length || 0} paliers (${(r.tiers as Tier[])?.map(t => t.rate + "%").join(" → ")})`}
                      {r.model === "category_based" && `${Object.keys(r.category_rates || {}).length} catégories`}
                      {r.model === "margin_split" && `MK ${r.margin_split_mk}% / Vendeur ${r.margin_split_vendor}%`}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {r.is_default && <Star className="h-4 w-4 text-amber-500 mx-auto fill-amber-500" />}
                    </td>
                    <td className="py-2.5 px-4 text-center text-[12px]" style={{ color: "#616B7C" }}>{vendorsOnRule}</td>
                    <td className="py-2.5 px-4 text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {!r.is_default && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rules.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune règle. Créez votre première règle de commission.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor-specific rules */}
      <div className="bg-white rounded-lg border" style={{ borderColor: "#E2E8F0" }}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Règles spécifiques vendeurs ({vendorRules.length})</h3>
          <span className="text-[11px]" style={{ color: "#8B95A5" }}>{vendorsWithoutRule.length} vendeur{vendorsWithoutRule.length > 1 ? "s" : ""} sans règle spécifique (utilise le template par défaut)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-[11px] uppercase tracking-wide" style={{ backgroundColor: "#F8FAFC", color: "#8B95A5", borderColor: "#E2E8F0" }}>
                <th className="text-left py-2.5 px-4 font-medium">Vendeur</th>
                <th className="text-left py-2.5 px-4 font-medium">Règle</th>
                <th className="text-left py-2.5 px-4 font-medium">Modèle</th>
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
                      <span className="font-medium text-[13px]" style={{ color: "#1D2530" }}>{r.vendors?.company_name || "—"}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-[13px]" style={{ color: "#616B7C" }}>{r.name}</td>
                  <td className="py-2.5 px-4">
                    <Badge className={`${modelColors[r.model as CommissionModel]} border-0 text-[11px]`}>{modelLabels[r.model as CommissionModel]}</Badge>
                  </td>
                  <td className="py-2.5 px-4 text-xs" style={{ color: "#8B95A5" }}>
                    {r.model === "fixed_rate" && `${r.fixed_rate}%`}
                    {r.model === "tiered_gmv" && `${(r.tiers as Tier[])?.length || 0} paliers`}
                    {r.model === "category_based" && `${Object.keys(r.category_rates || {}).length} catégories`}
                    {r.model === "margin_split" && `MK ${r.margin_split_mk}% / V ${r.margin_split_vendor}%`}
                  </td>
                  <td className="py-2.5 px-4 text-right space-x-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
              {vendorRules.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune règle spécifique. Tous les vendeurs utilisent le template par défaut.</td></tr>
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
                      {v.company_name} ({v.tier})
                      {vendorsWithRules.has(v.id) && " ✓"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Template de commission</Label>
              <Select value={assignRuleId} onValueChange={setAssignRuleId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un template" /></SelectTrigger>
                <SelectContent>
                  {rules.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} — {modelLabels[r.model]}
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
            <Button onClick={() => assignVendorId && assignRuleId && assignMutation.mutate({ vendorId: assignVendorId, templateId: assignRuleId })} disabled={!assignVendorId || !assignRuleId || assignMutation.isPending}>
              {assignMutation.isPending ? "Assignation…" : "Assigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule?.id ? "Modifier la règle" : "Nouvelle règle de commission"}</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-4">
              <div>
                <Label>Nom</Label>
                <Input value={editingRule.name || ""} onChange={e => setEditingRule({ ...editingRule, name: e.target.value })} />
              </div>
              <div>
                <Label>Modèle</Label>
                <Select value={editingRule.model} onValueChange={v => setEditingRule({ ...editingRule, model: v as CommissionModel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(modelLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {editingRule.model === "fixed_rate" && (
                <div>
                  <Label>Taux (%)</Label>
                  <Input type="number" value={editingRule.fixed_rate ?? 12} onChange={e => setEditingRule({ ...editingRule, fixed_rate: Number(e.target.value) })} />
                </div>
              )}

              {editingRule.model === "tiered_gmv" && (
                <div className="space-y-2">
                  <Label>Paliers de GMV</Label>
                  {((editingRule.tiers as Tier[]) || []).map((t, i) => (
                    <div key={i} className="flex gap-2 items-center text-sm">
                      <Input type="number" placeholder="De €" value={t.from} className="w-24" onChange={e => {
                        const tiers = [...(editingRule.tiers as Tier[])];
                        tiers[i] = { ...tiers[i], from: Number(e.target.value) };
                        setEditingRule({ ...editingRule, tiers });
                      }} />
                      <span>→</span>
                      <Input type="number" placeholder="À €" value={t.to ?? ""} className="w-24" onChange={e => {
                        const tiers = [...(editingRule.tiers as Tier[])];
                        tiers[i] = { ...tiers[i], to: e.target.value ? Number(e.target.value) : null };
                        setEditingRule({ ...editingRule, tiers });
                      }} />
                      <Input type="number" placeholder="%" value={t.rate} className="w-20" onChange={e => {
                        const tiers = [...(editingRule.tiers as Tier[])];
                        tiers[i] = { ...tiers[i], rate: Number(e.target.value) };
                        setEditingRule({ ...editingRule, tiers });
                      }} />
                      <span className="text-xs text-muted-foreground">%</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        const tiers = (editingRule.tiers as Tier[]).filter((_, j) => j !== i);
                        setEditingRule({ ...editingRule, tiers });
                      }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => {
                    const tiers = [...((editingRule.tiers as Tier[]) || []), { from: 0, to: null, rate: 12 }];
                    setEditingRule({ ...editingRule, tiers });
                  }}><Plus className="mr-1 h-3 w-3" />Ajouter un palier</Button>
                </div>
              )}

              {editingRule.model === "category_based" && (
                <div className="space-y-2">
                  <Label>Taux par catégorie</Label>
                  {Object.entries(editingRule.category_rates || {}).map(([cat, rate]) => (
                    <div key={cat} className="flex gap-2 items-center text-sm">
                      <Input value={cat} className="flex-1" onChange={e => {
                        const rates = { ...editingRule.category_rates };
                        delete rates[cat];
                        rates[e.target.value] = rate;
                        setEditingRule({ ...editingRule, category_rates: rates });
                      }} />
                      <Input type="number" value={rate} className="w-20" onChange={e => {
                        setEditingRule({ ...editingRule, category_rates: { ...editingRule.category_rates, [cat]: Number(e.target.value) } });
                      }} />
                      <span className="text-xs text-muted-foreground">%</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        const rates = { ...editingRule.category_rates };
                        delete rates[cat];
                        setEditingRule({ ...editingRule, category_rates: rates });
                      }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditingRule({ ...editingRule, category_rates: { ...editingRule.category_rates, "Nouvelle catégorie": 12 } });
                  }}><Plus className="mr-1 h-3 w-3" />Ajouter une catégorie</Button>
                </div>
              )}

              {editingRule.model === "margin_split" && (
                <div className="space-y-3">
                  <div>
                    <Label>Part MediKong (%)</Label>
                    <Input type="number" value={editingRule.margin_split_mk ?? 50} onChange={e => {
                      const mk = Number(e.target.value);
                      setEditingRule({ ...editingRule, margin_split_mk: mk, margin_split_vendor: 100 - mk });
                    }} />
                  </div>
                  <div>
                    <Label>Part Vendeur (%)</Label>
                    <Input type="number" value={editingRule.margin_split_vendor ?? 50} disabled className="bg-muted" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Commission min (%)</Label>
                  <Input type="number" value={editingRule.min_commission ?? 0} onChange={e => setEditingRule({ ...editingRule, min_commission: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Commission max (%)</Label>
                  <Input type="number" value={editingRule.max_commission ?? 100} onChange={e => setEditingRule({ ...editingRule, max_commission: Number(e.target.value) })} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_default" checked={editingRule.is_default || false} onChange={e => setEditingRule({ ...editingRule, is_default: e.target.checked })} />
                <Label htmlFor="is_default" className="text-sm">Règle par défaut</Label>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={editingRule.notes || ""} onChange={e => setEditingRule({ ...editingRule, notes: e.target.value })} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => editingRule && saveMutation.mutate(editingRule)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}