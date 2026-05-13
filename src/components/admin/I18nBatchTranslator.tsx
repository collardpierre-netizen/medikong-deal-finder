import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Search, X, Languages, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Locale = "en" | "nl" | "de";
const ALL_LOCALES: Locale[] = ["en", "nl", "de"];

interface ProductHit {
  id: string;
  name: string;
  name_en: string | null;
  name_nl: string | null;
  name_de: string | null;
}

interface BatchResult {
  translated?: number;
  translations_saved?: number;
  remaining?: number;
  error?: string;
}

export function I18nBatchTranslator() {
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [selected, setSelected] = useState<Map<string, ProductHit>>(new Map());
  const [locales, setLocales] = useState<Set<Locale>>(new Set(ALL_LOCALES));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, name_en, name_nl, name_de")
        .eq("is_active", true)
        .ilike("name", `%${search.trim()}%`)
        .order("popularity", { ascending: false, nullsFirst: false })
        .limit(20);
      if (error) throw error;
      setHits((data || []) as ProductHit[]);
    } catch (err: any) {
      toast.error(err?.message || "Erreur de recherche");
    } finally {
      setSearching(false);
    }
  };

  const toggle = (p: ProductHit) => {
    const next = new Map(selected);
    if (next.has(p.id)) next.delete(p.id);
    else next.set(p.id, p);
    setSelected(next);
  };

  const toggleLocale = (l: Locale) => {
    const next = new Set(locales);
    if (next.has(l)) next.delete(l);
    else next.add(l);
    setLocales(next);
  };

  const handleRun = async () => {
    if (selected.size === 0 || locales.size === 0) return;
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("batch-translate-products", {
        body: {
          entity_type: "product",
          product_ids: Array.from(selected.keys()),
          target_locales: Array.from(locales),
          batch_size: selected.size,
        },
      });
      if (error) throw error;
      const r = data as BatchResult;
      setResult(r);
      if (r.error) toast.error(r.error);
      else toast.success(`${r.translated ?? 0} produit(s) traduit(s) · ${r.translations_saved ?? 0} entrées sauvegardées`);
    } catch (err: any) {
      toast.error(err?.message || "Erreur réseau");
      setResult({ error: err?.message || "Erreur réseau" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Languages className="h-4 w-4 text-primary" />
          Traduction par sélection (FR → EN/NL/DE)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert>
          <AlertDescription className="text-xs">
            Recherche un produit, coche-le, choisis les langues cibles puis lance le batch.
            Écrit dans <code>products.name_*</code> et la table <code>translations</code> (réécrit même si déjà traduit).
            Limite : 100 produits / batch.
          </AlertDescription>
        </Alert>

        {/* Search */}
        <div>
          <Label htmlFor="batch-search">Rechercher des produits</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              id="batch-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Nom du produit (FR)…"
            />
            <Button onClick={handleSearch} disabled={searching} variant="outline">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Results */}
        {hits.length > 0 && (
          <div className="border rounded-md divide-y max-h-72 overflow-auto">
            {hits.map((p) => {
              const isSel = selected.has(p.id);
              return (
                <label
                  key={p.id}
                  className="flex items-start gap-3 p-2.5 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox checked={isSel} onCheckedChange={() => toggle(p)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="flex gap-1 mt-1">
                      {(["en", "nl", "de"] as Locale[]).map((l) => {
                        const has = !!p[`name_${l}` as const];
                        return (
                          <Badge
                            key={l}
                            variant={has ? "secondary" : "outline"}
                            className={`text-[10px] ${has ? "" : "text-muted-foreground"}`}
                          >
                            {l.toUpperCase()} {has ? "✓" : "—"}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* Selected chips */}
        {selected.size > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Sélection ({selected.size})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selected.values()).map((p) => (
                <Badge key={p.id} variant="secondary" className="gap-1 max-w-xs">
                  <span className="truncate">{p.name}</span>
                  <button onClick={() => toggle(p)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Locales */}
        <div>
          <Label className="block mb-2">Langues cibles</Label>
          <div className="flex gap-3">
            {ALL_LOCALES.map((l) => (
              <label key={l} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={locales.has(l)} onCheckedChange={() => toggleLocale(l)} />
                <span className="text-sm uppercase font-medium">{l}</span>
              </label>
            ))}
          </div>
        </div>

        <Button
          onClick={handleRun}
          disabled={running || selected.size === 0 || locales.size === 0}
          className="w-full"
        >
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Traduction de {selected.size} produit(s)…
            </>
          ) : (
            <>Lancer la traduction de {selected.size} produit(s) → {Array.from(locales).map((l) => l.toUpperCase()).join("/") || "—"}</>
          )}
        </Button>

        {result && !result.error && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-sm">
              ✅ <strong>{result.translated ?? 0}</strong> produit(s) traité(s) ·{" "}
              <strong>{result.translations_saved ?? 0}</strong> entrées de traduction sauvegardées.
            </AlertDescription>
          </Alert>
        )}
        {result?.error && (
          <Alert variant="destructive">
            <AlertDescription className="text-sm">{result.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
