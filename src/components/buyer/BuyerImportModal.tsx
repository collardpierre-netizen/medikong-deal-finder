import { useState, useRef, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, FileSpreadsheet, ShoppingCart, X, Loader2, CheckCircle2, TrendingDown, AlertCircle, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPrice } from "@/data/mock";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { startImportJob, useImportJob, fetchJobResults } from "@/hooks/useImportJob";
import { getVendorPublicName } from "@/lib/vendor-display";
import { ImportJobProgress } from "@/components/imports/ImportJobProgress";
import { useEffect } from "react";

type MatchField = "gtin" | "cnk" | "sku";

type ImportLine = {
  ean?: string;
  cnk?: string;
  sku?: string;
  raw_name?: string;
  raw_brand?: string;
  quantity: number;
  currentPrice: number;
};

type MatchedLine = ImportLine & {
  productId?: string;
  productName?: string;
  productImage?: string;
  productSku?: string;
  mediPrice?: number;
  offerId?: string;
  vendorDisplayName?: string;
  matchedBy?: MatchField;
  status: "found" | "unavailable";
  saving?: number;
};

const MATCH_FIELD_LABEL: Record<MatchField, string> = {
  gtin: "GTIN",
  cnk: "CNK",
  sku: "SKU",
};

const MATCH_FIELD_BADGE: Record<MatchField, string> = {
  gtin: "bg-blue-100 text-blue-700 border-blue-200",
  cnk: "bg-purple-100 text-purple-700 border-purple-200",
  sku: "bg-amber-100 text-amber-700 border-amber-200",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ResultFilter = "all" | "found" | "savings" | "more_expensive" | "unavailable";

type ImportPayloadLine = {
  index: number;
  ean: string | null;
  cnk: string | null;
  sku: string | null;
  raw_name: string | null;
  raw_brand: string | null;
  quantity: number;
  currentPrice: number;
};

const CHUNK_SIZE = 80;

const waitForUiPaint = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const calcDeltaPct = (currentPrice: number, mediPrice?: number): number | null => {
  if (!mediPrice || currentPrice <= 0) return null;
  return ((mediPrice - currentPrice) / currentPrice) * 100;
};

const getFilterLabel = (filter: ResultFilter) => {
  if (filter === "savings") return "Économies";
  if (filter === "more_expensive") return "Plus cher";
  if (filter === "unavailable") return "Indispo";
  if (filter === "found") return "Trouvés";
  return "Tout";
};

const getResultStatusLabel = (line: MatchedLine) => {
  if (line.status === "unavailable") return "Indispo";
  return (line.saving || 0) > 0 ? "Dispo · Moins cher" : "Dispo · Plus cher";
};

const getDeltaAmount = (line: MatchedLine) => {
  if (line.status !== "found" || line.mediPrice == null || line.currentPrice <= 0) return null;
  return Number((line.mediPrice - line.currentPrice).toFixed(2));
};

const fetchBestOffers = async (productIds: string[]) => {
  const offers: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("offers")
      .select("id, product_id, price_excl_vat, vendor_id")
      .in("product_id", productIds)
      .eq("is_active", true)
      .order("product_id", { ascending: true })
      .order("price_excl_vat", { ascending: true })
      .range(from, from + 999);

    if (error) throw error;

    const batch = data || [];
    offers.push(...batch);

    if (batch.length < 1000) break;
    from += 1000;
  }

  const bestOfferByProduct = new Map<string, any>();
  for (const offer of offers) {
    if (offer.product_id && !bestOfferByProduct.has(offer.product_id)) {
      bestOfferByProduct.set(offer.product_id, offer);
    }
  }

  // Enrichit les meilleures offres avec le nom du vendeur via la vue publique (pas de PII)
  const vendorIds = Array.from(new Set(
    Array.from(bestOfferByProduct.values()).map((o: any) => o.vendor_id).filter(Boolean)
  )) as string[];
  if (vendorIds.length > 0) {
    const { data: vendorsData } = await supabase
      .from("vendors_public" as any)
      .select("id, display_code, name, company_name")
      .in("id", vendorIds);
    const vendorMap = new Map<string, any>(
      ((vendorsData || []) as any[]).map((v: any) => [v.id, v])
    );
    for (const offer of bestOfferByProduct.values()) {
      offer.vendor_public = vendorMap.get(offer.vendor_id) || null;
    }
  }

  return bestOfferByProduct;
};

