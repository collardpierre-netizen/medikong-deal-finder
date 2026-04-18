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

type ImportLine = {
  ean?: string;
  cnk?: string;
  quantity: number;
  currentPrice: number;
};

type MatchedLine = ImportLine & {
  productId?: string;
  productName?: string;
  productImage?: string;
  mediPrice?: number;
  offerId?: string;
  vendorName?: string;
  status: "found" | "unavailable";
  saving?: number;
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
  return (line.saving || 0) > 0 ? "Dispo - moins cher" : "Dispo - plus cher";
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
      .select("id, product_id, price_excl_vat, vendors(name, company_name)")
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

  return bestOfferByProduct;
};

const queryMatchImportLines = async (payload: ImportPayloadLine[]) => {
  const eans = [...new Set(payload.map((line) => line.ean).filter(Boolean))] as string[];
  const cnks = [...new Set(payload.map((line) => line.cnk).filter(Boolean))] as string[];

  const [productsByEanResult, productsByCnkResult] = await Promise.all([
    eans.length > 0
      ? supabase
          .from("products")
          .select("id, name, image_url, gtin, cnk_code")
          .in("gtin", eans)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    cnks.length > 0
      ? supabase
          .from("products")
          .select("id, name, image_url, gtin, cnk_code")
          .in("cnk_code", cnks)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsByEanResult.error) throw productsByEanResult.error;
  if (productsByCnkResult.error) throw productsByCnkResult.error;

  const productByEan = new Map<string, any>();
  const productByCnk = new Map<string, any>();

  for (const product of [...(productsByEanResult.data || []), ...(productsByCnkResult.data || [])]) {
    if (product.gtin && !productByEan.has(product.gtin)) productByEan.set(product.gtin, product);
    if (product.cnk_code && !productByCnk.has(product.cnk_code)) productByCnk.set(product.cnk_code, product);
  }

  const productIds = [
    ...new Set(
      payload
        .map((line) => {
          const product = (line.ean ? productByEan.get(line.ean) : undefined) || (line.cnk ? productByCnk.get(line.cnk) : undefined);
          return product?.id;
        })
        .filter(Boolean),
    ),
  ] as string[];

  const bestOfferByProduct = productIds.length > 0 ? await fetchBestOffers(productIds) : new Map<string, any>();

  return payload.map(({ index, ean, cnk, quantity, currentPrice }) => {
    const product = (ean ? productByEan.get(ean) : undefined) || (cnk ? productByCnk.get(cnk) : undefined);
    const offer = product ? bestOfferByProduct.get(product.id) : undefined;
    const mediPrice = offer?.price_excl_vat != null ? Number(offer.price_excl_vat) : undefined;
    const vendor = offer?.vendors as { company_name?: string | null; name?: string | null } | null | undefined;

    return {
      lineIndex: index,
      result: {
        ean: ean ?? undefined,
        cnk: cnk ?? undefined,
        quantity,
        currentPrice,
        productId: product?.id,
        productName: product?.name ?? undefined,
        productImage: product?.image_url ?? undefined,
        mediPrice,
        offerId: offer?.id ?? undefined,
        vendorName: vendor?.company_name || vendor?.name || "—",
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
  }, []);

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

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

      const lines: ImportLine[] = rows.map((r: any) => ({
        ean: cleanCode(r["EAN (ou CNK)"] ?? r["EAN"] ?? r["ean"]),
        cnk: cleanCode(r["CNK (optionnel)"] ?? r["CNK"] ?? r["cnk"]),
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
      })).filter(l => l.ean || l.cnk);

      if (lines.length === 0) {
        toast.error("Aucune ligne valide trouvée dans le fichier");
        setPhase("instructions");
        return;
      }

      setProgress({ current: 0, total: lines.length, startTime: Date.now() });
      await waitForUiPaint();

      const payload: ImportPayloadLine[] = lines.map((line, index) => ({
        index,
        ean: line.ean ?? null,
        cnk: line.cnk ?? null,
        quantity: line.quantity,
        currentPrice: line.currentPrice,
      }));

      const matchedByIndex: MatchedLine[] = new Array(lines.length);

      if (lines.length <= CHUNK_SIZE) {
        const data = await queryMatchImportLines(payload);
        data.forEach((row) => {
          matchedByIndex[row.lineIndex] = row.result;
        });
        setProgress((p) => ({ ...p, current: lines.length }));
      } else {
        const chunks = [] as typeof payload[];
        for (let start = 0; start < payload.length; start += CHUNK_SIZE) {
          chunks.push(payload.slice(start, start + CHUNK_SIZE));
        }

        let processedLines = 0;

        for (const chunk of chunks) {
          const data = await queryMatchImportLines(chunk);
          data.forEach((row) => {
              matchedByIndex[row.lineIndex] = row.result;
          });
          processedLines += chunk.length;
          setProgress((p) => ({ ...p, current: Math.min(processedLines, lines.length) }));
          await waitForUiPaint();
        }
      }

      const finalResults = matchedByIndex.filter(Boolean);
      setResults(finalResults);
      // Auto-select all found items with savings
      const autoSelected = new Set<number>();
      finalResults.forEach((r, i) => {
        if (r.status === "found" && (r.saving || 0) > 0) autoSelected.add(i);
      });
      setSelected(autoSelected);
      setPhase("results");

      // Persist matched lines to user account (upsert: update price, never delete others)
      if (saveToAccount && user) {
        const toUpsert = finalResults
          .filter((r) => r.status === "found" && r.productId && r.currentPrice > 0)
          .map((r) => ({
            user_id: user.id,
            product_id: r.productId!,
            my_purchase_price: r.currentPrice,
            updated_at: new Date().toISOString(),
          }));
        if (toUpsert.length > 0) {
          const { error } = await supabase
            .from("user_prices")
            .upsert(toUpsert, { onConflict: "user_id,product_id" });
          if (error) {
            console.error("Save to account failed:", error);
            toast.error("Impossible d'enregistrer dans votre compte");
          } else {
            setSavedCount(toUpsert.length);
            toast.success(`${toUpsert.length} prix enregistré(s) dans Mes Prix`);
          }
        }
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

  const exportRows = useMemo(() => {
    return filteredResults.map((r) => {
      const deltaPct = calcDeltaPct(r.currentPrice, r.mediPrice);
      const deltaAmount = getDeltaAmount(r);

      return {
        Produit: r.productName || "Non trouvé",
        EAN: r.ean || "",
        CNK: r.cnk || "",
        "Qté": r.quantity,
        "Votre prix HT": r.currentPrice > 0 ? Number(r.currentPrice.toFixed(2)) : null,
        "Prix MediKong HT": r.mediPrice != null ? Number(r.mediPrice.toFixed(2)) : null,
        "Δ €": deltaAmount,
        "Δ %": deltaPct != null ? Number(deltaPct.toFixed(1)) : null,
        Statut: getResultStatusLabel(r),
      };
    });
  }, [filteredResults]);

  const exportSummary = useMemo(() => {
    const exportFound = filteredResults.filter((r) => r.status === "found").length;
    const exportUnavailable = filteredResults.filter((r) => r.status === "unavailable").length;
    const exportSavings = filteredResults.filter((r) => r.status === "found" && (r.saving || 0) > 0);
    const exportMoreExpensive = filteredResults.filter((r) => r.status === "found" && (!r.saving || r.saving <= 0)).length;
    const exportSavingsAmount = exportSavings.reduce((acc, r) => acc + (r.saving || 0) * r.quantity, 0);

    return {
      label: getFilterLabel(filter),
      exportedLines: filteredResults.length,
      found: exportFound,
      unavailable: exportUnavailable,
      savings: exportSavings.length,
      moreExpensive: exportMoreExpensive,
      totalSavings: exportSavingsAmount,
    };
  }, [filteredResults, filter]);

  const exportXlsx = useCallback(() => {
    if (exportRows.length === 0) {
      toast.error("Aucune ligne à exporter");
      return;
    }

    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["Analyse comparateur de prix MediKong"],
      [],
      ["Filtre actif", exportSummary.label],
      ["Lignes exportées", exportSummary.exportedLines],
      ["Produits trouvés", exportSummary.found],
      ["Indisponibles", exportSummary.unavailable],
      ["Moins chers", exportSummary.savings],
      ["Plus chers", exportSummary.moreExpensive],
      ["Économie potentielle", Number(exportSummary.totalSavings.toFixed(2))],
      ["Exporté le", new Date().toLocaleString("fr-FR")],
    ]);
    summarySheet["!cols"] = [{ wch: 24 }, { wch: 18 }];

    const detailsSheet = XLSX.utils.json_to_sheet(exportRows);
    detailsSheet["!cols"] = [
      { wch: 38 },
      { wch: 18 },
      { wch: 14 },
      { wch: 8 },
      { wch: 16 },
      { wch: 18 },
      { wch: 10 },
      { wch: 10 },
      { wch: 20 },
    ];

    XLSX.utils.book_append_sheet(wb, summarySheet, "Résumé");
    XLSX.utils.book_append_sheet(wb, detailsSheet, "Analyse");

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `comparateur-medikong-${filter}-${date}.xlsx`);
    toast.success("Export XLS téléchargé");
  }, [exportRows, exportSummary, filter]);

  const exportPdf = useCallback(() => {
    if (exportRows.length === 0) {
      toast.error("Aucune ligne à exporter");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const generatedAt = new Date().toLocaleString("fr-FR");

    doc.setFontSize(18);
    doc.text("Analyse comparateur de prix MediKong", 40, 42);
    doc.setFontSize(10);
    doc.text(`Filtre : ${exportSummary.label}`, 40, 62);
    doc.text(`Lignes exportées : ${exportSummary.exportedLines}`, 180, 62);
    doc.text(`Trouvés : ${exportSummary.found}`, 320, 62);
    doc.text(`Indispo : ${exportSummary.unavailable}`, 420, 62);
    doc.text(`Moins chers : ${exportSummary.savings}`, 510, 62);
    doc.text(`Plus chers : ${exportSummary.moreExpensive}`, 620, 62);
    doc.text(`Économie potentielle : ${formatPrice(exportSummary.totalSavings)}`, 40, 78);
    doc.text(`Exporté le ${generatedAt}`, 260, 78);

    autoTable(doc, {
      startY: 96,
      head: [["Produit", "EAN/CNK", "Qté", "Votre prix", "Prix MediKong", "Δ €", "Δ %", "Statut"]],
      body: filteredResults.map((r) => {
        const deltaPct = calcDeltaPct(r.currentPrice, r.mediPrice);
        const deltaAmount = getDeltaAmount(r);

        return [
          r.productName || "Non trouvé",
          [r.ean ? `EAN: ${r.ean}` : null, r.cnk ? `CNK: ${r.cnk}` : null].filter(Boolean).join(" · ") || "—",
          String(r.quantity),
          r.currentPrice > 0 ? formatPrice(r.currentPrice) : "—",
          r.mediPrice != null ? formatPrice(r.mediPrice) : "—",
          deltaAmount != null ? `${deltaAmount > 0 ? "+" : ""}${formatPrice(Math.abs(deltaAmount)).replace("€", "").trim()}` : "—",
          deltaPct != null ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : "—",
          getResultStatusLabel(r),
        ];
      }),
      styles: { fontSize: 9, cellPadding: 6, textColor: [31, 41, 55] },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 210 },
        1: { cellWidth: 110 },
        2: { halign: "center", cellWidth: 40 },
        3: { halign: "right", cellWidth: 70 },
        4: { halign: "right", cellWidth: 85 },
        5: { halign: "right", cellWidth: 55 },
        6: { halign: "right", cellWidth: 55 },
        7: { cellWidth: 90 },
      },
      didParseCell: (hookData) => {
        if (hookData.section !== "body") return;
        const row = filteredResults[hookData.row.index];
        if (!row) return;

        if (row.status === "unavailable") {
          hookData.cell.styles.fillColor = [255, 247, 237];
        } else if ((row.saving || 0) > 0) {
          hookData.cell.styles.fillColor = [236, 253, 245];
        } else {
          hookData.cell.styles.fillColor = [254, 242, 242];
        }
      },
    });

    doc.save(`comparateur-medikong-${filter}-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Export PDF téléchargé");
  }, [exportRows, exportSummary, filteredResults, filter]);

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

          {/* Loading */}
          {phase === "loading" && <LoadingBar progress={progress} />}

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
                            <td className="p-2 max-w-[200px]">
                              {r.status === "found" ? (
                                <div>
                                  <p className="font-medium text-foreground text-xs line-clamp-1">{r.productName}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {r.ean && `EAN: ${r.ean}`}{r.ean && r.cnk && " · "}{r.cnk && `CNK: ${r.cnk}`}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <p className="font-medium text-destructive text-xs">Non trouvé</p>
                                  <p className="text-[10px] text-destructive/70 truncate">
                                    {r.ean && `EAN: ${r.ean}`}{r.ean && r.cnk && " · "}{r.cnk && `CNK: ${r.cnk}`}
                                  </p>
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
