import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Loader2, Play, Eye, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RunResult {
  ok: boolean;
  dryRun: boolean;
  scanned: number;
  regex_hits: number;
  gtin_hits: number;
  no_match: number;
  updated: number;
  sample: { id: string; name: string; pack_size: number; source: string }[];
  error?: string;
}

export default function AdminPackSizeBackfill() {
  const [batchSize, setBatchSize] = useState(1000);
  const [maxBatches, setMaxBatches] = useState(5);
  const [result, setResult] = useState<RunResult | null>(null);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["pack-size-backfill-stats"],
    queryFn: async () => {
      const { count: nullCount } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .or("pack_size.is.null,pack_size.eq.1");
      const { count: filledCount } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .gt("pack_size", 1);
      return { missing: nullCount ?? 0, filled: filledCount ?? 0 };
    },
  });

  const run = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await supabase.functions.invoke("backfill-product-pack-sizes", {
        body: { dryRun, batchSize, maxBatches },
      });
      if (error) throw error;
      return data as RunResult;
    },
    onSuccess: (data) => {
      setResult(data);
      if (!data.dryRun) {
        toast.success(`Backfill : ${data.updated} produits mis à jour`);
        refetchStats();
      } else {
        toast.info(`Aperçu : ${data.regex_hits + data.gtin_hits} matchs sur ${data.scanned}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Helmet>
        <title>Backfill pack_size — MediKong Admin</title>
      </Helmet>

      <div className="flex items-center gap-3">
        <Package className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Backfill conditionnement (pack_size)</h1>
          <p className="text-sm text-muted-foreground">
            Extraction auto depuis le libellé produit + fallback GTIN sur la base interne.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produits sans pack_size (NULL ou =1)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.missing.toLocaleString("fr-FR") ?? "…"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produits avec pack_size &gt; 1
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.filled.toLocaleString("fr-FR") ?? "…"}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lancer un run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <Label htmlFor="bs">Taille batch</Label>
              <Input
                id="bs"
                type="number"
                min={100}
                max={5000}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="mb">Nombre max de batches</Label>
              <Input
                id="mb"
                type="number"
                min={1}
                max={1000}
                value={maxBatches}
                onChange={(e) => setMaxBatches(Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Couvre jusqu'à {(batchSize * maxBatches).toLocaleString("fr-FR")} produits par exécution.
            Pour traiter les ~411k produits restants, prévoyez plusieurs runs (ex: 2000 × 200).
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => run.mutate(true)}
              disabled={run.isPending}
            >
              {run.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              Aperçu (dry-run)
            </Button>
            <Button onClick={() => run.mutate(false)} disabled={run.isPending}>
              {run.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Lancer le backfill
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>
              Résultat {result.dryRun && <Badge variant="outline" className="ml-2">Dry-run</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <Stat label="Scannés" value={result.scanned} />
              <Stat label="Match regex" value={result.regex_hits} tone="text-emerald-700" />
              <Stat label="Match GTIN" value={result.gtin_hits} tone="text-sky-700" />
              <Stat label="Sans match" value={result.no_match} tone="text-muted-foreground" />
              <Stat label="Écrits" value={result.updated} tone="text-primary" />
            </div>
            {result.sample.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Échantillon ({result.sample.length})</div>
                <div className="border rounded-lg divide-y text-sm">
                  {result.sample.map((s) => (
                    <div key={s.id} className="px-3 py-2 flex items-center justify-between gap-3">
                      <div className="truncate flex-1">{s.name}</div>
                      <Badge variant="outline">pack {s.pack_size}</Badge>
                      <Badge
                        variant="outline"
                        className={
                          s.source === "name_regex"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-sky-50 text-sky-700"
                        }
                      >
                        {s.source}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${tone ?? ""}`}>{value.toLocaleString("fr-FR")}</div>
    </div>
  );
}