const queryMatchImportLines = async (payload: ImportPayloadLine[]) => {
  const eans = [...new Set(payload.map((line) => line.ean).filter(Boolean))] as string[];
  const cnks = [...new Set(payload.map((line) => line.cnk).filter(Boolean))] as string[];
  const skus = [...new Set(payload.map((line) => line.sku).filter(Boolean))] as string[];

  const [productsByEanResult, productsByCnkResult, productsBySkuResult] = await Promise.all([
    eans.length > 0
      ? supabase
          .from("products")
          .select("id, name, image_url, gtin, cnk_code, sku")
          .in("gtin", eans)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    cnks.length > 0
      ? supabase
          .from("products")
          .select("id, name, image_url, gtin, cnk_code, sku")
          .in("cnk_code", cnks)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    skus.length > 0
      ? supabase
          .from("products")
          .select("id, name, image_url, gtin, cnk_code, sku")
          .in("sku", skus)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsByEanResult.error) throw productsByEanResult.error;
  if (productsByCnkResult.error) throw productsByCnkResult.error;
  if (productsBySkuResult.error) throw productsBySkuResult.error;

  const productByEan = new Map<string, any>();
  const productByCnk = new Map<string, any>();
  const productBySku = new Map<string, any>();

  for (const product of [
    ...(productsByEanResult.data || []),
    ...(productsByCnkResult.data || []),
    ...(productsBySkuResult.data || []),
  ]) {
    if (product.gtin && !productByEan.has(product.gtin)) productByEan.set(product.gtin, product);
    if (product.cnk_code && !productByCnk.has(product.cnk_code)) productByCnk.set(product.cnk_code, product);
    if (product.sku && !productBySku.has(product.sku)) productBySku.set(product.sku, product);
  }

  // Stratégie de fallback : GTIN > CNK > SKU
  const resolveMatch = (line: { ean: string | null; cnk: string | null; sku: string | null }):
    { product: any | undefined; matchedBy?: MatchField } => {
    if (line.ean) {
      const p = productByEan.get(line.ean);
      if (p) return { product: p, matchedBy: "gtin" };
    }
    if (line.cnk) {
      const p = productByCnk.get(line.cnk);
      if (p) return { product: p, matchedBy: "cnk" };
    }
    if (line.sku) {
      const p = productBySku.get(line.sku);
      if (p) return { product: p, matchedBy: "sku" };
    }
    return { product: undefined };
  };

  const productIds = [
    ...new Set(
      payload
        .map((line) => resolveMatch(line).product?.id)
        .filter(Boolean),
    ),
  ] as string[];

  const bestOfferByProduct = productIds.length > 0 ? await fetchBestOffers(productIds) : new Map<string, any>();

  return payload.map(({ index, ean, cnk, sku, quantity, currentPrice }) => {
    const { product, matchedBy } = resolveMatch({ ean, cnk, sku });
    const offer = product ? bestOfferByProduct.get(product.id) : undefined;
    const mediPrice = offer?.price_excl_vat != null ? Number(offer.price_excl_vat) : undefined;
    const vendor = offer?.vendor_public as { display_code?: string | null; name?: string | null; company_name?: string | null } | null | undefined;

    return {
      lineIndex: index,
      result: {
        ean: ean ?? undefined,
        cnk: cnk ?? undefined,
        sku: sku ?? undefined,
        quantity,
        currentPrice,
        productId: product?.id,
        productName: product?.name ?? undefined,
        productImage: product?.image_url ?? undefined,
        productSku: product?.sku ?? undefined,
        mediPrice,
        offerId: offer?.id ?? undefined,
        // 🔒 Anonymisation : libellé public uniquement, jamais company_name/name brut.
        vendorDisplayName: vendor ? getVendorPublicName(vendor) : "—",
        matchedBy,
        status: product && offer ? "found" : "unavailable",
        saving: mediPrice != null && currentPrice > mediPrice ? Math.max(0, currentPrice - mediPrice) : 0,
      } satisfies MatchedLine,
    };
  });
};

export function BuyerImportModal({ open, onOpenChange }: Props) {
  const [phase, setPhase] = useState<"instructions" | "loading" | "results">("instructions");
  const [results, setResults] = useState<MatchedLine[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState({ current: 0, total: 0, startTime: 0 });
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [jobId, setJobId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addToCart } = useCart();
  const { user } = useAuth();
  const [saveToAccount, setSaveToAccount] = useState(true);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const reset = useCallback(() => {
    setPhase("instructions");
    setResults([]);
    setSelected(new Set());
    setProgress({ current: 0, total: 0, startTime: 0 });
    setFilter("all");
    setSavedCount(null);
    setJobId(null);
  }, []);

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // Suit le job actif et bascule en "results" quand le worker a terminé
  const { job: activeJob } = useImportJob(jobId);
  useEffect(() => {
    if (!activeJob || activeJob.status !== "completed") return;
    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchJobResults(activeJob.id);
        if (cancelled) return;
        const finalResults = ((payload?.results ?? []) as MatchedLine[]).filter(Boolean);
        setResults(finalResults);
        const auto = new Set<number>();
        finalResults.forEach((r, i) => {
          if (r.status === "found" && (r.saving || 0) > 0) auto.add(i);
        });
        setSelected(auto);
        setPhase("results");

        if (activeJob.metadata?.save_to_account && user) {
          const toUpsert = finalResults
            .filter((r) => r.status === "found" && r.productId && r.currentPrice > 0)
            .map((r) => ({
              user_id: user.id,
              product_id: r.productId!,
              my_purchase_price: r.currentPrice,
              updated_at: new Date().toISOString(),
            }));
          if (toUpsert.length > 0) {
            const { error } = await supabase.from("user_prices")
              .upsert(toUpsert, { onConflict: "user_id,product_id" });
            if (!error) {
              setSavedCount(toUpsert.length);
              toast.success(`${toUpsert.length} prix enregistré(s) dans Mes Prix`);
            }
          }
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Impossible de charger les résultats");
      }
    })();
    return () => { cancelled = true; };
  }, [activeJob, user]);

  useEffect(() => {
    if (activeJob?.status === "failed") {
      toast.error(activeJob.error_message ?? "L'import a échoué");
    }
  }, [activeJob?.status, activeJob?.error_message]);

  const downloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/medikong_template_import.xlsx";
    link.download = "medikong_template_import.xlsx";
    link.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPhase("loading");
    await waitForUiPaint();

    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws);

      const cleanCode = (raw: any): string | undefined => {
        if (raw === null || raw === undefined) return undefined;
        // Strip NBSP, spaces, tabs, dashes — keep digits/alphanumerics only
        const s = String(raw).replace(/[\s\u00A0\u200B-]/g, "").trim();
        if (!s || s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return undefined;
        return s;
      };
      const parsePrice = (raw: any): number => {
        if (raw === null || raw === undefined || raw === "") return 0;
        if (typeof raw === "number") return raw;
        const cleaned = String(raw).replace(/[\s\u00A0€$£]/g, "").replace(",", ".");
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : 0;
      };

      const cleanText = (raw: any): string | undefined => {
        if (raw === null || raw === undefined) return undefined;
        const s = String(raw).trim();
        if (!s || s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return undefined;
        return s.slice(0, 300);
      };

      const lines: ImportLine[] = rows.map((r: any) => ({
        ean: cleanCode(r["EAN (ou CNK)"] ?? r["EAN"] ?? r["ean"] ?? r["GTIN"] ?? r["gtin"]),
        cnk: cleanCode(r["CNK (optionnel)"] ?? r["CNK"] ?? r["cnk"]),
        sku: cleanCode(r["SKU"] ?? r["sku"] ?? r["Référence"] ?? r["Reference"] ?? r["Ref"] ?? r["ref"]),
        raw_name: cleanText(
          r["Nom"] ?? r["nom"] ?? r["Désignation"] ?? r["Designation"] ?? r["designation"] ??
          r["Libellé"] ?? r["Libelle"] ?? r["libelle"] ?? r["Product"] ?? r["Produit"] ?? r["produit"]
        ),
        raw_brand: cleanText(
          r["Marque"] ?? r["marque"] ?? r["Brand"] ?? r["brand"] ?? r["Fabricant"] ?? r["fabricant"]
        ),
        quantity: Number(r["Quantité"] || r["Quantite"] || r["quantity"] || r["Qty"] || 1),
        currentPrice: parsePrice(
          r["Prix actuel HTVA (€)"] ??
          r["Prix actuel HTVA"] ??
          r["Prix achat actuel (€ HT)"] ??
          r["Prix achat HT"] ??
          r["Prix HT"] ??
          r["Prix"] ??
          r["price"]
        ),
      })).filter(l => l.ean || l.cnk || l.sku);

      if (lines.length === 0) {
        toast.error("Aucune ligne valide trouvée dans le fichier");
        setPhase("instructions");
        return;
      }

      // Détection doublons GTIN/CNK dans le fichier — bloquant
      const seenEan = new Map<string, number[]>();
      const seenCnk = new Map<string, number[]>();
      lines.forEach((l, idx) => {
        const rowNum = idx + 2; // +1 header, +1 base 1
        if (l.ean) {
          if (!seenEan.has(l.ean)) seenEan.set(l.ean, []);
          seenEan.get(l.ean)!.push(rowNum);
        }
        if (l.cnk) {
          if (!seenCnk.has(l.cnk)) seenCnk.set(l.cnk, []);
          seenCnk.get(l.cnk)!.push(rowNum);
        }
      });
      const dupEan = Array.from(seenEan.entries()).filter(([, rows]) => rows.length > 1);
      const dupCnk = Array.from(seenCnk.entries()).filter(([, rows]) => rows.length > 1);
      const dupCount = dupEan.length + dupCnk.length;

      if (dupCount > 0) {
        // Construit un CSV à télécharger
        const header = "type,code,duplicate_rows";
        const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
        const body = [
          ...dupEan.map(([code, rows]) => ["EAN", escape(code), escape(rows.join("|"))].join(",")),
          ...dupCnk.map(([code, rows]) => ["CNK", escape(code), escape(rows.join("|"))].join(",")),
        ].join("\n");
        const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `doublons-import-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        toast.error(
          `Import bloqué : ${dupCount} code(s) en double détecté(s) (${dupEan.length} EAN, ${dupCnk.length} CNK). Un fichier CSV listant les doublons a été téléchargé.`,
          { duration: 8000 }
        );
        setPhase("instructions");
        setProgress({ current: 0, total: 0, startTime: 0 });
        return;
      }

      setProgress({ current: 0, total: lines.length, startTime: Date.now() });
      await waitForUiPaint();

      const payload: ImportPayloadLine[] = lines.map((line, index) => ({
        index,
        ean: line.ean ?? null,
        cnk: line.cnk ?? null,
        sku: line.sku ?? null,
        raw_name: line.raw_name ?? null,
        raw_brand: line.raw_brand ?? null,
        quantity: line.quantity,
        currentPrice: line.currentPrice,
      }));

      // Création du job asynchrone — le worker serveur traite par batch et stream la progression via Realtime
      try {
        const newJobId = await startImportJob({
          jobType: "buyer_comparator",
          fileName: file.name,
          fileSizeBytes: file.size,
          rows: payload,
          metadata: { save_to_account: saveToAccount && !!user },
        });
        setJobId(newJobId);
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message ?? "Impossible de démarrer l'import");
        setPhase("instructions");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la lecture du fichier");
      setPhase("instructions");
    }
  };

  const foundLines = results.filter(r => r.status === "found");
  const unavailableLines = results.filter(r => r.status === "unavailable");
  const savingsLines = foundLines.filter(r => (r.saving || 0) > 0);
  const moreExpensiveLines = foundLines.filter(r => !r.saving || r.saving <= 0);
  const totalSavings = savingsLines.reduce((a, r) => a + (r.saving || 0) * r.quantity, 0);
  const avgSavingPct = savingsLines.length > 0
    ? savingsLines.reduce((a, r) => {
        const pct = calcDeltaPct(r.currentPrice, r.mediPrice);
        return a + (pct ?? 0);
      }, 0) / savingsLines.length
    : 0;

  const filteredResults = useMemo(() => {
    return results.map((r, i) => ({ ...r, _idx: i })).filter(r => {
      if (filter === "found") return r.status === "found";
      if (filter === "savings") return r.status === "found" && (r.saving || 0) > 0;
      if (filter === "more_expensive") return r.status === "found" && (!r.saving || r.saving <= 0);
      if (filter === "unavailable") return r.status === "unavailable";
      return true;
    });
  }, [results, filter]);

  // Export = toute l'analyse (pas seulement le filtre actif) pour permettre de
  // sonder en Excel/PDF les indispos et les lignes plus chères côté client.
  const exportSourceRows = results;

  const exportRows = useMemo(() => {
    return exportSourceRows.map((r) => {
      const deltaPct = calcDeltaPct(r.currentPrice, r.mediPrice);
      const deltaAmount = getDeltaAmount(r);
      const lineSaving = r.status === "found" && (r.saving || 0) > 0
        ? Number(((r.saving || 0) * r.quantity).toFixed(2))
        : null;

      return {
        Produit: r.productName || "Non trouvé",
        EAN: r.ean || "",
        CNK: r.cnk || "",
        SKU: r.sku || r.productSku || "",
        "Identifié par": r.matchedBy ? MATCH_FIELD_LABEL[r.matchedBy] : "Aucun match (GTIN/CNK/SKU)",
        Vendeur: r.status === "found" ? (r.vendorDisplayName || "—") : "—",
        "Qté": r.quantity,
        "Votre prix HT": r.currentPrice > 0 ? Number(r.currentPrice.toFixed(2)) : null,
        "Prix MediKong HT": r.mediPrice != null ? Number(r.mediPrice.toFixed(2)) : null,
        "Δ €/u.": deltaAmount,
        "Δ %": deltaPct != null ? Number(deltaPct.toFixed(1)) : null,
        "Économie ligne (€)": lineSaving,
        Statut: getResultStatusLabel(r),
      };
    });
  }, [exportSourceRows]);

  const exportSummary = useMemo(() => {
    const exportFound = exportSourceRows.filter((r) => r.status === "found").length;
    const exportUnavailable = exportSourceRows.filter((r) => r.status === "unavailable").length;
    const exportSavings = exportSourceRows.filter((r) => r.status === "found" && (r.saving || 0) > 0);
    const exportMoreExpensive = exportSourceRows.filter((r) => r.status === "found" && (!r.saving || r.saving <= 0)).length;
    const exportSavingsAmount = exportSavings.reduce((acc, r) => acc + (r.saving || 0) * r.quantity, 0);
    const avgPct = exportSavings.length > 0
      ? exportSavings.reduce((acc, r) => acc + (calcDeltaPct(r.currentPrice, r.mediPrice) ?? 0), 0) / exportSavings.length
      : 0;

    return {
      label: "Toute l'analyse",
      totalLines: exportSourceRows.length,
      exportedLines: exportSourceRows.length,
      found: exportFound,
      unavailable: exportUnavailable,
      savings: exportSavings.length,
      moreExpensive: exportMoreExpensive,
      totalSavings: exportSavingsAmount,
      avgSavingPct: Math.abs(avgPct),
    };
  }, [exportSourceRows]);

  const exportXlsx = useCallback(() => {
    if (exportRows.length === 0) {
      toast.error("Aucune ligne à exporter");
      return;
    }

    const wb = XLSX.utils.book_new();

    // Feuille "Résumé" — reflète les KPI cards du popup à l'identique
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["Analyse comparateur de prix MediKong"],
      ["Exporté le", new Date().toLocaleString("fr-FR")],
      [],
      ["Indicateur", "Valeur", "Détail"],
      ["Lignes importées", exportSummary.totalLines, ""],
      ["Trouvés", exportSummary.found, `${exportSummary.found} / ${exportSummary.totalLines}`],
      ["Indisponibles", exportSummary.unavailable, "Aucun match GTIN / CNK / SKU"],
      ["Moins chers (MediKong)", exportSummary.savings, exportSummary.avgSavingPct > 0 ? `${exportSummary.avgSavingPct.toFixed(1)}% en moyenne` : ""],
      ["Plus chers (MediKong)", exportSummary.moreExpensive, ""],
      ["Économie potentielle (€)", Number(exportSummary.totalSavings.toFixed(2)), "Σ (Votre prix − Prix MediKong) × Qté sur lignes Moins chères"],
      [],
      ["Comment lire la feuille « Analyse »"],
      ["Statut", "Indispo = produit non trouvé chez MediKong → à sourcer / proposer en RFQ"],
      ["", "Dispo - moins cher = MediKong est moins cher que votre prix actuel"],
      ["", "Dispo - plus cher = MediKong est plus cher → à challenger côté vendeur"],
      ["Identifié par", "GTIN / CNK / SKU si match, sinon « Aucun match (GTIN/CNK/SKU) »"],
      ["Δ €/u.", "Prix MediKong − Votre prix (par unité, HT)"],
      ["Économie ligne", "(Votre prix − Prix MediKong) × Qté, uniquement si MediKong moins cher"],
    ]);
    summarySheet["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 60 }];

    const detailsSheet = XLSX.utils.json_to_sheet(exportRows);
    detailsSheet["!cols"] = [
      { wch: 38 }, // Produit
      { wch: 16 }, // EAN
      { wch: 12 }, // CNK
      { wch: 16 }, // SKU
      { wch: 28 }, // Identifié par
      { wch: 26 }, // Vendeur
      { wch: 6 },  // Qté
      { wch: 14 }, // Votre prix HT
      { wch: 16 }, // Prix MediKong HT
      { wch: 10 }, // Δ €/u.
      { wch: 8 },  // Δ %
      { wch: 16 }, // Économie ligne
      { wch: 22 }, // Statut
    ];
    // Auto-filter sur l'en-tête pour pouvoir trier/filtrer dans Excel
    if (exportRows.length > 0) {
      detailsSheet["!autofilter"] = { ref: detailsSheet["!ref"]! };
    }

    XLSX.utils.book_append_sheet(wb, summarySheet, "Résumé");
    XLSX.utils.book_append_sheet(wb, detailsSheet, "Analyse");

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `comparateur-medikong-complet-${date}.xlsx`);
    toast.success(`Export XLS téléchargé (${exportSummary.exportedLines} lignes)`);
  }, [exportRows, exportSummary]);

  const exportPdf = useCallback(() => {
    if (exportRows.length === 0) {
      toast.error("Aucune ligne à exporter");
      return;
    }

    // jsPDF utilise Helvetica WinAnsi (Latin-1). On remplace les caractères Unicode
    // hors-encodage qui sinon sortent en glyphes parasites (Σ→£, Δ→~, − U+2212→",
    // ' U+2019→?, " U+201C/D→?, – U+2013→?, ≥→?, ≤→?, → →?).
    const T = (s: string): string =>
      s
        .replace(/\u03A3/g, "Somme") // Σ
        .replace(/\u0394/g, "Ecart") // Δ
        .replace(/\u2212/g, "-")      // − minus sign
        .replace(/\u2013/g, "-")      // – en dash
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // ‘ ’ ‚ ‛
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // “ ” „ ‟
        .replace(/\u2265/g, ">=")    // ≥
        .replace(/\u2264/g, "<=")    // ≤
        .replace(/\u2192/g, "->")    // →
        .replace(/\u2026/g, "...");  // …

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const generatedAt = new Date().toLocaleString("fr-FR");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Bandeau d'en-tête (couleur navy MediKong)
    doc.setFillColor(30, 37, 47);
    doc.rect(0, 0, pageWidth, 64, "F");
    doc.setFillColor(28, 88, 217); // accent Primary Blue
    doc.rect(0, 64, pageWidth, 3, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(T("Analyse comparateur de prix MediKong"), 40, 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(T(`${exportSummary.label} · Exporté le ${generatedAt}`), 40, 50);
    doc.setTextColor(31, 41, 55);

    // Tableau KPI (miroir exact des KPI cards du popup et de la feuille Résumé XLS)
    autoTable(doc, {
      startY: 84,
      head: [["Indicateur", "Valeur", "Détail"].map(T)],
      body: [
        ["Lignes importées", String(exportSummary.totalLines), ""],
        ["Trouvés", String(exportSummary.found), `${exportSummary.found} / ${exportSummary.totalLines}`],
        ["Indisponibles", String(exportSummary.unavailable), "Aucun match GTIN / CNK / SKU"],
        ["Moins chers (MediKong)", String(exportSummary.savings), exportSummary.avgSavingPct > 0 ? `${exportSummary.avgSavingPct.toFixed(1)}% en moyenne` : ""],
        ["Plus chers (MediKong)", String(exportSummary.moreExpensive), ""],
        ["Économie potentielle (€)", formatPrice(exportSummary.totalSavings), "Total (Votre prix - Prix MediKong) x Qté sur lignes Moins chères"],
      ].map((r) => r.map(T)),
      styles: { fontSize: 9, cellPadding: 5, textColor: [31, 41, 55] },
      headStyles: { fillColor: [30, 37, 47], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 170, fontStyle: "bold" },
        1: { cellWidth: 90, halign: "right" },
        2: { cellWidth: "auto", textColor: [107, 114, 128] },
      },
      margin: { left: 40, right: 40 },
    });

    // Légende — explique les KPI et les formules de calcul
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [[T("Légende — comment lire ce rapport")]],
      body: [
        ["Lignes importées : nombre total de lignes lues dans votre fichier source."],
        ["Trouvés : lignes pour lesquelles MediKong a identifié le produit via GTIN, CNK ou SKU."],
        ["Indisponibles : lignes sans correspondance dans le catalogue MediKong (à sourcer ou à proposer en RFQ)."],
        ["Moins chers (MediKong) : lignes Trouvées où le prix MediKong est strictement inférieur à votre prix d'achat actuel. Le « % moyen » est la moyenne des écarts relatifs (Prix MediKong - Votre prix) / Votre prix sur ces lignes."],
        ["Plus chers (MediKong) : lignes Trouvées où MediKong est >= à votre prix actuel - à challenger côté vendeur."],
        ["Économie potentielle (€) : Somme ((Votre prix - Prix MediKong) x Qté) calculée uniquement sur les lignes « Moins chers (MediKong) ». Tous les prix sont HT."],
        ["Économie ligne (colonne du tableau détail) : (Votre prix - Prix MediKong) x Qté de la ligne, affichée uniquement quand MediKong est moins cher. Sinon « - »."],
        ["Écart €/u. : Prix MediKong - Votre prix, par unité, HT. Écart % : même écart exprimé en pourcentage de Votre prix."],
        ["Couleurs : vert = Dispo · Moins cher, rouge = Dispo · Plus cher, orange = Indispo (mêmes codes que le popup)."],
      ].map((r) => r.map(T)),
      styles: { fontSize: 8, cellPadding: 5, textColor: [55, 65, 81], lineColor: [229, 231, 235], lineWidth: 0.5 },
      headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: "bold" },
      margin: { left: 40, right: 40 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 14,
      head: [["Produit", "Codes", "Identifié par", "Vendeur", "Qté", "Votre prix", "Prix MediKong", "Écart €/u.", "Écart %", "Économie ligne", "Statut"].map(T)],
      body: exportSourceRows.map((r) => {
        const deltaPct = calcDeltaPct(r.currentPrice, r.mediPrice);
        const deltaAmount = getDeltaAmount(r);
        const lineSaving = r.status === "found" && (r.saving || 0) > 0
          ? (r.saving || 0) * r.quantity
          : null;

        return [
          r.productName || "Non trouvé",
          [
            r.ean ? `EAN: ${r.ean}` : null,
            r.cnk ? `CNK: ${r.cnk}` : null,
            r.sku ? `SKU: ${r.sku}` : null,
          ].filter(Boolean).join(" · ") || "-",
          r.matchedBy ? MATCH_FIELD_LABEL[r.matchedBy] : "Aucun match",
          r.status === "found" ? (r.vendorDisplayName || "-") : "-",
          String(r.quantity),
          r.currentPrice > 0 ? formatPrice(r.currentPrice) : "-",
          r.mediPrice != null ? formatPrice(r.mediPrice) : "-",
          deltaAmount != null ? `${deltaAmount > 0 ? "+" : "-"}${formatPrice(Math.abs(deltaAmount)).replace("€", "").trim()}` : "-",
          deltaPct != null ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : "-",
          lineSaving != null ? formatPrice(lineSaving) : "-",
          getResultStatusLabel(r),
        ].map(T);
      }),
      styles: { fontSize: 8, cellPadding: 4, textColor: [31, 41, 55], lineColor: [229, 231, 235], lineWidth: 0.25 },
      headStyles: { fillColor: [28, 88, 217], textColor: [255, 255, 255], fontStyle: "bold" },
      showHead: "everyPage",
      rowPageBreak: "avoid",
      columnStyles: {
        0: { cellWidth: 150 },
        1: { cellWidth: 95 },
        2: { halign: "center", cellWidth: 55 },
        3: { cellWidth: 90 },
        4: { halign: "center", cellWidth: 28 },
        5: { halign: "right", cellWidth: 52 },
        6: { halign: "right", cellWidth: 60 },
        7: { halign: "right", cellWidth: 50 },
        8: { halign: "right", cellWidth: 44 },
        9: { halign: "right", cellWidth: 60 },
        10: { cellWidth: 70 },
      },
      margin: { left: 40, right: 40, bottom: 40 },
      didParseCell: (hookData) => {
        if (hookData.section !== "body") return;
        const row = exportSourceRows[hookData.row.index];
        if (!row) return;

        const isUnavailable = row.status === "unavailable";
        const isSaving = row.status === "found" && (row.saving || 0) > 0;
        const isMoreExpensive = row.status === "found" && !isSaving;

        // Tinted row background matching popup row colors
        if (isUnavailable) {
          hookData.cell.styles.fillColor = [255, 247, 237]; // orange-50/40
        } else if (isSaving) {
          hookData.cell.styles.fillColor = [236, 253, 245]; // emerald-50/40
        } else {
          hookData.cell.styles.fillColor = [254, 242, 242]; // red-50/40
        }

        // Statut column (last) — colored badge matching popup pills
        if (hookData.column.index === 10) {
          hookData.cell.styles.halign = "center";
          hookData.cell.styles.fontStyle = "bold";
          if (isSaving) {
            hookData.cell.styles.fillColor = [209, 250, 229]; // emerald-100
            hookData.cell.styles.textColor = [4, 120, 87]; // emerald-700
          } else if (isMoreExpensive) {
            hookData.cell.styles.fillColor = [254, 226, 226]; // red-100
            hookData.cell.styles.textColor = [220, 38, 38]; // red-600
          } else {
            hookData.cell.styles.fillColor = [255, 237, 213]; // orange-100
            hookData.cell.styles.textColor = [234, 88, 12]; // orange-600
          }
        }
      },
    });

    // Pied de page : pagination + mention sur toutes les pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(T("MediKong · Comparateur de prix B2B"), 40, pageHeight - 18);
      doc.text(`Page ${i} / ${pageCount}`, pageWidth - 40, pageHeight - 18, { align: "right" });
    }

    doc.save(`comparateur-medikong-complet-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(`Export PDF téléchargé (${exportSummary.exportedLines} lignes)`);
  }, [exportRows, exportSummary, exportSourceRows]);

  const toggleAll = () => {
    const foundIndices = results.map((_, i) => i).filter(i => results[i].status === "found");
    if (selected.size === foundLines.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(foundIndices));
    }
  };

  const handleAddToCart = () => {
    let added = 0;
    selected.forEach(idx => {
      const r = results[idx];
      if (r.offerId && r.productId) {
        addToCart.mutate({ offerId: r.offerId, productId: r.productId, quantity: r.quantity });
        added++;
      }
    });
    if (added > 0) {
      toast.success(`${added} produit(s) ajouté(s) au panier`);
      handleClose(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[780px] max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet size={20} className="text-primary" />
              Comparateur de prix
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            Importez votre liste d'achats pour comparer vos prix avec les offres MediKong
          </p>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Instructions - collapsible in results phase */}
          {phase !== "results" && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm space-y-1">
              <p className="font-semibold text-primary">Comment ça marche ?</p>
              <ol className="list-decimal list-inside space-y-0.5 text-primary/80">
                <li>Téléchargez le template Excel ci-dessous</li>
                <li>Remplissez avec vos références (EAN ou CNK), quantités et prix d'achat actuels</li>
                <li>Importez le fichier pour voir les offres MediKong disponibles</li>
                <li>Validez les lignes intéressantes pour les ajouter au panier</li>
              </ol>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
              <Download size={14} /> Télécharger le template
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5" disabled={phase === "loading"}>
              {phase === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {phase === "results" ? "Réimporter" : "Importer un fichier"}
            </Button>
            {phase === "results" && (
              <>
                <Button variant="outline" size="sm" onClick={exportXlsx} className="gap-1.5" disabled={filteredResults.length === 0}>
                  <Download size={14} /> Exporter XLS
                </Button>
                <Button variant="outline" size="sm" onClick={exportPdf} className="gap-1.5" disabled={filteredResults.length === 0}>
                  <Download size={14} /> Exporter PDF
                </Button>
              </>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
          </div>

          {/* Save-to-account toggle (only relevant before import) */}
          {phase !== "results" && user && (
            <label className="flex items-start gap-2 text-sm bg-muted/40 border border-border rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted/60 transition">
              <Checkbox
                checked={saveToAccount}
                onCheckedChange={(c) => setSaveToAccount(c === true)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium text-foreground">Enregistrer mes prix dans mon compte</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vos prix d'achat seront sauvegardés dans <span className="font-medium">Mes Prix</span> pour la veille concurrentielle automatique. Aucune ligne existante ne sera supprimée — seuls les prix correspondants sont mis à jour.
                </p>
              </div>
            </label>
          )}

          {/* Saved-to-account confirmation banner */}
          {phase === "results" && savedCount !== null && savedCount > 0 && (
            <div className="flex items-center gap-2 text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-emerald-800">
              <CheckCircle2 size={16} />
              <span className="flex-1">
                <strong>{savedCount}</strong> prix enregistré{savedCount > 1 ? "s" : ""} dans votre compte.
              </span>
              <a href="/mes-prix" className="underline font-medium hover:text-emerald-900">
                Voir Mes Prix →
              </a>
            </div>
          )}

          {/* Loading — job asynchrone serveur avec progression Realtime */}
          {phase === "loading" && jobId && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-primary" />
                <h3 className="text-sm font-semibold">Analyse en cours côté serveur</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Vous pouvez fermer cette fenêtre et revenir plus tard — l'import continue en arrière-plan.
                Vos jobs sont consultables dans <a href="/mes-imports" className="underline">Mes imports</a>.
              </p>
              <ImportJobProgress jobId={jobId} />
            </div>
          )}
          {phase === "loading" && !jobId && <LoadingBar progress={progress} />}

          {/* Results */}
          {phase === "results" && (
            <>
              {/* KPI Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiBox
                  icon={<Package size={16} />}
                  value={foundLines.length}
                  total={results.length}
                  label="Trouvés"
                  accent="text-primary"
                  bgAccent="bg-primary/10"
                />
                <KpiBox
                  icon={<AlertCircle size={16} />}
                  value={unavailableLines.length}
                  label="Indisponibles"
                  accent="text-destructive"
                  bgAccent="bg-destructive/10"
                />
                <KpiBox
                  icon={<TrendingDown size={16} />}
                  value={savingsLines.length}
                  label="Moins chers"
                  sub={avgSavingPct !== 0 ? `${Math.abs(avgSavingPct).toFixed(1)}% en moy.` : undefined}
                  accent="text-emerald-600"
                  bgAccent="bg-emerald-50"
                />
                <KpiBox
                  icon={<ShoppingCart size={16} />}
                  value={formatPrice(totalSavings)}
                  label="Économie potentielle"
                  accent="text-emerald-600"
                  bgAccent="bg-emerald-50"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Tabs value={filter} onValueChange={(v) => setFilter(v as ResultFilter)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="text-xs px-3 h-7">Tout ({results.length})</TabsTrigger>
                    <TabsTrigger value="savings" className="text-xs px-3 h-7">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1 inline-block" />
                      Économies ({savingsLines.length})
                    </TabsTrigger>
                    <TabsTrigger value="more_expensive" className="text-xs px-3 h-7">
                      <span className="w-2 h-2 rounded-full bg-red-500 mr-1 inline-block" />
                      Plus cher ({moreExpensiveLines.length})
                    </TabsTrigger>
                    <TabsTrigger value="unavailable" className="text-xs px-3 h-7">
                      <span className="w-2 h-2 rounded-full bg-orange-400 mr-1 inline-block" />
                      Indispo ({unavailableLines.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs h-7">
                  {selected.size === foundLines.length ? "Désélectionner tout" : "Sélectionner tout"}
                </Button>
              </div>

              {/* Results table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[340px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-background sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                      <tr>
                        <th className="p-2 w-8"></th>
                        <th className="p-2 text-left font-medium text-muted-foreground text-xs">Produit</th>
                        <th className="p-2 text-center font-medium text-muted-foreground text-xs">Qté</th>
                        <th className="p-2 text-right font-medium text-muted-foreground text-xs">Votre prix</th>
                        <th className="p-2 text-right font-medium text-muted-foreground text-xs">Prix MediKong</th>
                        <th className="p-2 text-right font-medium text-muted-foreground text-xs">Δ €</th>
                        <th className="p-2 text-right font-medium text-muted-foreground text-xs">Δ %</th>
                        <th className="p-2 text-center font-medium text-muted-foreground text-xs">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((r) => {
                        const deltaPct = calcDeltaPct(r.currentPrice, r.mediPrice);
                        const isNeg = deltaPct !== null && deltaPct < 0;
                        const hasSaving = r.status === "found" && (r.saving || 0) > 0;
                        const isMoreExpensive = r.status === "found" && (!r.saving || r.saving <= 0);
                        const rowBg = selected.has(r._idx) ? "bg-primary/5" : hasSaving ? "bg-emerald-50/40" : isMoreExpensive ? "bg-red-50/40" : r.status === "unavailable" ? "bg-orange-50/40" : "";
                        return (
                          <tr key={r._idx} className={`border-t transition-colors hover:bg-muted/30 ${rowBg}`}>
                            <td className="p-2 text-center">
                              {r.status === "found" && (
                                <Checkbox
                                  checked={selected.has(r._idx)}
                                  onCheckedChange={(v) => {
                                    const s = new Set(selected);
                                    v ? s.add(r._idx) : s.delete(r._idx);
                                    setSelected(s);
                                  }}
                                />
                              )}
                            </td>
                            <td className="p-2 max-w-[220px]">
                              {r.status === "found" ? (
                                <div className="space-y-1">
                                  <p className="font-medium text-foreground text-xs line-clamp-1">{r.productName}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {[
                                      r.ean && `EAN: ${r.ean}`,
                                      r.cnk && `CNK: ${r.cnk}`,
                                      r.sku && `SKU: ${r.sku}`,
                                    ].filter(Boolean).join(" · ")}
                                  </p>
                                  {r.matchedBy && (
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${MATCH_FIELD_BADGE[r.matchedBy]}`}
                                      title={`Produit identifié via ${MATCH_FIELD_LABEL[r.matchedBy]}`}
                                    >
                                      ✓ {MATCH_FIELD_LABEL[r.matchedBy]}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <p className="font-medium text-destructive text-xs">Non trouvé</p>
                                  <p className="text-[10px] text-destructive/70 truncate">
                                    {[
                                      r.ean && `EAN: ${r.ean}`,
                                      r.cnk && `CNK: ${r.cnk}`,
                                      r.sku && `SKU: ${r.sku}`,
                                    ].filter(Boolean).join(" · ")}
                                  </p>
                                  <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-1.5 py-0.5 text-[9px] font-medium text-destructive">
                                    Aucun match (GTIN/CNK/SKU)
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-center text-xs tabular-nums">{r.quantity}</td>
                            <td className="p-2 text-right text-xs tabular-nums">{r.currentPrice > 0 ? formatPrice(r.currentPrice) : "—"}</td>
                            <td className="p-2 text-right text-xs font-semibold tabular-nums">
                              {r.mediPrice ? formatPrice(r.mediPrice) : "—"}
                            </td>
                            <td className="p-2 text-right text-xs tabular-nums">
                              {r.saving && r.saving > 0 ? (
                                <span className="text-emerald-600 font-semibold">-{formatPrice(r.saving)}</span>
                              ) : r.status === "found" && r.mediPrice && r.currentPrice > 0 ? (
                                <span className="text-red-600 font-semibold">+{formatPrice(Math.abs((r.mediPrice || 0) - r.currentPrice))}</span>
                              ) : "—"}
                            </td>
                            <td className="p-2 text-right text-xs tabular-nums">
                              {deltaPct !== null ? (
                                <span className={`font-semibold ${isNeg ? "text-emerald-600" : "text-destructive"}`}>
                                  {isNeg ? "" : "+"}{deltaPct.toFixed(1)}%
                                </span>
                              ) : "—"}
                            </td>
                            <td className="p-2 text-center">
                              {r.status === "found" && hasSaving ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                                  <CheckCircle2 size={10} /> Dispo
                                </span>
                              ) : r.status === "found" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-100 rounded-full px-2 py-0.5">
                                  <AlertCircle size={10} /> Dispo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-100 rounded-full px-2 py-0.5">
                                  <X size={10} /> Indispo
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredResults.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">
                            Aucun résultat pour ce filtre
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {selected.size} produit(s) sélectionné(s)
                  {selected.size > 0 && (() => {
                    const selSaving = Array.from(selected).reduce((a, idx) => {
                      const r = results[idx];
                      return a + (r?.saving || 0) * (r?.quantity || 1);
                    }, 0);
                    return selSaving > 0 ? ` · Économie : ${formatPrice(selSaving)}` : "";
                  })()}
                </span>
                <Button size="sm" onClick={handleAddToCart} disabled={selected.size === 0} className="gap-1.5">
                  <ShoppingCart size={14} /> Ajouter au panier ({selected.size})
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-components ─── */

function LoadingBar({ progress }: { progress: { current: number; total: number; startTime: number } }) {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const elapsed = (Date.now() - progress.startTime) / 1000;
  const rate = progress.current > 0 ? elapsed / progress.current : 0;
  const remaining = progress.current > 0 ? Math.max(0, Math.round(rate * (progress.total - progress.current))) : null;
  return (
    <div className="py-6 space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Analyse en cours…</span>
        <span className="tabular-nums">{progress.current}/{progress.total} lignes</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
        <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{pct}%</span>
        <span>{remaining === null ? "Estimation…" : `~${remaining}s restant`}</span>
      </div>
    </div>
  );
}

function KpiBox({ icon, value, total, label, sub, accent, bgAccent }: {
  icon: React.ReactNode;
  value: string | number;
  total?: number;
  label: string;
  sub?: string;
  accent: string;
  bgAccent: string;
}) {
  return (
    <div className={`${bgAccent} rounded-lg p-3 flex flex-col gap-1`}>
      <div className="flex items-center gap-1.5">
        <span className={accent}>{icon}</span>
        <span className={`text-xl font-bold ${accent} tabular-nums`}>{value}</span>
        {total !== undefined && <span className="text-xs text-muted-foreground">/ {total}</span>}
      </div>
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
