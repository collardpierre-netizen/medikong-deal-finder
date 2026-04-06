import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Download, FileSpreadsheet, ShoppingCart, X, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { formatPrice } from "@/data/mock";
import { useCart } from "@/hooks/useCart";
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

const CHUNK_SIZE = 250;
const MAX_CONCURRENT_CHUNKS = 4;
const SINGLE_REQUEST_LIMIT = 1000;

const waitForUiPaint = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const normalizeMatchedRow = (row: any) => ({
  lineIndex: Number(row.line_index || 0),
  result: {
    ean: row.ean ?? undefined,
    cnk: row.cnk ?? undefined,
    quantity: Number(row.quantity || 1),
    currentPrice: Number(row.current_price || 0),
    productId: row.product_id ?? undefined,
    productName: row.product_name ?? undefined,
    productImage: row.product_image ?? undefined,
    mediPrice: row.medi_price != null ? Number(row.medi_price) : undefined,
    offerId: row.offer_id ?? undefined,
    vendorName: row.vendor_name ?? undefined,
    status: row.status === "found" ? "found" : "unavailable",
    saving: row.saving != null ? Math.max(0, Number(row.saving)) : 0,
  } satisfies MatchedLine,
});

export function BuyerImportModal({ open, onOpenChange }: Props) {
  const [phase, setPhase] = useState<"instructions" | "loading" | "results">("instructions");
  const [results, setResults] = useState<MatchedLine[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState({ current: 0, total: 0, startTime: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const { addToCart } = useCart();

  const reset = useCallback(() => {
    setPhase("instructions");
    setResults([]);
    setSelected(new Set());
    setProgress({ current: 0, total: 0, startTime: 0 });
  }, []);

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const downloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/meditrade_template_import.xlsx";
    link.download = "meditrade_template_import.xlsx";
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

      const lines: ImportLine[] = rows.map((r: any) => {
        const eanRaw = String(r["EAN (ou CNK)"] || r["EAN"] || r["ean"] || "").trim();
        const cnkRaw = String(r["CNK (optionnel)"] || r["CNK"] || r["cnk"] || "").trim();
        return {
          ean: eanRaw && eanRaw !== "undefined" ? eanRaw : undefined,
          cnk: cnkRaw && cnkRaw !== "undefined" ? cnkRaw : undefined,
          quantity: Number(r["Quantité"] || r["quantity"] || r["Qty"] || 1),
          currentPrice: Number(r["Prix achat actuel (€ HT)"] || r["Prix"] || r["price"] || 0),
        };
      }).filter(l => l.ean || l.cnk);

      if (lines.length === 0) {
        toast.error("Aucune ligne valide trouvée dans le fichier");
        setPhase("instructions");
        return;
      }

      setProgress({ current: 0, total: lines.length, startTime: Date.now() });

      await waitForUiPaint();

      const payload = lines.map((line, index) => ({
        index,
        ean: line.ean ?? null,
        cnk: line.cnk ?? null,
        quantity: line.quantity,
        currentPrice: line.currentPrice,
      }));

      const matchedByIndex: MatchedLine[] = new Array(lines.length);

      if (lines.length <= SINGLE_REQUEST_LIMIT) {
        const { data, error } = await (supabase as any).rpc("match_import_lines", {
          _lines: payload,
        });

        if (error) throw error;

        ((data || []) as any[]).forEach((row) => {
          const { lineIndex, result } = normalizeMatchedRow(row);
          matchedByIndex[lineIndex] = result;
        });

        setProgress((p) => ({ ...p, current: lines.length }));
      } else {
        const chunks = [] as typeof payload[];
        for (let start = 0; start < payload.length; start += CHUNK_SIZE) {
          chunks.push(payload.slice(start, start + CHUNK_SIZE));
        }

        let nextChunkIndex = 0;
        let processedLines = 0;

        const runWorker = async () => {
          while (nextChunkIndex < chunks.length) {
            const currentChunkIndex = nextChunkIndex++;
            const chunk = chunks[currentChunkIndex];

            const { data, error } = await (supabase as any).rpc("match_import_lines", {
              _lines: chunk,
            });

            if (error) throw error;

            ((data || []) as any[]).forEach((row) => {
              const { lineIndex, result } = normalizeMatchedRow(row);
              matchedByIndex[lineIndex] = result;
            });

            processedLines += chunk.length;
            setProgress((p) => ({ ...p, current: Math.min(processedLines, lines.length) }));
            await waitForUiPaint();
          }
        };

        await Promise.all(
          Array.from({ length: Math.min(MAX_CONCURRENT_CHUNKS, chunks.length) }, () => runWorker())
        );
      }

      setResults(matchedByIndex.filter(Boolean));
      setPhase("results");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la lecture du fichier");
      setPhase("instructions");
    }
  };

  const foundLines = results.filter(r => r.status === "found");
  const unavailableLines = results.filter(r => r.status === "unavailable");
  const savingsLines = foundLines.filter(r => (r.saving || 0) > 0);
  const totalSavings = savingsLines.reduce((a, r) => a + (r.saving || 0) * r.quantity, 0);

  const toggleAll = () => {
    if (selected.size === foundLines.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((_, i) => i).filter(i => results[i].status === "found")));
    }
  };

  const selectSavings = () => {
    setSelected(new Set(results.map((_, i) => i).filter(i => results[i].status === "found" && (results[i].saving || 0) > 0)));
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
      <DialogContent className="max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet size={18} className="text-primary" />
            Importer votre liste de produits
          </DialogTitle>
        </DialogHeader>

        {/* Instructions */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm space-y-1">
          <p className="font-semibold text-primary">Comment ça marche ?</p>
          <ol className="list-decimal list-inside space-y-0.5 text-primary/80">
            <li>Téléchargez le template Excel ci-dessous</li>
            <li>Remplissez avec vos références (EAN ou CNK), quantités et prix d'achat actuels</li>
            <li>Importez le fichier pour voir les offres MediTrade disponibles</li>
            <li>Validez les lignes intéressantes pour les ajouter au panier</li>
          </ol>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
            <Download size={14} /> Télécharger le template
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5" disabled={phase === "loading"}>
            {phase === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Importer un fichier
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
        </div>

        {phase === "loading" && (() => {
          const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
          const elapsed = (Date.now() - progress.startTime) / 1000;
          const rate = progress.current > 0 ? elapsed / progress.current : 0;
          const remaining = progress.current > 0 ? Math.max(0, Math.round(rate * (progress.total - progress.current))) : null;
          return (
            <div className="py-6 space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Analyse de votre fichier…</span>
                <span>{progress.current}/{progress.total} lignes</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{pct}%</span>
                <span>{remaining === null ? "Estimation…" : `Temps restant ~${remaining}s`}</span>
              </div>
            </div>
          );
        })()}

        {phase === "results" && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-4 gap-2">
              <KpiBox value={foundLines.length} label="Produits trouvés" color="text-emerald-600" />
              <KpiBox value={unavailableLines.length} label="Non disponibles" color="text-red-500" />
              <KpiBox value={savingsLines.length} label="Économies possibles" color="text-emerald-600" />
              <KpiBox value={formatPrice(totalSavings)} label="Économie totale potentielle" color="text-emerald-600" />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={selectSavings}>Sélectionner les économies</Button>
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selected.size === foundLines.length ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            </div>

            {/* Results table */}
            <div className="border rounded-lg overflow-hidden max-h-[340px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 w-8"></th>
                    <th className="p-2 text-left font-medium text-muted-foreground">Produit</th>
                    <th className="p-2 text-center font-medium text-muted-foreground">Qté</th>
                    <th className="p-2 text-right font-medium text-muted-foreground">Votre prix</th>
                    <th className="p-2 text-right font-medium text-muted-foreground">Prix MediTrade</th>
                    <th className="p-2 text-right font-medium text-muted-foreground">Économie</th>
                    <th className="p-2 text-center font-medium text-muted-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-center">
                        {r.status === "found" && (
                          <Checkbox
                            checked={selected.has(i)}
                            onCheckedChange={(v) => {
                              const s = new Set(selected);
                              v ? s.add(i) : s.delete(i);
                              setSelected(s);
                            }}
                          />
                        )}
                      </td>
                      <td className="p-2">
                        {r.status === "found" ? (
                          <div>
                            <p className="font-medium text-foreground text-xs line-clamp-1">{r.productName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {r.ean && `EAN: ${r.ean}`}{r.ean && r.cnk && " · "}{r.cnk && `CNK: ${r.cnk}`}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium text-red-500 text-xs">Non trouvé</p>
                            <p className="text-[10px] text-red-400">
                              {r.cnk && `CNK: ${r.cnk}`}{r.cnk && r.ean && " "}{r.ean && `EAN: ${r.ean}`}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-center text-xs">{r.quantity}</td>
                      <td className="p-2 text-right text-xs">{r.currentPrice > 0 ? formatPrice(r.currentPrice) : "—"}</td>
                      <td className="p-2 text-right text-xs font-semibold">
                        {r.mediPrice ? formatPrice(r.mediPrice) : "—"}
                      </td>
                      <td className="p-2 text-right text-xs">
                        {r.saving && r.saving > 0 ? (
                          <span className="text-emerald-600 font-semibold">-{formatPrice(r.saving)}</span>
                        ) : "—"}
                      </td>
                      <td className="p-2 text-center">
                        {r.status === "found" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                            <CheckCircle2 size={10} /> Dispo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-50 rounded-full px-2 py-0.5">
                            <X size={10} /> Indispo
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">{selected.size} produit(s) sélectionné(s)</span>
              <Button size="sm" onClick={handleAddToCart} disabled={selected.size === 0} className="gap-1.5">
                <ShoppingCart size={14} /> Ajouter au panier
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KpiBox({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="border rounded-lg p-3 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
