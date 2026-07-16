import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Sparkles, ShieldCheck, XCircle, Save } from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";
import { formatMoneyFromCents, useMoneyFormat } from "@/lib/money-format";

type ModuleCode = "veille_marche" | "analytics" | "bundle";

const MODULE_OPTIONS: { value: ModuleCode; label: string }[] = [
  { value: "veille_marche", label: "Veille marché" },
  { value: "analytics", label: "Analytics ventes" },
];

type StatusRow = {
  vendor_id: string;
  vendor_name: string | null;
  module: ModuleCode;
  status: "none" | "trial" | "active" | "expired" | "cancelled";
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_days_remaining: number | null;
  subscription_current_period_end: string | null;
  plan_id: string | null;
  plan_label: string | null;
  monthly_price_cents: number | null;
  billing_method: "stripe" | "medikong_invoice" | null;
  is_permanent: boolean;
  has_access: boolean;
};

const STATUS_META: Record<StatusRow["status"], { label: string; cls: string }> = {
  none: { label: "Non activé", cls: "bg-muted text-muted-foreground" },
  trial: { label: "Essai", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  active: { label: "Abonné", cls: "bg-primary text-primary-foreground" },
  expired: { label: "Expiré", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  cancelled: { label: "Annulé", cls: "bg-rose-100 text-rose-800 border-rose-300" },
};

// ─── ONGLET 1 : VENDEURS ───────────────────────────────
function VendorsTab() {
  const qc = useQueryClient();
  const { locale } = useMoneyFormat();
  const [moduleFilter, setModuleFilter] = useState<ModuleCode>("veille_marche");
  const [search, setSearch] = useState("");
  const [grantDialog, setGrantDialog] = useState<{
    vendorId: string;
    vendorName: string;
    module: ModuleCode;
  } | null>(null);
  const [grantMode, setGrantMode] = useState<"trial" | "subscription" | "permanent">("trial");
  const [grantPlanId, setGrantPlanId] = useState<string>("");
  const [grantTrialDays, setGrantTrialDays] = useState(180);
  const [grantBilling, setGrantBilling] = useState<"stripe" | "medikong_invoice">("medikong_invoice");
  const [grantNotes, setGrantNotes] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-intel-list", moduleFilter, search],
    queryFn: async () => {
      let q: any = supabase
        .from("vendor_intelligence_status_v" as any)
        .select("*")
        .eq("module", moduleFilter)
        .limit(500);
      if (search.trim().length >= 2) q = q.ilike("vendor_name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data as StatusRow[]) || [];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["admin-intel-plans", moduleFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_intelligence_plans" as any)
        .select("id, code, label, monthly_price_cents, metric_config, sort_order, is_active")
        .eq("module", moduleFilter)
        .order("sort_order");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const grant = useMutation({
    mutationFn: async (args: {
      vendorId: string;
      module: ModuleCode;
      planId: string | null;
      isPermanent: boolean;
      trialDays: number | null;
      billing: string | null;
      notes: string | null;
    }) => {
      const { error } = await supabase.rpc("intelligence_grant" as any, {
        _vendor_id: args.vendorId,
        _module: args.module,
        _plan_id: args.planId,
        _is_permanent: args.isPermanent,
        _trial_days: args.trialDays,
        _billing_method: args.billing,
        _notes: args.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entitlement mis à jour");
      setGrantDialog(null);
      setGrantPlanId("");
      setGrantNotes("");
      qc.invalidateQueries({ queryKey: ["admin-intel-list"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const openGrant = (row: StatusRow, mode: "trial" | "subscription" | "permanent") => {
    setGrantDialog({
      vendorId: row.vendor_id,
      vendorName: row.vendor_name || row.vendor_id,
      module: row.module,
    });
    setGrantMode(mode);
    setGrantPlanId(row.plan_id || "");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Module</Label>
          <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as ModuleCode)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODULE_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Rechercher un vendeur…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Chargement…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Vendeur</th>
                  <th className="px-3 py-2 text-left">Statut</th>
                  <th className="px-3 py-2 text-left">Palier</th>
                  <th className="px-3 py-2 text-left">Fin d'essai / abo</th>
                  <th className="px-3 py-2 text-left">Accès</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status];
                  const endDate =
                    r.trial_ends_at || r.subscription_current_period_end || null;
                  return (
                    <tr key={`${r.vendor_id}-${r.module}`} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{r.vendor_name || "—"}</td>
                      <td className="px-3 py-2">
                        <Badge className={meta.cls}>{meta.label}</Badge>
                        {r.is_permanent && (
                          <Badge variant="outline" className="ml-1">Permanent</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.plan_label || "—"}
                        {r.monthly_price_cents != null && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({formatMoneyFromCents(r.monthly_price_cents, { locale, fractionDigits: 0 })}/mois)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {endDate ? formatUpdatedAt(endDate) : "—"}
                        {r.trial_days_remaining != null && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (J-{r.trial_days_remaining})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.has_access ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Ouvert</Badge>
                        ) : (
                          <Badge variant="outline">Fermé</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => openGrant(r, "trial")}>
                            <Sparkles className="h-3 w-3 mr-1" /> Essai
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openGrant(r, "subscription")}>
                            Abonner
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openGrant(r, "permanent")}>
                            <ShieldCheck className="h-3 w-3 mr-1" /> Permanent
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      Aucun vendeur trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!grantDialog} onOpenChange={(o) => !o && setGrantDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {grantMode === "trial"
                ? "Activer un essai"
                : grantMode === "subscription"
                  ? "Activer un abonnement"
                  : "Accorder un accès permanent"}
            </DialogTitle>
          </DialogHeader>
          {grantDialog && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Vendeur : </span>
                <span className="font-medium">{grantDialog.vendorName}</span>
                <span className="text-muted-foreground ml-2">· Module : </span>
                <span className="font-medium">
                  {MODULE_OPTIONS.find((m) => m.value === grantDialog.module)?.label}
                </span>
              </div>

              {grantMode === "trial" && (
                <div>
                  <Label>Durée d'essai (jours)</Label>
                  <Input
                    type="number"
                    value={grantTrialDays}
                    onChange={(e) => setGrantTrialDays(parseInt(e.target.value) || 0)}
                    min={1}
                  />
                </div>
              )}

              {(grantMode === "subscription" || grantMode === "permanent") && (
                <div>
                  <Label>Palier</Label>
                  <Select value={grantPlanId} onValueChange={setGrantPlanId}>
                    <SelectTrigger><SelectValue placeholder="Choisir un palier…" /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label} — {formatMoneyFromCents(p.monthly_price_cents, { locale, fractionDigits: 0 })}/mois
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {grantMode === "subscription" && (
                <div>
                  <Label>Facturation</Label>
                  <Select value={grantBilling} onValueChange={(v) => setGrantBilling(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medikong_invoice">Facture MediKong</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Notes (optionnel)</Label>
                <Textarea rows={2} value={grantNotes} onChange={(e) => setGrantNotes(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantDialog(null)}>Annuler</Button>
            <Button
              onClick={() =>
                grantDialog &&
                grant.mutate({
                  vendorId: grantDialog.vendorId,
                  module: grantDialog.module,
                  planId: grantMode === "trial" ? null : grantPlanId || null,
                  isPermanent: grantMode === "permanent",
                  trialDays: grantMode === "trial" ? grantTrialDays : null,
                  billing: grantMode === "subscription" ? grantBilling : null,
                  notes: grantNotes || null,
                })
              }
              disabled={
                grant.isPending ||
                ((grantMode === "subscription" || grantMode === "permanent") && !grantPlanId)
              }
            >
              {grant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── ONGLET 2 : PALIERS ────────────────────────────────
function PlansTab() {
  const qc = useQueryClient();
  const { locale } = useMoneyFormat();
  const [moduleFilter, setModuleFilter] = useState<ModuleCode>("analytics");
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["admin-intel-plans-full", moduleFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_intelligence_plans" as any)
        .select("*")
        .eq("module", moduleFilter)
        .order("sort_order");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const savePlan = useMutation({
    mutationFn: async (p: any) => {
      const payload = {
        module: moduleFilter,
        code: p.code,
        label: p.label,
        description: p.description || null,
        monthly_price_cents: p.monthly_price_cents || 0,
        currency: p.currency || "EUR",
        metric_config: p.metric_config || { kind: "unlimited" },
        sort_order: p.sort_order || 0,
        is_active: p.is_active ?? true,
        stripe_price_id: p.stripe_price_id || null,
      };
      if (p.id) {
        const { error } = await supabase.from("vendor_intelligence_plans" as any).update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vendor_intelligence_plans" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Palier sauvegardé");
      setEditing(null);
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["admin-intel-plans-full"] });
      qc.invalidateQueries({ queryKey: ["intel-plans"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_intelligence_plans" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Palier supprimé");
      qc.invalidateQueries({ queryKey: ["admin-intel-plans-full"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Module</Label>
          <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as ModuleCode)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODULE_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nouveau palier
        </Button>
      </div>

      <div className="grid gap-3">
        {isLoading && <div className="text-muted-foreground text-sm">Chargement…</div>}
        {plans.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-64">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{p.label}</span>
                  <Badge variant="outline">{p.code}</Badge>
                  {!p.is_active && <Badge variant="destructive">Inactif</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{p.description || "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  metric_config : <code className="font-mono">{JSON.stringify(p.metric_config)}</code>
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">
                  {formatMoneyFromCents(p.monthly_price_cents, { locale, fractionDigits: 0 })}/mois
                </p>
                <p className="text-xs text-muted-foreground">sort {p.sort_order}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Éditer</Button>
                <Button size="sm" variant="outline" onClick={() => {
                  if (confirm(`Supprimer le palier « ${p.label} » ?`)) deletePlan.mutate(p.id);
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && plans.length === 0 && (
          <div className="text-muted-foreground text-sm text-center py-8">
            Aucun palier pour ce module.
          </div>
        )}
      </div>

      <PlanEditor
        open={!!editing || creating}
        plan={editing || { module: moduleFilter, is_active: true, currency: "EUR", monthly_price_cents: 0, sort_order: (plans[plans.length - 1]?.sort_order ?? 0) + 1, metric_config: { kind: "unlimited" } }}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={(p) => savePlan.mutate(p)}
        isPending={savePlan.isPending}
      />
    </div>
  );
}

function PlanEditor({
  open, plan, onClose, onSave, isPending,
}: {
  open: boolean; plan: any; onClose: () => void; onSave: (p: any) => void; isPending: boolean;
}) {
  const [form, setForm] = useState<any>(plan);
  useMemo(() => setForm(plan), [plan]);
  const mc = form.metric_config || { kind: "unlimited" };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Éditer le palier" : "Nouveau palier"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code (unique)</Label>
              <Input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <Label>Label</Label>
              <Input value={form.label || ""} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prix mensuel (centimes)</Label>
              <Input type="number" value={form.monthly_price_cents || 0} onChange={(e) => setForm({ ...form, monthly_price_cents: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Ordre</Label>
              <Input type="number" value={form.sort_order || 0} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="border rounded-md p-3 space-y-2 bg-muted/30">
            <Label className="text-xs uppercase text-muted-foreground">metric_config</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kind</Label>
                <Select
                  value={mc.kind}
                  onValueChange={(v) => setForm({ ...form, metric_config: { ...mc, kind: v } })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ean_quota">ean_quota</SelectItem>
                    <SelectItem value="monthly_gmv_cents">monthly_gmv_cents</SelectItem>
                    <SelectItem value="unlimited">unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {mc.kind !== "unlimited" && (
                <div>
                  <Label>Threshold</Label>
                  <Input
                    type="number"
                    value={mc.threshold || 0}
                    onChange={(e) => setForm({ ...form, metric_config: { ...mc, threshold: parseInt(e.target.value) || 0 } })}
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Label suffix (affiché)</Label>
              <Input
                value={mc.label_suffix || ""}
                onChange={(e) => setForm({ ...form, metric_config: { ...mc, label_suffix: e.target.value } })}
              />
            </div>
          </div>
          <div>
            <Label>Stripe price ID (optionnel)</Label>
            <Input value={form.stripe_price_id || ""} onChange={(e) => setForm({ ...form, stripe_price_id: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label>Actif</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(form)} disabled={isPending || !form.code || !form.label}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" /> Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ONGLET 3 : ONGLETS ANALYTICS ─────────────────────
function TabFlagsTab() {
  const qc = useQueryClient();
  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["admin-intel-tab-flags", "analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intelligence_module_tab_flags" as any)
        .select("*")
        .eq("module", "analytics")
        .order("sort_order");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const toggleFree = useMutation({
    mutationFn: async (args: { id: string; is_free: boolean }) => {
      const { error } = await supabase
        .from("intelligence_module_tab_flags" as any)
        .update({ is_free: args.is_free })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-intel-tab-flags"] });
      qc.invalidateQueries({ queryKey: ["intel-tab-flags"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Onglets Analytics — gratuit vs payant</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground text-sm"><Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Chargement…</div>
        ) : (
          <div className="space-y-2">
            {flags.map((f) => (
              <div key={f.id} className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <p className="font-medium">{f.label}</p>
                  <code className="text-xs text-muted-foreground">{f.tab_key}</code>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={f.is_free}
                    onCheckedChange={(v) => toggleFree.mutate({ id: f.id, is_free: v })}
                  />
                  <Label className="text-sm">
                    {f.is_free ? (
                      <Badge variant="outline" className="border-emerald-300 text-emerald-800">Gratuit</Badge>
                    ) : (
                      <Badge>Payant</Badge>
                    )}
                  </Label>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ONGLET 4 : RÉGLAGES GLOBAUX ───────────────────────
function GlobalSettingsTab() {
  const qc = useQueryClient();
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["admin-intel-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("intelligence_module_settings" as any).select("*");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
  const { data: bundle } = useQuery({
    queryKey: ["admin-intel-bundle"],
    queryFn: async () => {
      const { data, error } = await supabase.from("intelligence_bundle_settings" as any).select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveSetting = useMutation({
    mutationFn: async (args: { module: ModuleCode; default_trial_days: number; label: string; description: string | null }) => {
      const { error } = await supabase
        .from("intelligence_module_settings" as any)
        .update({
          default_trial_days: args.default_trial_days,
          label: args.label,
          description: args.description,
        })
        .eq("module", args.module);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Réglages enregistrés");
      qc.invalidateQueries({ queryKey: ["admin-intel-settings"] });
      qc.invalidateQueries({ queryKey: ["intel-module-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const toggleBundle = useMutation({
    mutationFn: async (is_enabled: boolean) => {
      const { error } = await supabase
        .from("intelligence_bundle_settings" as any)
        .update({ is_enabled })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-intel-bundle"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Durée d'essai + libellés par module</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <div className="text-muted-foreground text-sm">Chargement…</div>}
          {settings.map((s) => (
            <ModuleSettingsRow key={s.module} setting={s} onSave={(u) => saveSetting.mutate(u)} pending={saveSetting.isPending} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bundle 2-en-1</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Activer le bundle Veille marché + Analytics</p>
              <p className="text-sm text-muted-foreground">
                Si activé, un entitlement <code>module='bundle'</code> ouvre l'accès aux 2 modules simultanément.
              </p>
            </div>
            <Switch
              checked={!!(bundle as any)?.is_enabled}
              onCheckedChange={(v) => toggleBundle.mutate(v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ModuleSettingsRow({ setting, onSave, pending }: {
  setting: any; onSave: (u: any) => void; pending: boolean;
}) {
  const [days, setDays] = useState(setting.default_trial_days);
  const [label, setLabel] = useState(setting.label);
  const [description, setDescription] = useState(setting.description || "");
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge>{setting.module}</Badge>
        <span className="text-xs text-muted-foreground">metric_kind : {setting.metric_kind}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Label affiché</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Durée d'essai (jours)</Label>
          <Input type="number" value={days} onChange={(e) => setDays(parseInt(e.target.value) || 0)} />
        </div>
        <div className="flex items-end">
          <Button size="sm" disabled={pending} onClick={() => onSave({ module: setting.module, default_trial_days: days, label, description: description || null })}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-1" /> Enregistrer
          </Button>
        </div>
      </div>
      <div>
        <Label className="text-xs">Description</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </div>
  );
}

// ─── PAGE ───────────────────────────────────────────────
export default function AdminIntelligenceModulesPage() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
      <Helmet><title>Modules Intelligence — Admin MediKong</title></Helmet>
      <div>
        <h1 className="text-2xl font-bold text-[#1D2530]">Modules Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pilotage entitlements, paliers tarifaires, flags d'onglets et réglages globaux — Veille marché + Analytics ventes.
        </p>
      </div>

      <Tabs defaultValue="vendors">
        <TabsList>
          <TabsTrigger value="vendors">Vendeurs</TabsTrigger>
          <TabsTrigger value="plans">Paliers</TabsTrigger>
          <TabsTrigger value="tabs">Onglets Analytics</TabsTrigger>
          <TabsTrigger value="global">Réglages globaux</TabsTrigger>
        </TabsList>
        <TabsContent value="vendors" className="mt-4"><VendorsTab /></TabsContent>
        <TabsContent value="plans" className="mt-4"><PlansTab /></TabsContent>
        <TabsContent value="tabs" className="mt-4"><TabFlagsTab /></TabsContent>
        <TabsContent value="global" className="mt-4"><GlobalSettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
