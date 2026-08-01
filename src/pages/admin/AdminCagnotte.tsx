import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Coins, Loader2, RefreshCw, Save, AlertTriangle } from "lucide-react";

interface Kpis {
  from: string;
  to: string;
  distributed: number;
  used: number;
  expired: number;
  provision: number;
  commissions: number;
  ratio_pct: number | null;
}

const SETTING_LABELS: Record<string, string> = {
  cagnotte_rate: "Taux de cagnotte (ex. 0.02 = 2%)",
  cagnotte_min_commission_eligibility: "Seuil minimum d'éligibilité (commission ≥)",
  cagnotte_max_spend_pct: "Plafond d'utilisation en % du sous-total HT",
  cagnotte_min_spend: "Minimum d'utilisation (€)",
  cagnotte_vat_mode: 'Mode TVA ("discount" ou "payment")',
};

function eur(v: number | null | undefined) {
  return `${Number(v ?? 0).toFixed(2).replace(".", ",")} €`;
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AdminCagnotte() {
  const { toast } = useToast();
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function loadKpis() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_cagnotte_kpis" as any, {
      p_from: from,
      p_to: to,
    });
    if (error) {
      toast({ title: "Erreur KPIs", description: error.message, variant: "destructive" });
      setKpis(null);
    } else {
      setKpis(data as unknown as Kpis);
    }
    setLoading(false);
  }

  async function loadSettings() {
    const { data, error } = await (supabase as any)
      .from("settings")
      .select("key, value")
      .like("key", "cagnotte%")
      .order("key");
    if (error) {
      toast({ title: "Erreur paramètres", description: error.message, variant: "destructive" });
      return;
    }
    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.key] = JSON.stringify(row.value);
    setSettings(map);
  }

  async function saveSetting(key: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(settings[key]);
    } catch {
      toast({
        title: "Valeur invalide",
        description: 'Utilisez du JSON : 0.02 pour un nombre, "payment" pour un texte.',
        variant: "destructive",
      });
      return;
    }
    setSaving(key);
    const { error } = await (supabase as any)
      .from("settings")
      .update({ value: parsed, updated_at: new Date().toISOString() })
      .eq("key", key);
    setSaving(null);
    if (error) {
      toast({ title: "Enregistrement refusé", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Paramètre enregistré", description: SETTING_LABELS[key] ?? key });
    }
  }

  useEffect(() => {
    loadKpis();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ratioAlert = kpis?.ratio_pct != null && kpis.ratio_pct > 15;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Helmet>
        <title>Cagnotte MediKong — Admin</title>
        <meta name="description" content="Pilotage financier du programme de cagnotte fidélité MediKong." />
      </Helmet>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Coins className="h-7 w-7" /> Cagnotte MediKong
          </h1>
          <p className="text-sm text-muted-foreground">
            Cagnotte distribuée, utilisée, expirée et provision au bilan.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Du</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Au</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
          </div>
          <Button onClick={loadKpis} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Actualiser</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Cagnotte distribuée", value: eur(kpis?.distributed) },
          { label: "Cagnotte utilisée", value: eur(kpis?.used) },
          { label: "Cagnotte expirée (récupérée)", value: eur(kpis?.expired) },
          { label: "Commissions perçues", value: eur(kpis?.commissions) },
          { label: "Provision au bilan", value: eur(kpis?.provision) },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ratio distribution / commissions perçues</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <p className="text-3xl font-bold">
            {kpis?.ratio_pct != null ? `${kpis.ratio_pct.toFixed(2)} %` : "—"}
          </p>
          {ratioAlert ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Au-delà de 15 % — marge sous pression
            </Badge>
          ) : (
            kpis?.ratio_pct != null && <Badge variant="secondary">Sous le seuil de 15 %</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration du programme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.keys(settings).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun paramètre chargé.</p>
          )}
          {Object.entries(settings).map(([key, value]) => (
            <div key={key} className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[260px]">
                <label className="text-xs text-muted-foreground block mb-1">
                  {SETTING_LABELS[key] ?? key} <span className="opacity-60">({key})</span>
                </label>
                <Input
                  value={value}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                />
              </div>
              <Button variant="outline" onClick={() => saveSetting(key)} disabled={saving === key}>
                {saving === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-2">Enregistrer</span>
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Le mode TVA reste à valider avec le comptable : <strong>payment</strong> = TVA sur le
            sous-total HT plein, <strong>discount</strong> = TVA sur le sous-total HT diminué de la
            cagnotte utilisée.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
