/**
 * Onboarding « Vos conditions » — 4 écrans, passable, < 2 min.
 * Stockage : pharmacist_wholesaler_settings (customer_id + override_rules_json v2).
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useScanCustomer } from "./ScanGate";

const sb = supabase as any;

export const SCAN_GAMMES = [
  { id: "eb63a278-5129-4283-b9c7-2192cf0e81bd", label: "Nutrition infantile (laits, bébé)" },
  { id: "6d6b71a9-271c-44a6-99e0-d2cbfb5a98e2", label: "Compléments & nutrition médicale" },
];

type W = { id: string; slug: string; display_name: string };
type Row = { checked: boolean; pct: string; depot: string; gammes: Record<string, string>; settingId?: string; rules?: any };

const num = (s: string) => {
  const v = Number(String(s).replace(",", "."));
  return Number.isFinite(v) && s.trim() !== "" ? Math.min(80, Math.max(0, v)) : null;
};

export default function ScanConditionsPage() {
  const customer = useScanCustomer();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [otherWholesaler, setOtherWholesaler] = useState("");
  const [labs, setLabs] = useState("");
  const [yearEnd, setYearEnd] = useState(false);
  const [freeGoods, setFreeGoods] = useState(false);
  const [saving, setSaving] = useState(false);
  const initializedCustomer = useRef<string | null>(null);

  const { data: ws = [], isLoading: wholesalersLoading, isError: wholesalersError } = useQuery<W[]>({
    queryKey: ["scan-wholesalers"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("scan_list_wholesalers");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: existing, isLoading: conditionsLoading, isError: conditionsError } = useQuery({
    queryKey: ["scan-conditions", customer.id],
    queryFn: async () => {
      const { data, error } = await sb.from("pharmacist_wholesaler_settings")
      .select("id, wholesaler_profile_id, is_supplier_of_pharmacist, override_default_discount_pct, override_rules_json")
      .eq("customer_id", customer.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!ws.length || existing === undefined || initializedCustomer.current === customer.id) return;
    const next: Record<string, Row> = {};
    let sharedRules: any = {};
    for (const w of ws) {
      const s = existing.find((e: any) => e.wholesaler_profile_id === w.id);
      const r = s?.override_rules_json ?? {};
      next[w.id] = {
        checked: !!s && s.is_supplier_of_pharmacist !== false,
        pct: s?.override_default_discount_pct != null ? String(s.override_default_discount_pct) : "",
        depot: r.depot ?? "",
        gammes: Object.fromEntries((r.categories ?? []).map((c: any) => [c.category_id, String(c.pct)])),
        settingId: s?.id, rules: r,
      };
      if (s) {
        if (Array.isArray(r.direct_labs) && r.direct_labs.length) sharedRules.direct_labs = r.direct_labs;
        if (r.other_wholesaler) sharedRules.other_wholesaler = r.other_wholesaler;
        if (r.year_end_rebate) sharedRules.year_end_rebate = true;
        if (r.free_goods) sharedRules.free_goods = true;
      }
    }
    setRows(next);
    setLabs(Array.isArray(sharedRules?.direct_labs) ? sharedRules.direct_labs.join(", ") : "");
    setOtherWholesaler(sharedRules?.other_wholesaler ?? "");
    setYearEnd(!!sharedRules?.year_end_rebate);
    setFreeGoods(!!sharedRules?.free_goods);
    initializedCustomer.current = customer.id;
  }, [customer.id, ws, existing]);

  const set = (id: string, patch: Partial<Row>) => setRows((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const checked = ws.filter((w) => rows[w.id]?.checked);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const directLabs = labs.split(",").map((s) => s.trim()).filter(Boolean);
      for (const w of ws) {
        const r = rows[w.id];
        if (!r) continue;
        if (!r.checked) {
          if (r.settingId) {
            const { error } = await sb.from("pharmacist_wholesaler_settings").update({ is_supplier_of_pharmacist: false }).eq("id", r.settingId);
            if (error) throw error;
          }
          continue;
        }
        const existingGeneral = num(String(r.rules?.general_pct ?? ""));
        const general = num(r.pct) ?? existingGeneral;
        const existingCategories = new Map<string, number>(
          (Array.isArray(r.rules?.categories) ? r.rules.categories : [])
            .filter((category: any) => category?.category_id && num(String(category.pct)) != null)
            .map((category: any) => [category.category_id, num(String(category.pct)) as number]),
        );
        for (const gamme of SCAN_GAMMES) {
          const entered = num(r.gammes[gamme.id] ?? "");
          if (entered != null) existingCategories.set(gamme.id, entered);
        }
        const rules = {
          ...(r.rules ?? {}),
          version: 2,
          general_pct: general,
          categories: Array.from(existingCategories, ([category_id, pct]) => ({ category_id, pct })),
          brands: r.rules?.brands ?? [],
          depot: r.depot.trim() || r.rules?.depot || null,
          direct_labs: directLabs.length ? directLabs : (r.rules?.direct_labs ?? []),
          year_end_rebate: yearEnd,
          free_goods: freeGoods,
          other_wholesaler: otherWholesaler.trim() || r.rules?.other_wholesaler || null,
        };
        const payload = {
          customer_id: customer.id, user_id: user.id, wholesaler_profile_id: w.id,
          is_supplier_of_pharmacist: true, override_default_discount_pct: general, override_rules_json: rules,
          last_reviewed_at: new Date().toISOString(),
        };
        const { error } = r.settingId
          ? await sb.from("pharmacist_wholesaler_settings").update(payload).eq("id", r.settingId)
          : await sb.from("pharmacist_wholesaler_settings").insert(payload);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["scan-conditions", customer.id] });
      toast.success("Conditions enregistrées");
      nav("/");
    } catch (e: any) {
      toast.error("Enregistrement impossible");
      console.error(e);
    } finally { setSaving(false); }
  };

  const titles = ["Vos grossistes", "Exceptions par gamme", "Labos en direct", "Avantages en fin d'année"];

  if (wholesalersError || conditionsError) {
    return (
      <div className="px-5 pt-5 space-y-5">
        <h1 className="text-2xl font-extrabold">Mes conditions</h1>
        <p className="text-muted-foreground">Impossible de charger vos conditions. Réessayez.</p>
        <Button variant="outline" className="scan-tap w-full" onClick={() => nav("/")}>Retour au scanner</Button>
      </div>
    );
  }

  if (wholesalersLoading || conditionsLoading || !Object.keys(rows).length) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="px-5 pt-5 space-y-5">
      <div className="flex items-center gap-2">
        {step > 0 && <Button variant="ghost" size="icon" className="scan-tap" aria-label="Retour" onClick={() => setStep(step - 1)}><ChevronLeft /></Button>}
        <div className="flex-1">
          <div className="text-xs font-semibold text-scan-emerald">Étape {step + 1} / 4</div>
          <h1 className="text-2xl font-extrabold">{titles[step]}</h1>
        </div>
        <Button variant="ghost" className="scan-tap text-muted-foreground" onClick={() => nav("/")}>Passer</Button>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-card border p-3 text-sm">
        <ShieldCheck className="h-5 w-5 shrink-0 text-scan-emerald" />
        <span>Jamais partagées avec un grossiste, un labo ou une autre pharmacie.</span>
      </div>

      {step === 0 && (
        <div className="space-y-3">
          {ws.map((w) => {
            const r = rows[w.id];
            if (!r) return null;
            return (
              <div key={w.id} className="rounded-xl border bg-card p-3 space-y-3">
                <label className="scan-tap flex items-center gap-3 font-semibold">
                  <Checkbox checked={r.checked} onCheckedChange={(v) => set(w.id, { checked: !!v })} />
                  {w.display_name}
                </label>
                {r.checked && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Remise générale %</div>
                      <Input inputMode="decimal" value={r.pct} onChange={(e) => set(w.id, { pct: e.target.value })} className="h-11" placeholder="ex. 12" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Dépôt</div>
                      <Input value={r.depot} onChange={(e) => set(w.id, { depot: e.target.value })} className="h-11" placeholder="ex. Mons" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <Input value={otherWholesaler} onChange={(e) => setOtherWholesaler(e.target.value)} className="h-11" placeholder="Autre grossiste (facultatif)" />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          {checked.length === 0 && <p className="text-muted-foreground">Cochez d'abord un grossiste.</p>}
          {checked.map((w) => (
            <div key={w.id} className="rounded-xl border bg-card p-3 space-y-2">
              <div className="font-semibold">{w.display_name}</div>
              {SCAN_GAMMES.map((g) => (
                <div key={g.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{g.label}</span>
                  <Input inputMode="decimal" className="h-11 w-24" placeholder="%" value={rows[w.id].gammes[g.id] ?? ""}
                    onChange={(e) => set(w.id, { gammes: { ...rows[w.id].gammes, [g.id]: e.target.value } })} />
                </div>
              ))}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Laissez vide si la remise générale s'applique.</p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Achetez-vous certaines marques directement au labo ?</p>
          <Input value={labs} onChange={(e) => setLabs(e.target.value)} className="h-11" placeholder="ex. Nutricia, Fresenius" />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <label className="scan-tap flex items-center gap-3 rounded-xl border bg-card p-3">
            <Checkbox checked={yearEnd} onCheckedChange={(v) => setYearEnd(!!v)} /> Ristourne de fin d'année
          </label>
          <label className="scan-tap flex items-center gap-3 rounded-xl border bg-card p-3">
            <Checkbox checked={freeGoods} onCheckedChange={(v) => setFreeGoods(!!v)} /> Gratuités (produits offerts)
          </label>
          {(yearEnd || freeGoods) && <p className="text-sm text-muted-foreground">Vos gains seront affichés comme « gain estimé ».</p>}
        </div>
      )}

      <Button className="scan-tap h-12 w-full text-base" disabled={saving}
        onClick={() => (step < 3 ? setStep(step + 1) : save())}>
        {step < 3 ? "Continuer" : saving ? "Enregistrement…" : "Enregistrer mes conditions"}
      </Button>
    </div>
  );
}
