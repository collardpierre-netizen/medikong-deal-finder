import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, FileText } from "lucide-react";

const CUSTOMER_TYPES = [
  { value: "pharmacy", label: "Pharmacie" },
  { value: "hospital", label: "Hôpital" },
  { value: "clinic", label: "Clinique" },
  { value: "lab", label: "Laboratoire" },
  { value: "other", label: "Autre" },
];

const COUNTRIES = [
  { value: "BE", label: "Belgique" },
  { value: "FR", label: "France" },
  { value: "LU", label: "Luxembourg" },
  { value: "NL", label: "Pays-Bas" },
  { value: "DE", label: "Allemagne" },
];

type Settings = {
  vendor_id: string;
  enabled: boolean;
  default_net_days: number;
  allow_custom_net_days: boolean;
  min_net_days: number;
  max_net_days: number;
  min_order_amount_cents: number;
  auto_remind_enabled: boolean;
  remind_days_before_due: number;
  remind_days_after_due: number[];
};

type Rule = {
  id: string;
  vendor_id: string;
  label: string | null;
  enabled: boolean;
  priority: number;
  customer_id: string | null;
  customer_type: string | null;
  country_code: string | null;
  min_amount_cents: number;
  net_days: number;
};

const defaultSettings: Omit<Settings, "vendor_id"> = {
  enabled: false,
  default_net_days: 30,
  allow_custom_net_days: false,
  min_net_days: 7,
  max_net_days: 60,
  min_order_amount_cents: 0,
  auto_remind_enabled: true,
  remind_days_before_due: 3,
  remind_days_after_due: [1, 7, 14],
};

