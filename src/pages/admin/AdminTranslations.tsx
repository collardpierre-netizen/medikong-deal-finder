import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Languages, Sparkles, BarChart3, Package, Layers, Settings,
  ChevronLeft, ChevronRight, Play, Square, Loader2,
} from "lucide-react";

// ─── TYPES ──────────────────────────────────────────────────────────────────────
interface TranslationStats {
  totalProducts: number;
  translatedProducts: number;
  totalCategories: number;
  translatedCategories: number;
  uiKeysFr: number;
  uiKeysNl: number;
  uiKeysDe: number;
  uiKeysEn: number;
}

interface ProductRow {
  id: string;
  name: string;
  name_fr: string | null;
  gtin: string | null;
  brand_name?: string;
}

interface TranslationRow {
  entity_id: string;
  locale: string;
  field: string;
  value: string;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────────
function pct(n: number, t: number) { return t === 0 ? 0 : Math.round((n / t) * 100); }

function CircularProgress({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 36, circ = 2 * Math.PI * r, offset = circ - (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={88} height={88} className="-rotate-90">
        <circle cx={44} cy={44} r={r} fill="none" stroke="#E2E8F0" strokeWidth={7} />
        <circle cx={44} cy={44} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <span className="text-xl font-bold -mt-14 mb-6" style={{ color }}>{value}%</span>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────────
export default function AdminTranslations() {
  const [pSearch, setPSearch] = useState("");
  const [pPage, setPPage] = useState(1);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ translated: 0, remaining: 0 });
  const [batchType, setBatchType] = useState<"product" | "category">("product");
  const abortRef = useRef(false);

  const PAGE = 20;

  // ─── STATS QUERY ────────────────────────────────────────────────────────────
  const { data: stats, refetch: refetchStats } = useQuery<TranslationStats>({
    queryKey: ["translation-stats"],
    queryFn: async () => {
      const [
        { count: totalProducts },
        { count: totalCategories },
      ] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);

      // Count translated products & categories (per locale)
      const { count: translatedProducts } = await supabase
        .from("translations")
        .select("entity_id", { count: "exact", head: true })
        .eq("entity_type", "product")
        .eq("locale", "nl")
        .eq("field", "name");

      const { count: translatedCategories } = await supabase
        .from("translations")
        .select("entity_id", { count: "exact", head: true })
        .eq("entity_type", "category")
        .eq("locale", "nl")
        .eq("field", "name");

      return {
        totalProducts: totalProducts || 0,
        translatedProducts: translatedProducts || 0,
        totalCategories: totalCategories || 0,
        translatedCategories: translatedCategories || 0,
        uiKeysFr: 472,
        uiKeysNl: 431,
        uiKeysDe: 431,
        uiKeysEn: 469,
      };
    },
  });

  const s = stats || {
    totalProducts: 0, translatedProducts: 0,
    totalCategories: 0, translatedCategories: 0,
    uiKeysFr: 472, uiKeysNl: 431, uiKeysDe: 431, uiKeysEn: 469,
  };

  // ─── PRODUCTS LIST ──────────────────────────────────────────────────────────
  const { data: productsData } = useQuery({
    queryKey: ["translation-products", pSearch, pPage],
    queryFn: async () => {
      const from = (pPage - 1) * PAGE;
      let query = supabase
        .from("products")
        .select("id, name, name_fr, gtin", { count: "exact" })
        .eq("is_active", true)
        .order("name", { ascending: true })
        .range(from, from + PAGE - 1);

      if (pSearch) {
        query = query.or(`name.ilike.%${pSearch}%,gtin.ilike.%${pSearch}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      // Get translations for these products
      const ids = (data || []).map((p: ProductRow) => p.id);
      const { data: translations } = await supabase
        .from("translations")
        .select("entity_id, locale, field, value")
        .eq("entity_type", "product")
        .eq("field", "name")
        .in("entity_id", ids);

      return {
        products: data as ProductRow[],
        translations: (translations || []) as TranslationRow[],
        total: count || 0,
      };
    },
  });

  const products = productsData?.products || [];
  const productTranslations = productsData?.translations || [];
  const totalProducts = productsData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE));

  // Get translation for a product
  const getTranslation = (productId: string, locale: string) => {
    const t = productTranslations.find(
      (tr) => tr.entity_id === productId && tr.locale === locale
    );
    return t?.value || "";
  };

  // ─── BATCH TRANSLATE ──────────────────────────────────────────────────────
  const runBatchTranslate = useCallback(async () => {
    setBatchRunning(true);
    abortRef.current = false;
    let offset = 0;
    let totalTranslated = 0;

    try {
      while (!abortRef.current) {
        const { data, error } = await supabase.functions.invoke("batch-translate-products", {
          body: {
            entity_type: batchType,
            batch_size: 20,
            target_locales: ["nl", "de", "en"],
            offset,
          },
        });

        if (error) {
          toast.error("Erreur de traduction batch", { description: error.message });
          break;
        }

        if (data?.error) {
          toast.error("Erreur", { description: data.error });
          break;
        }

        totalTranslated += data?.translated || 0;
        const remaining = data?.remaining || 0;

        setBatchProgress({ translated: totalTranslated, remaining });

        if (data?.translated === 0 || remaining <= 0) {
          toast.success(`Traduction terminée !`, {
            description: `${totalTranslated} ${batchType === "product" ? "produits" : "catégories"} traduits`,
          });
          break;
        }

        offset = data?.next_offset || offset + 20;

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setBatchRunning(false);
      refetchStats();
    }
  }, [batchType, refetchStats]);

  const stopBatch = useCallback(() => {
    abortRef.current = true;
    toast.info("Arrêt de la traduction en cours...");
  }, []);

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Languages size={24} className="text-[#2563EB]" /> Traduction & Localisation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les traductions de votre catalogue et interface — {s.totalProducts.toLocaleString("fr-FR")} produits, {s.totalCategories} catégories
          </p>
        </div>
        <div className="flex gap-2">
          {batchRunning ? (
            <Button onClick={stopBatch} variant="destructive" className="gap-2">
              <Square size={16} /> Arrêter
            </Button>
          ) : (
            <div className="flex gap-2">
              <Select value={batchType} onValueChange={(v) => setBatchType(v as "product" | "category")}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Produits</SelectItem>
                  <SelectItem value="category">Catégories</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={runBatchTranslate} className="bg-[#2563EB] hover:bg-[#1d4ed8] gap-2">
                <Sparkles size={16} /> Lancer traduction batch
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Batch progress bar */}
      {batchRunning && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="animate-spin text-blue-600" size={16} />
            <span className="text-sm font-medium text-blue-800">
              Traduction en cours... {batchProgress.translated} traduits, {batchProgress.remaining.toLocaleString("fr-FR")} restants
            </span>
          </div>
          <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{
                width: `${pct(batchProgress.translated, batchProgress.translated + batchProgress.remaining)}%`,
              }}
            />
          </div>
        </div>
      )}

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 size={14} /> Dashboard</TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5"><Package size={14} /> Produits</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><Layers size={14} /> Catégories</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings size={14} /> Paramètres</TabsTrigger>
        </TabsList>

        {/* ═══ DASHBOARD TAB ═══ */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CircularProgress value={pct(s.translatedProducts, s.totalProducts)} label={`Produits traduits\n${s.translatedProducts.toLocaleString("fr-FR")}/${s.totalProducts.toLocaleString("fr-FR")}`} color="#2563EB" />
            <CircularProgress value={pct(s.translatedCategories, s.totalCategories)} label={`Catégories traduites\n${s.translatedCategories}/${s.totalCategories}`} color="#16A34A" />
            <CircularProgress value={pct(s.uiKeysNl, s.uiKeysFr)} label={`NL: ${s.uiKeysNl}/${s.uiKeysFr} clés`} color="#F59E0B" />
            <CircularProgress value={pct(s.uiKeysDe, s.uiKeysFr)} label={`DE: ${s.uiKeysDe}/${s.uiKeysFr} clés`} color="#7C3AED" />
          </div>

          <div className="bg-white border rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-4">Progression par section</h3>
            <div className="space-y-3">
              {[
                { label: "Produits (NL)", done: s.translatedProducts, total: s.totalProducts, color: "#2563EB" },
                { label: "Catégories (NL)", done: s.translatedCategories, total: s.totalCategories, color: "#16A34A" },
                { label: "UI NL", done: s.uiKeysNl, total: s.uiKeysFr, color: "#F59E0B" },
                { label: "UI DE", done: s.uiKeysDe, total: s.uiKeysFr, color: "#7C3AED" },
              ].map((bar) => (
                <div key={bar.label} className="flex items-center gap-3">
                  <span className="text-xs w-28 text-right text-muted-foreground">{bar.label}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct(bar.done, bar.total)}%`, backgroundColor: bar.color }}
                    />
                  </div>
                  <span className="text-xs font-medium w-24">
                    {bar.done.toLocaleString("fr-FR")}/{bar.total.toLocaleString("fr-FR")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-3">Estimation du traitement complet</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">
                  {Math.ceil((s.totalProducts - s.translatedProducts) / 20).toLocaleString("fr-FR")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Lots de 20 restants (produits)</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">
                  ~{Math.ceil(((s.totalProducts - s.translatedProducts) / 20) * 2 / 60)}h
                </div>
                <div className="text-xs text-muted-foreground mt-1">Temps estimé</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-700">3</div>
                <div className="text-xs text-muted-foreground mt-1">Langues cibles (NL, DE, EN)</div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═══ PRODUCTS TAB ═══ */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou GTIN..."
                value={pSearch}
                onChange={(e) => { setPSearch(e.target.value); setPPage(1); }}
                className="pl-9"
              />
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">GTIN</TableHead>
                  <TableHead>Nom (EN/original)</TableHead>
                  <TableHead>FR</TableHead>
                  <TableHead>NL</TableHead>
                  <TableHead>DE</TableHead>
                  <TableHead>EN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const nl = getTranslation(p.id, "nl");
                  const de = getTranslation(p.id, "de");
                  const en = getTranslation(p.id, "en");
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.gtin || "—"}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{p.name}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">
                        {p.name_fr ? (
                          <span className="text-emerald-700">{p.name_fr}</span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">
                        {nl ? (
                          <span className="text-blue-700">{nl}</span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">
                        {de ? (
                          <span className="text-purple-700">{de}</span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">
                        {en ? (
                          <span className="text-amber-700">{en}</span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{totalProducts.toLocaleString("fr-FR")} produit(s)</span>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="h-7 w-7" disabled={pPage <= 1} onClick={() => setPPage((p) => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span>Page {pPage}/{totalPages.toLocaleString("fr-FR")}</span>
              <Button size="icon" variant="outline" className="h-7 w-7" disabled={pPage >= totalPages} onClick={() => setPPage((p) => p + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ═══ CATEGORIES TAB ═══ */}
        <TabsContent value="categories" className="space-y-4">
          <CategoriesTranslationTab />
        </TabsContent>

        {/* ═══ SETTINGS TAB ═══ */}
        <TabsContent value="settings" className="space-y-4">
          <div className="bg-white border rounded-lg p-6 space-y-6 max-w-2xl">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">Moteur de traduction</h3>
              <p className="text-sm text-blue-700">
                Les traductions sont générées par <strong>Lovable AI</strong> (Gemini Flash Lite) pour optimiser le coût et la vitesse.
                Chaque batch traduit 20 éléments simultanément en NL, DE et EN.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Langues cibles</h3>
              <div className="flex gap-4">
                {[
                  { code: "nl", flag: "🇧🇪", name: "Néerlandais" },
                  { code: "de", flag: "🇩🇪", name: "Allemand" },
                  { code: "en", flag: "🇬🇧", name: "Anglais" },
                ].map((l) => (
                  <Badge key={l.code} variant="outline" className="px-3 py-1.5 text-sm">
                    {l.flag} {l.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Volume estimé</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• {s.totalProducts.toLocaleString("fr-FR")} produits × 3 langues = ~{(s.totalProducts * 3).toLocaleString("fr-FR")} traductions</p>
                <p>• {s.totalCategories} catégories × 3 langues = ~{s.totalCategories * 3} traductions</p>
                <p>• Lots de 20 éléments avec 1.5s de pause entre chaque lot</p>
                <p>• Temps estimé : ~{Math.ceil(((s.totalProducts) / 20) * 2 / 3600)}h pour le catalogue complet</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── CATEGORIES SUB-COMPONENT ─────────────────────────────────────────────────
function CategoriesTranslationTab() {
  const { data: categoriesData } = useQuery({
    queryKey: ["translation-categories"],
    queryFn: async () => {
      const { data: categories, error } = await supabase
        .from("categories")
        .select("id, name, name_fr")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(100);
      if (error) throw error;

      const ids = (categories || []).map((c: { id: string }) => c.id);
      const { data: translations } = await supabase
        .from("translations")
        .select("entity_id, locale, field, value")
        .eq("entity_type", "category")
        .eq("field", "name")
        .in("entity_id", ids);

      return { categories: categories || [], translations: translations || [] };
    },
  });

  const categories = categoriesData?.categories || [];
  const translations = categoriesData?.translations || [];

  const getT = (id: string, locale: string) => {
    const t = translations.find(
      (tr: TranslationRow) => tr.entity_id === id && tr.locale === locale
    );
    return t?.value || "";
  };

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom (EN)</TableHead>
            <TableHead>FR</TableHead>
            <TableHead>NL</TableHead>
            <TableHead>DE</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((c: { id: string; name: string; name_fr: string | null }) => (
            <TableRow key={c.id}>
              <TableCell className="text-xs">{c.name}</TableCell>
              <TableCell className="text-xs text-emerald-700">{c.name_fr || "—"}</TableCell>
              <TableCell className="text-xs text-blue-700">{getT(c.id, "nl") || "—"}</TableCell>
              <TableCell className="text-xs text-purple-700">{getT(c.id, "de") || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
