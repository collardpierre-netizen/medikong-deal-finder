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
import { Plus, Pencil, Trash2, Percent, Layers, BarChart3, Split, Star } from "lucide-react";

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
  const [editingRule, setEditingRule] = useState<Partial<CommissionRule> | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["admin-commission-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_rules")
        .select("*")
        .is("vendor_id", null)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data as unknown as CommissionRule[];
    },
  });

  const { data: vendorRules = [] } = useQuery({
    queryKey: ["admin-commission-vendor-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_rules")
        .select("*, vendors(company_name)")
        .not("vendor_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
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
      toast.success("Règle supprimée");
    },
  });

  const openNew = () => { setEditingRule({ ...emptyRule }); setDialogOpen(true); };
  const openEdit = (r: CommissionRule) => { setEditingRule({ ...r }); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commissions</h1>
          <p className="text-sm text-muted-foreground mt-1">Gérez les modèles de commission appliqués aux vendeurs</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nouvelle règle</Button>
      </div>

      {/* 4 model cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {(["fixed_rate", "tiered_gmv", "category_based", "margin_split"] as CommissionModel[]).map(m => {
          const Icon = modelIcons[m];
          const count = rules.filter(r => r.model === m).length;
          return (
            <Card key={m} className="border">
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${modelColors[m]}`}><Icon className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold text-sm">{modelLabels[m]}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m === "fixed_rate" && "Pourcentage unique sur chaque vente"}
                    {m === "tiered_gmv" && "Taux dégressif selon le volume mensuel"}
                    {m === "category_based" && "Taux différencié par catégorie produit"}
                    {m === "margin_split" && "Partage de la marge vendeur/MediKong"}
                  </p>
                  <Badge variant="secondary" className="mt-2 text-[11px]">{count} règle{count > 1 ? "s" : ""}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rules table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Règles globales (templates)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left py-2.5 px-4 font-medium">Nom</th>
                  <th className="text-left py-2.5 px-4 font-medium">Modèle</th>
                  <th className="text-left py-2.5 px-4 font-medium">Détail</th>
                  <th className="text-center py-2.5 px-4 font-medium">Défaut</th>
                  <th className="text-right py-2.5 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-medium">{r.name}</td>
                    <td className="py-2.5 px-4">
                      <Badge className={`${modelColors[r.model]} border-0 text-[11px]`}>{modelLabels[r.model]}</Badge>
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">
                      {r.model === "fixed_rate" && `${r.fixed_rate}%`}
                      {r.model === "tiered_gmv" && `${(r.tiers as Tier[])?.length || 0} paliers`}
                      {r.model === "category_based" && `${Object.keys(r.category_rates || {}).length} catégories`}
                      {r.model === "margin_split" && `MK ${r.margin_split_mk}% / Vendeur ${r.margin_split_vendor}%`}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {r.is_default && <Star className="h-4 w-4 text-amber-500 mx-auto fill-amber-500" />}
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {!r.is_default && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Vendor-specific rules */}
      {vendorRules.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Règles spécifiques vendeurs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left py-2.5 px-4 font-medium">Vendeur</th>
                    <th className="text-left py-2.5 px-4 font-medium">Règle</th>
                    <th className="text-left py-2.5 px-4 font-medium">Modèle</th>
                    <th className="text-left py-2.5 px-4 font-medium">Détail</th>
                    <th className="text-right py-2.5 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorRules.map((r: any) => (
                    <tr key={r.id} className="border-b hover:bg-muted/20">
                      <td className="py-2.5 px-4 font-medium">{r.vendors?.company_name || "—"}</td>
                      <td className="py-2.5 px-4">{r.name}</td>
                      <td className="py-2.5 px-4">
                        <Badge className={`${modelColors[r.model as CommissionModel]} border-0 text-[11px]`}>{modelLabels[r.model as CommissionModel]}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground text-xs">
                        {r.model === "fixed_rate" && `${r.fixed_rate}%`}
                        {r.model === "margin_split" && `MK ${r.margin_split_mk}% / V ${r.margin_split_vendor}%`}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
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
