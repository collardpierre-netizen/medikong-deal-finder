import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Coins,
  Calendar,
  Infinity as InfinityIcon,
  Lock,
} from "lucide-react";

/**
 * Configuration admin des plans de monétisation RFQ.
 *
 * 3 modes alignés sur la mémoire `RFQ Monetization Engine` :
 *   • Paywall / quota gratuit (`free_quota`) : N RFQ/mois inclus, bloque côté serveur.
 *   • Crédits par demande (`credit_pack`)    : pack à vie, X crédits pour Y €.
 *   • Forfait mensuel (`monthly_plan` / `unlimited_plan`) : quota mensuel ou illimité.
 *
 * Édite la table `rfq_plans` (RLS `rfq_plans_admin_all`).
 */

type PlanType = "free_quota" | "credit_pack" | "monthly_plan" | "unlimited_plan";

interface RfqPlan {
  id: string;
  code: string;
  label: string;
  description: string | null;
  plan_type: PlanType;
  monthly_quota: number;
  credits_included: number;
  is_unlimited: boolean;
  price_cents: number;
  currency: string;
  duration_days: number | null;
  stripe_price_id: string | null;
  is_active: boolean;
  sort_order: number;
}

const PLAN_TYPE_META: Record<PlanType, { label: string; icon: React.ReactNode; hint: string }> = {
  free_quota: {
    label: "Paywall (quota gratuit)",
    icon: <Lock className="h-3.5 w-3.5" />,
    hint: "Ex. 3 RFQ/mois offertes, bloque ensuite.",
  },
  credit_pack: {
    label: "Crédits par demande",
    icon: <Coins className="h-3.5 w-3.5" />,
    hint: "Pack à vie, ex. 10 crédits pour 49 €.",
  },
  monthly_plan: {
    label: "Forfait mensuel",
    icon: <Calendar className="h-3.5 w-3.5" />,
    hint: "Quota inclus mensuel, ex. 25 RFQ pour 79 €/mois.",
  },
  unlimited_plan: {
    label: "Forfait illimité",
    icon: <InfinityIcon className="h-3.5 w-3.5" />,
    hint: "RFQ illimitées tant que l'abonnement est actif.",
  },
};

const EMPTY_PLAN: Omit<RfqPlan, "id"> = {
  code: "",
  label: "",
  description: "",
  plan_type: "credit_pack",
  monthly_quota: 0,
  credits_included: 0,
  is_unlimited: false,
  price_cents: 0,
  currency: "EUR",
  duration_days: null,
  stripe_price_id: null,
  is_active: true,
  sort_order: 0,
};

