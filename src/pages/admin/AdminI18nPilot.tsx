import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Languages, CheckCircle2, AlertTriangle, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CacheStats {
  total: number;
  today: number;
  byLang: Record<string, number>;
  topHits: Array<{ source_text: string; target_lang: string; hits: number }>;
}

interface RunResult {
  ok?: boolean;
  dryRun?: boolean;
  candidates?: number;
  translated?: number;
  skipped?: number;
  failed?: number;
  samples?: Array<{ id: string; name: string; name_en: string }>;
  error?: string;
}

export default function AdminI18nPilot() {
  const [limit, setLimit] = useState(50);
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);

  useEffect(() => {
    void loadCacheStats();
  }, []);

  const loadCacheStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [{ count: total }, { count: todayCount }, { data: rows }, { data: top }] =
        await Promise.all([
          supabase.from("translation_cache").select("*", { count: "exact", head: true }),
          supabase
            .from("translation_cache")
            .select("*", { count: "exact", head: true })
            .gte("created_at", today.toISOString()),
          supabase.from("translation_cache").select("target_lang"),
          supabase
            .from("translation_cache")
            .select("source_text, target_lang, hits")
            .order("hits", { ascending: false })
            .limit(10),
        ]);

      const byLang: Record<string, number> = {};
      (rows || []).forEach((r: { target_lang: string }) => {
        byLang[r.target_lang] = (byLang[r.target_lang] || 0) + 1;
      });

      setCacheStats({
        total: total || 0,
        today: todayCount || 0,
        byLang,
        topHits: (top || []) as CacheStats["topHits"],
      });
    } catch (err) {
      console.error("loadCacheStats error", err);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "translate-products-en-pilot",
        { body: { limit, dryRun } }
      );
      if (error) throw error;
      setResult(data as RunResult);
      if ((data as RunResult).ok) {
        toast.success(
          dryRun
            ? `Test terminé : ${(data as RunResult).translated} traduits (rien sauvegardé)`
            : `${(data as RunResult).translated} produits mis à jour en EN`
        );
      } else {
        toast.error((data as RunResult).error || "Erreur inconnue");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur réseau");
      setResult({ error: err?.message || "Erreur réseau" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Layout>
      <div className="mk-container py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Languages className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">i18n Pilot — Traduction EN catalogue</h1>
            <p className="text-sm text-muted-foreground">
              Test ciblé sur les produits les plus populaires sans traduction EN.
            </p>
          </div>
        </div>

        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Mode <strong>Test (dry-run)</strong> recommandé en premier passage : la function appelle
            Gemini, retourne 5 échantillons, et n'écrit RIEN en base. Désactive le test pour appliquer.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Paramètres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label htmlFor="limit">Nombre max de produits (1–500)</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                max={500}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Trie par <code>popularity DESC</code>, prend uniquement ceux dont <code>name_en IS NULL</code>.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
              <div>
                <Label htmlFor="dryRun" className="cursor-pointer">
                  Mode test (dry-run)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Simule la traduction sans écrire en base.
                </p>
              </div>
              <Switch id="dryRun" checked={dryRun} onCheckedChange={setDryRun} />
            </div>

            <Button onClick={handleRun} disabled={running} className="w-full">
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Traduction en cours…
                </>
              ) : (
                <>Lancer {dryRun ? "le test" : "la traduction"}</>
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
                Résultat
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.error ? (
                <p className="text-sm text-destructive">{result.error}</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <Stat label="Candidats" value={result.candidates ?? 0} />
                    <Stat label="Traduits" value={result.translated ?? 0} highlight />
                    <Stat label="Ignorés" value={result.skipped ?? 0} />
                    <Stat label="Échecs" value={result.failed ?? 0} />
                  </div>

                  {result.samples && result.samples.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                        Échantillons ({result.samples.length})
                      </p>
                      <ul className="space-y-2">
                        {result.samples.map((s) => (
                          <li
                            key={s.id}
                            className="text-sm border rounded-md p-3 bg-muted/30"
                          >
                            <div className="text-muted-foreground text-xs">FR :</div>
                            <div className="mb-1.5">{s.name}</div>
                            <div className="text-muted-foreground text-xs">EN :</div>
                            <div className="font-medium">{s.name_en}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.dryRun && (
                    <p className="text-xs text-muted-foreground mt-4">
                      ℹ️ Aucune écriture en base (mode test).
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="text-center p-3 rounded-md border bg-card">
      <div
        className={`text-2xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