export default function VendorInvoicePayments() {
  const qc = useQueryClient();
  const { data: vendor } = useCurrentVendor();
  const vendorId = vendor?.id;

  const { data: settingsData, isLoading: loadingS } = useQuery({
    queryKey: ["vendor-invoice-settings", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_invoice_payment_settings")
        .select("*")
        .eq("vendor_id", vendorId!)
        .maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });

  const [form, setForm] = useState<Omit<Settings, "vendor_id">>(defaultSettings);
  useEffect(() => {
    if (settingsData) setForm({ ...defaultSettings, ...settingsData });
  }, [settingsData]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error("Vendeur introuvable");
      const { error } = await supabase
        .from("vendor_invoice_payment_settings")
        .upsert({ vendor_id: vendorId, ...form }, { onConflict: "vendor_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Réglages enregistrés");
      qc.invalidateQueries({ queryKey: ["vendor-invoice-settings", vendorId] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["vendor-invoice-rules", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_invoice_payment_rules")
        .select("*")
        .eq("vendor_id", vendorId!)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data as Rule[];
    },
  });

  const addRule = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error("Vendeur introuvable");
      const { error } = await supabase.from("vendor_invoice_payment_rules").insert({
        vendor_id: vendorId,
        label: "Nouvelle règle",
        enabled: true,
        priority: 100,
        net_days: form.default_net_days,
        min_amount_cents: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-invoice-rules", vendorId] }),
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Rule> }) => {
      const { error } = await supabase.from("vendor_invoice_payment_rules").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-invoice-rules", vendorId] }),
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_invoice_payment_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-invoice-rules", vendorId] }),
  });

  if (loadingS) {
    return <div className="p-8 flex items-center gap-2 text-sm text-mk-sec"><Loader2 className="animate-spin" size={16} /> Chargement…</div>;
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mk-navy flex items-center gap-2">
          <FileText size={22} /> Paiement sur facture
        </h1>
        <p className="text-sm text-mk-sec mt-1">
          Autorisez certains acheteurs à régler après livraison, selon vos propres règles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Activation du paiement sur facture</CardTitle>
              <CardDescription>Active l'option globalement. Les règles ci-dessous décident qui en bénéficie.</CardDescription>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Échéance par défaut (jours)</Label>
            <Input type="number" min={1} max={365} value={form.default_net_days}
              onChange={(e) => setForm({ ...form, default_net_days: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Montant minimum HTVA (€)</Label>
            <Input type="number" min={0} step="0.01" value={form.min_order_amount_cents / 100}
              onChange={(e) => setForm({ ...form, min_order_amount_cents: Math.round(Number(e.target.value) * 100) })} />
          </div>
          <div className="md:col-span-2 flex items-center justify-between p-3 border border-mk-line rounded-md">
            <div>
              <p className="text-sm font-medium text-mk-navy">Autoriser l'acheteur à choisir l'échéance</p>
              <p className="text-xs text-mk-sec">Sinon, l'échéance définie par la règle (ou par défaut) s'applique.</p>
            </div>
            <Switch checked={form.allow_custom_net_days} onCheckedChange={(v) => setForm({ ...form, allow_custom_net_days: v })} />
          </div>
          {form.allow_custom_net_days && (
            <>
              <div>
                <Label className="text-xs">Échéance minimum (jours)</Label>
                <Input type="number" min={1} value={form.min_net_days}
                  onChange={(e) => setForm({ ...form, min_net_days: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Échéance maximum (jours)</Label>
                <Input type="number" min={1} value={form.max_net_days}
                  onChange={(e) => setForm({ ...form, max_net_days: Number(e.target.value) })} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relances automatiques</CardTitle>
          <CardDescription>Configurez les emails de rappel envoyés à l'acheteur.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-mk-navy">Activer les relances</p>
            <Switch checked={form.auto_remind_enabled} onCheckedChange={(v) => setForm({ ...form, auto_remind_enabled: v })} />
          </div>
          {form.auto_remind_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Jours avant échéance</Label>
                <Input type="number" min={0} max={30} value={form.remind_days_before_due}
                  onChange={(e) => setForm({ ...form, remind_days_before_due: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Jours après échéance (séparés par des virgules)</Label>
                <Input value={form.remind_days_after_due.join(",")}
                  onChange={(e) => setForm({
                    ...form,
                    remind_days_after_due: e.target.value
                      .split(",").map((v) => parseInt(v.trim(), 10)).filter((n) => !isNaN(n) && n > 0),
                  })} />
                <p className="text-[11px] text-mk-sec mt-1">Ex. 1, 7, 14</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
          {saveSettings.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}
          Enregistrer les réglages
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Règles d'éligibilité</CardTitle>
              <CardDescription>
                Première règle qui matche (priorité décroissante) gagne. Sans règle, aucun acheteur n'a accès à la facture.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => addRule.mutate()}>
              <Plus size={14} className="mr-1" /> Ajouter une règle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 && (
            <p className="text-sm text-mk-sec italic">Aucune règle. Cliquez sur « Ajouter une règle » pour commencer.</p>
          )}
          {rules.map((r) => (
            <div key={r.id} className="border border-mk-line rounded-md p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <Input className="max-w-xs" value={r.label ?? ""} placeholder="Nom de la règle"
                    onChange={(e) => updateRule.mutate({ id: r.id, patch: { label: e.target.value } })} />
                  <Badge variant={r.enabled ? "default" : "secondary"}>{r.enabled ? "Active" : "Inactive"}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={r.enabled}
                    onCheckedChange={(v) => updateRule.mutate({ id: r.id, patch: { enabled: v } })} />
                  <Button size="sm" variant="ghost" onClick={() => deleteRule.mutate(r.id)}>
                    <Trash2 size={14} className="text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px]">Type de client</Label>
                  <Select value={r.customer_type ?? "_any"}
                    onValueChange={(v) => updateRule.mutate({ id: r.id, patch: { customer_type: v === "_any" ? null : v as any } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_any">Tous</SelectItem>
                      {CUSTOMER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">Pays</Label>
                  <Select value={r.country_code ?? "_any"}
                    onValueChange={(v) => updateRule.mutate({ id: r.id, patch: { country_code: v === "_any" ? null : v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_any">Tous</SelectItem>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">Client spécifique (ID acheteur)</Label>
                  <Input value={r.customer_id ?? ""} placeholder="UUID acheteur (optionnel)"
                    onChange={(e) => updateRule.mutate({ id: r.id, patch: { customer_id: e.target.value.trim() || null } })} />
                </div>
                <div>
                  <Label className="text-[11px]">Montant min HTVA (€)</Label>
                  <Input type="number" min={0} step="0.01" value={r.min_amount_cents / 100}
                    onBlur={(e) => updateRule.mutate({ id: r.id, patch: { min_amount_cents: Math.round(Number(e.target.value) * 100) } })}
                    onChange={() => { /* commit on blur */ }} />
                </div>
                <div>
                  <Label className="text-[11px]">Échéance accordée (jours)</Label>
                  <Input type="number" min={1} max={365} defaultValue={r.net_days}
                    onBlur={(e) => updateRule.mutate({ id: r.id, patch: { net_days: Number(e.target.value) } })} />
                </div>
                <div>
                  <Label className="text-[11px]">Priorité</Label>
                  <Input type="number" defaultValue={r.priority}
                    onBlur={(e) => updateRule.mutate({ id: r.id, patch: { priority: Number(e.target.value) } })} />
                </div>
              </div>
              <p className="text-[11px] text-mk-sec">
                Pour identifier un acheteur précis, copiez son ID depuis vos commandes. Laissez vide pour appliquer la règle à tous les acheteurs correspondant aux autres critères.
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
