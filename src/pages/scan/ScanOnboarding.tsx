/** Premier lancement : 3 écrans (grossistes, labos en direct, premier scan). Tout reste modifiable dans « Mes conditions ». */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

const sb = supabase as any;
type W = { id: string; slug: string; display_name: string };
type Lab = { id: string; name: string; pct: number };

export const onboardingKey = (customerId: string) => `scan-onboarding-done-${customerId}`;

export default function ScanOnboarding({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<Record<string, number | null>>({});
  const [labs, setLabs] = useState<Lab[]>([]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: ws = [], isLoading } = useQuery<W[]>({
    queryKey: ["scan-wholesalers"],
    queryFn: async () => { const { data, error } = await sb.rpc("scan_list_wholesalers"); if (error) throw error; return data ?? []; },
  });
  const { data: found = [] } = useQuery({
    queryKey: ["scan-onb-labs", q.trim()],
    enabled: q.trim().length >= 2,
    queryFn: async () => (await sb.from("manufacturers").select("id, name").ilike("name", `%${q.trim()}%`).order("name").limit(6)).data ?? [],
  });
  const chosen = ws.filter((w) => sel[w.id] != null);

  const finish = () => { localStorage.setItem(onboardingKey(customerId), "1"); onDone(); };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const manufacturers = labs.map((l) => ({ manufacturer_id: l.id, name: l.name, pct: l.pct, min_order_cents: null, franco_cents: null }));
      for (const w of chosen) {
        const pct = sel[w.id] as number;
        const payload = {
          customer_id: customerId, user_id: user.id, wholesaler_profile_id: w.id, is_supplier_of_pharmacist: true,
          override_default_discount_pct: pct, last_reviewed_at: new Date().toISOString(),
          override_rules_json: { version: 2, general_pct: pct, categories: [], brands: [], manufacturers, direct_labs: labs.map((l) => l.name) },
        };
        let { error } = await sb.from("pharmacist_wholesaler_settings").insert(payload);
        if (error?.code === "23505") ({ error } = await sb.from("pharmacist_wholesaler_settings").update(payload).eq("customer_id", customerId).eq("wholesaler_profile_id", w.id));
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["scan-conditions", customerId] });
      await qc.invalidateQueries({ queryKey: ["scan-has-conditions", customerId] });
      setStep(2);
    } catch (e: any) {
      toast.error(`Enregistrement impossible : ${e?.message ?? e}`);
    } finally { setSaving(false); }
  };

  const titles = ["Vos grossistes", "Vos labos en direct", "Scannez un produit de votre rayon"];
  return (
    <div className="mx-auto min-h-[100dvh] max-w-md space-y-5 px-5 pb-10 pt-6">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={3}>
          <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / 3) * 100}%` }} />
        </div>
        <span className="text-xs text-muted-foreground">{step + 1}/3</span>
      </div>
      <h1 className="text-2xl font-extrabold">{titles[step]}</h1>

      {step === 0 && (
        <div className="space-y-4">
          <p className="text-muted-foreground">Cochez vos grossistes et votre remise générale chez chacun.</p>
          {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
          {ws.map((w) => {
            const on = sel[w.id] != null;
            return (
              <div key={w.id} className="space-y-3 rounded-xl border bg-card p-4">
                <label className="flex items-center gap-3 font-medium">
                  <Checkbox checked={on} onCheckedChange={(v) => setSel((p) => ({ ...p, [w.id]: v ? 10 : null }))} />
                  {w.display_name}
                </label>
                {on && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span>Remise générale</span><strong>{sel[w.id]} %</strong></div>
                    <Slider min={0} max={40} step={0.5} value={[sel[w.id] as number]} onValueChange={([v]) => setSel((p) => ({ ...p, [w.id]: v }))} aria-label={`Remise ${w.display_name}`} />
                  </div>
                )}
              </div>
            );
          })}
          <Button className="scan-tap h-12 w-full text-base" disabled={!chosen.length} onClick={() => setStep(1)}>Continuer</Button>
          <Button variant="link" className="w-full" onClick={finish}>Plus tard</Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-muted-foreground">Facultatif : les fabricants chez qui vous achetez en direct, et votre remise.</p>
          <Input placeholder="Rechercher un fabricant…" value={q} onChange={(e) => setQ(e.target.value)} className="h-12 text-base" />
          {found.length > 0 && (
            <div className="divide-y rounded-xl border bg-card">
              {found.filter((m: any) => !labs.some((l) => l.id === m.id)).map((m: any) => (
                <button key={m.id} type="button" className="scan-tap block w-full px-4 py-3 text-left" onClick={() => { setLabs((p) => [...p, { id: m.id, name: m.name, pct: 10 }]); setQ(""); }}>{m.name}</button>
              ))}
            </div>
          )}
          {labs.map((l, i) => (
            <div key={l.id} className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between font-medium">{l.name}
                <Button variant="ghost" size="icon" aria-label={`Retirer ${l.name}`} onClick={() => setLabs((p) => p.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
              </div>
              <div className="flex justify-between text-sm"><span>Remise</span><strong>{l.pct} %</strong></div>
              <Slider min={0} max={60} step={0.5} value={[l.pct]} onValueChange={([v]) => setLabs((p) => p.map((x, j) => (j === i ? { ...x, pct: v } : x)))} aria-label={`Remise ${l.name}`} />
            </div>
          ))}
          <Button className="scan-tap h-12 w-full text-base" disabled={saving} onClick={save}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : labs.length ? "Enregistrer" : "Passer"}</Button>
          <Button variant="link" className="w-full" onClick={() => setStep(0)}>Retour</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-lg">Votre premier verdict en 2 secondes.</p>
          <p className="text-sm text-muted-foreground">Vos conditions restent modifiables dans « Mes conditions ».</p>
          <Button className="scan-tap h-12 w-full text-base" onClick={finish}>Ouvrir le scanner</Button>
        </div>
      )}
    </div>
  );
}
