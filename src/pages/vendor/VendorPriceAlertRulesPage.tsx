import { useMemo, useState } from "react";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import {
  useVendorPriceAlertRules,
  useUpsertPriceAlertRule,
  useDeletePriceAlertRule,
  useVendorPriceAlertEvents,
  useMarkPriceAlertEvent,
  type RuleScope,
  type RuleMetric,
  type VendorPriceAlertRule,
} from "@/hooks/useVendorPriceAlertRules";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, BellRing, CheckCircle2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { AlertHistoryChart } from "@/components/vendor/AlertHistoryChart";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function useBrands() {
  return useQuery({
    queryKey: ["brands-min"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("brands").select("id,name").order("name").limit(500);
      return data ?? [];
    },
  });
}
function useCategories() {
  return useQuery({
    queryKey: ["categories-min"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("categories").select("id,name").eq("is_active", true).order("name").limit(500);
      return data ?? [];
    },
  });
}

export default function VendorPriceAlertRulesPage() {
  const { data: vendor } = useCurrentVendor();
  const qc = useQueryClient();
  const { data: rules = [], isLoading } = useVendorPriceAlertRules(vendor?.id);
  const { data: events = [], refetch: refetchEvents, isFetching: evaluating } = useVendorPriceAlertEvents(vendor?.id, { autoEvaluate: true });
  const upsert = useUpsertPriceAlertRule(vendor?.id);
  const del = useDeletePriceAlertRule(vendor?.id);
  const mark = useMarkPriceAlertEvent(vendor?.id);
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();

  const globalRule = useMemo(() => rules.find((r) => r.scope === "global" && r.metric === "gap_vs_median"), [rules]);
  const overrides = useMemo(() => rules.filter((r) => r.scope !== "global"), [rules]);

  const [draft, setDraft] = useState<{ scope: RuleScope; ean: string; brand_id: string; category_id: string; threshold: string; metric: RuleMetric; label: string }>({
    scope: "ean", ean: "", brand_id: "", category_id: "", threshold: "10", metric: "gap_vs_median", label: "",
  });

  if (!vendor) return <div className="text-sm text-muted-foreground">Chargement…</div>;

  const handleEvaluate = async () => {
    try {
      await (supabase as any).rpc("evaluate_vendor_price_alerts", { _vendor_id: vendor.id });
      await refetchEvents();
      qc.invalidateQueries({ queryKey: ["vendor-price-alert-events-count", vendor.id] });
      toast.success("Évaluation terminée");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const saveGlobal = async (threshold: number, active: boolean) => {
    await upsert.mutateAsync({
      id: globalRule?.id,
      vendor_id: vendor.id,
      scope: "global",
      threshold_median_pct: threshold,
      metric: "gap_vs_median",
      is_active: active,
    } as any);
    toast.success("Seuil global enregistré");
  };

  const addOverride = async () => {
    const t = parseFloat(draft.threshold);
    if (isNaN(t) || t <= 0) return toast.error("Seuil invalide");
    if (draft.scope === "ean" && !draft.ean.trim()) return toast.error("EAN requis");
    if (draft.scope === "brand" && !draft.brand_id) return toast.error("Marque requise");
    if (draft.scope === "category" && !draft.category_id) return toast.error("Catégorie requise");
    await upsert.mutateAsync({
      vendor_id: vendor.id,
      scope: draft.scope,
      ean: draft.scope === "ean" ? draft.ean.trim() : null,
      brand_id: draft.scope === "brand" ? draft.brand_id : null,
      category_id: draft.scope === "category" ? draft.category_id : null,
      threshold_median_pct: t,
      metric: draft.metric,
      label: draft.label || null,
      is_active: true,
    } as any);
    setDraft({ ...draft, ean: "", brand_id: "", category_id: "", label: "" });
    toast.success("Règle ajoutée");
  };

  return (
    <div className="space-y-5">
      {/* Règle globale */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-[15px] text-[#1D2530]">Seuil global (vs prix médian)</h3>
            <p className="text-[12px] text-[#616B7C] mt-1">
              S'applique à tous mes EAN, sauf si une règle plus spécifique existe.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleEvaluate} disabled={evaluating} className="gap-2">
            <RefreshCw size={14} className={evaluating ? "animate-spin" : ""} />
            Re-évaluer
          </Button>
        </div>
        <div className="mt-4 flex items-end gap-3 flex-wrap">
          <div>
            <Label className="text-[12px]">Seuil (%)</Label>
            <Input
              type="number"
              min={1}
              step={0.5}
              defaultValue={globalRule?.threshold_median_pct ?? 10}
              onBlur={(e) => saveGlobal(parseFloat(e.target.value || "10"), globalRule?.is_active ?? true)}
              className="w-28 h-9"
            />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Switch
              checked={globalRule?.is_active ?? true}
              onCheckedChange={(v) => saveGlobal(globalRule?.threshold_median_pct ?? 10, v)}
            />
            <span className="text-[12px] text-[#616B7C]">Active</span>
          </div>
        </div>
      </Card>

      {/* Ajout d'override */}
      <Card className="p-5">
        <h3 className="font-semibold text-[15px] text-[#1D2530] mb-3">Ajouter un seuil spécifique</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <Label className="text-[12px]">Type</Label>
            <Select value={draft.scope} onValueChange={(v) => setDraft({ ...draft, scope: v as RuleScope })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ean">Par EAN</SelectItem>
                <SelectItem value="brand">Par marque</SelectItem>
                <SelectItem value="category">Par catégorie</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {draft.scope === "ean" && (
            <div className="md:col-span-2">
              <Label className="text-[12px]">EAN / GTIN</Label>
              <Input value={draft.ean} onChange={(e) => setDraft({ ...draft, ean: e.target.value })} placeholder="3401597..." className="h-9" />
            </div>
          )}
          {draft.scope === "brand" && (
            <div className="md:col-span-2">
              <Label className="text-[12px]">Marque</Label>
              <Select value={draft.brand_id} onValueChange={(v) => setDraft({ ...draft, brand_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>{brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {draft.scope === "category" && (
            <div className="md:col-span-2">
              <Label className="text-[12px]">Catégorie</Label>
              <Select value={draft.category_id} onValueChange={(v) => setDraft({ ...draft, category_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-[12px]">Métrique</Label>
            <Select value={draft.metric} onValueChange={(v) => setDraft({ ...draft, metric: v as RuleMetric })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gap_vs_median">vs Médian</SelectItem>
                <SelectItem value="gap_vs_best">vs Meilleur prix</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[12px]">Seuil (%)</Label>
            <Input type="number" min={1} step={0.5} value={draft.threshold} onChange={(e) => setDraft({ ...draft, threshold: e.target.value })} className="h-9" />
          </div>
          <Button onClick={addOverride} size="sm" className="gap-1 h-9">
            <Plus size={14} /> Ajouter
          </Button>
        </div>
      </Card>

      {/* Liste overrides */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b bg-[#F8FAFC]">
          <h3 className="font-semibold text-[14px] text-[#1D2530]">Règles spécifiques ({overrides.length})</h3>
        </div>
        {overrides.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-[#8B95A5]">Aucune règle spécifique. Le seuil global s'applique partout.</div>
        ) : (
          <div className="divide-y">
            {overrides.map((r) => {
              const target =
                r.scope === "ean" ? `EAN ${r.ean}` :
                r.scope === "brand" ? `Marque · ${(brands as any[]).find(b => b.id === r.brand_id)?.name || r.brand_id}` :
                `Catégorie · ${(categories as any[]).find(c => c.id === r.category_id)?.name || r.category_id}`;
              return (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="secondary" className="text-[10px]">{r.scope.toUpperCase()}</Badge>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1D2530] truncate">{target}</p>
                      <p className="text-[11px] text-[#8B95A5]">
                        Seuil : <strong>{r.threshold_median_pct}%</strong> ({r.metric === "gap_vs_best" ? "vs Meilleur" : "vs Médian"})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.is_active} onCheckedChange={(v) => upsert.mutate({ ...r, is_active: v } as any)} />
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 size={14} className="text-[#EF4343]" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Notifications actives */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b bg-[#FFF6E6] flex items-center gap-2">
          <BellRing size={16} className="text-[#D97706]" />
          <h3 className="font-semibold text-[14px] text-[#1D2530]">Notifications actives ({events.length})</h3>
        </div>
        {events.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-[#10B981] flex items-center justify-center gap-2">
            <CheckCircle2 size={16} /> Aucun écart au-dessus de tes seuils. 🎉
          </div>
        ) : (
          <div className="divide-y">
            {events.map((ev) => (
              <div key={ev.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {ev.product?.image_url && <img src={ev.product.image_url} alt="" className="w-10 h-10 rounded object-contain bg-white border" />}
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#1D2530] truncate">{ev.product?.name || ev.product_id}</p>
                    <p className="text-[11px] text-[#8B95A5]">
                      EAN {ev.product?.gtin || "—"} · Mon prix <strong>{ev.my_price.toFixed(2)} €</strong>
                      {ev.median_price ? <> · Médian <strong>{Number(ev.median_price).toFixed(2)} €</strong></> : null}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-[#FEE2E2] text-[#B91C1C] hover:bg-[#FEE2E2]">
                    +{Number(ev.observed_pct).toFixed(1)}% (seuil {ev.threshold_pct}%)
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => mark.mutate({ id: ev.id, status: "resolved" })}>
                    Résoudre
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {isLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}
    </div>
  );
}