function formatEur(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function AdminRfqPlansPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<RfqPlan | null>(null);
  const [creating, setCreating] = useState<Omit<RfqPlan, "id"> | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-rfq-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_plans")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RfqPlan[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (plan: RfqPlan | Omit<RfqPlan, "id">) => {
      // Garde-fous métier
      if (!plan.code.trim() || !plan.label.trim()) {
        throw new Error("Le code et le libellé sont requis.");
      }
      const payload = {
        ...plan,
        // Coercitions par type pour cohérence métier
        is_unlimited: plan.plan_type === "unlimited_plan" ? true : plan.is_unlimited,
        credits_included:
          plan.plan_type === "credit_pack" ? plan.credits_included : 0,
        monthly_quota:
          plan.plan_type === "monthly_plan" || plan.plan_type === "free_quota"
            ? plan.monthly_quota
            : 0,
        duration_days:
          plan.plan_type === "monthly_plan" || plan.plan_type === "unlimited_plan"
            ? plan.duration_days ?? 30
            : null,
      };

      if ("id" in plan && plan.id) {
        const { error } = await supabase.from("rfq_plans").update(payload).eq("id", plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rfq_plans").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-rfq-plans"] });
      setEditing(null);
      setCreating(null);
      toast.success("Plan enregistré");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rfq_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-rfq-plans"] });
      toast.success("Plan supprimé");
    },
    onError: (e: any) => toast.error(e?.message ?? "Suppression impossible (références existantes ?)"),
  });

  const toggleActive = useMutation({
    mutationFn: async (plan: RfqPlan) => {
      const { error } = await supabase
        .from("rfq_plans")
        .update({ is_active: !plan.is_active })
        .eq("id", plan.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-rfq-plans"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const editingTarget = editing ?? creating;
  const isEdit = !!editing;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Monétisation RFQ — Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure les 3 modes : <strong>paywall</strong> (quota gratuit),{" "}
            <strong>crédits par demande</strong> (pack à vie) et{" "}
            <strong>forfait mensuel</strong> (quota ou illimité).
          </p>
        </div>
        <Button onClick={() => setCreating({ ...EMPTY_PLAN })}>
          <Plus className="h-4 w-4 mr-1" />
          Nouveau plan
        </Button>
      </div>

      {/* Légende des 3 modes */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.entries(PLAN_TYPE_META) as [PlanType, typeof PLAN_TYPE_META[PlanType]][]).map(
          ([key, meta]) => (
            <Card key={key} className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {meta.icon}
                  {meta.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{meta.hint}</p>
              </CardContent>
            </Card>
          )
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plans configurés</CardTitle>
          <CardDescription>
            L'ordre d'affichage sur la page acheteur suit <code>sort_order</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-left">Libellé</th>
                    <th className="px-3 py-2 text-left">Mode</th>
                    <th className="px-3 py-2 text-right">Prix</th>
                    <th className="px-3 py-2 text-right">Inclus</th>
                    <th className="px-3 py-2 text-right">Durée</th>
                    <th className="px-3 py-2 text-center">Ordre</th>
                    <th className="px-3 py-2 text-center">Actif</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(plans ?? []).map((p) => {
                    const meta = PLAN_TYPE_META[p.plan_type];
                    const inclus =
                      p.plan_type === "unlimited_plan"
                        ? "Illimité"
                        : p.plan_type === "credit_pack"
                        ? `${p.credits_included} crédits`
                        : `${p.monthly_quota} RFQ/mois`;
                    return (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                        <td className="px-3 py-2 font-medium">{p.label}</td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="gap-1">
                            {meta.icon}
                            {meta.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.price_cents > 0 ? formatEur(p.price_cents) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{inclus}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.duration_days ? `${p.duration_days} j` : "—"}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums">{p.sort_order}</td>
                        <td className="px-3 py-2 text-center">
                          <Switch
                            checked={p.is_active}
                            onCheckedChange={() => toggleActive.mutate(p)}
                          />
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(p)}
                            aria-label="Éditer"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Supprimer le plan "${p.label}" ?`)) {
                                deleteMutation.mutate(p.id);
                              }
                            }}
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {(plans ?? []).length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                        Aucun plan configuré.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog création / édition */}
      <Dialog
        open={!!editingTarget}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setCreating(null);
          }
        }}
      >
        {editingTarget && (
          <PlanFormDialog
            initial={editingTarget}
            isEdit={isEdit}
            saving={upsertMutation.isPending}
            onSubmit={(p) => upsertMutation.mutate(isEdit ? ({ ...p, id: (editing as RfqPlan).id } as RfqPlan) : p)}
          />
        )}
      </Dialog>
    </div>
  );
}

function PlanFormDialog({
  initial,
  isEdit,
  saving,
  onSubmit,
}: {
  initial: Omit<RfqPlan, "id"> | RfqPlan;
  isEdit: boolean;
  saving: boolean;
  onSubmit: (p: Omit<RfqPlan, "id"> | RfqPlan) => void;
}) {
  const [form, setForm] = useState<Omit<RfqPlan, "id"> | RfqPlan>(initial);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const meta = PLAN_TYPE_META[form.plan_type];

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Éditer le plan" : "Créer un plan"}</DialogTitle>
        <DialogDescription>{meta.hint}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="code">Code (slug unique)</Label>
            <Input
              id="code"
              value={form.code}
              onChange={(e) => update("code", e.target.value)}
              placeholder="pack_25"
              disabled={isEdit}
            />
          </div>
          <div>
            <Label htmlFor="label">Libellé</Label>
            <Input
              id="label"
              value={form.label}
              onChange={(e) => update("label", e.target.value)}
              placeholder="Pack 25 crédits"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="plan_type">Mode de monétisation</Label>
          <Select value={form.plan_type} onValueChange={(v) => update("plan_type", v as PlanType)}>
            <SelectTrigger id="plan_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(PLAN_TYPE_META) as [PlanType, typeof PLAN_TYPE_META[PlanType]][]).map(
                ([key, m]) => (
                  <SelectItem key={key} value={key}>
                    <span className="inline-flex items-center gap-2">
                      {m.icon}
                      {m.label}
                    </span>
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">{meta.hint}</p>
        </div>

        <div>
          <Label htmlFor="description">Description (optionnelle)</Label>
          <Textarea
            id="description"
            rows={2}
            value={form.description ?? ""}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="price">Prix (€)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={(form.price_cents / 100).toFixed(2)}
              onChange={(e) =>
                update("price_cents", Math.round(parseFloat(e.target.value || "0") * 100))
              }
            />
          </div>

          {form.plan_type === "credit_pack" && (
            <div>
              <Label htmlFor="credits">Crédits inclus</Label>
              <Input
                id="credits"
                type="number"
                min="0"
                value={form.credits_included}
                onChange={(e) => update("credits_included", parseInt(e.target.value || "0", 10))}
              />
            </div>
          )}

          {(form.plan_type === "monthly_plan" || form.plan_type === "free_quota") && (
            <div>
              <Label htmlFor="quota">Quota mensuel (RFQ)</Label>
              <Input
                id="quota"
                type="number"
                min="0"
                value={form.monthly_quota}
                onChange={(e) => update("monthly_quota", parseInt(e.target.value || "0", 10))}
              />
            </div>
          )}

          {(form.plan_type === "monthly_plan" || form.plan_type === "unlimited_plan") && (
            <div>
              <Label htmlFor="duration">Durée (jours)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={form.duration_days ?? 30}
                onChange={(e) => update("duration_days", parseInt(e.target.value || "30", 10))}
              />
            </div>
          )}

          <div>
            <Label htmlFor="sort_order">Ordre d'affichage</Label>
            <Input
              id="sort_order"
              type="number"
              value={form.sort_order}
              onChange={(e) => update("sort_order", parseInt(e.target.value || "0", 10))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="stripe">Stripe price ID (optionnel)</Label>
            <Input
              id="stripe"
              value={form.stripe_price_id ?? ""}
              onChange={(e) => update("stripe_price_id", e.target.value || null)}
              placeholder="price_..."
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={form.is_active}
                onCheckedChange={(v) => update("is_active", v)}
              />
              <Label htmlFor="active">Actif</Label>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={() => onSubmit(form)} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {isEdit ? "Enregistrer" : "Créer le plan"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
