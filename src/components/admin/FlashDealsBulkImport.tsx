import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileDown, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type ParsedRow = {
  line: number;
  identifier: string;
  vendorKey: string;
  discountPrice: number | null;
  publicPrice: number | null;
  quantity: number | null;
  startsAt: string | null;
  endsAt: string | null;
  label: string | null;
  productId?: string;
  productName?: string;
  vendorId?: string | null;
  vendorLabel?: string | null;
  offerId?: string | null;
  currentPrice?: number | null;
  error?: string;
};

const HEADER_ALIASES: Record<string, string> = {
  gtin: "identifier",
  ean: "identifier",
  cnk: "identifier",
  slug: "identifier",
  product_id: "identifier",
  produit: "identifier",
  identifiant: "identifier",
  vendeur: "vendor",
  fournisseur: "vendor",
  vendor: "vendor",
  vendor_id: "vendor",
  vendor_code: "vendor",
  code_vendeur: "vendor",
  prix_promo: "discount",
  prix_promo_ttc: "discount",
  discount_price: "discount",
  prix_public: "public",
  prix_public_ttc: "public",
  public_price: "public",
  pvp: "public",
  quantite: "quantity",
  quantité: "quantity",
  qty: "quantity",
  stock: "quantity",
  debut: "starts",
  début: "starts",
  date_debut: "starts",
  starts_at: "starts",
  fin: "ends",
  date_fin: "ends",
  ends_at: "ends",
  label: "label",
  libelle: "label",
  libellé: "label",
};

function normHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toIso(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  // dd/mm/yyyy [hh:mm]
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function FlashDealsBulkImport({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["gtin", "prix_promo_ttc", "prix_public_ttc", "quantite", "debut", "fin", "label"],
      ["5400000000001", "12,90", "19,90", "50", "18/08/2026 09:00", "20/08/2026 23:59", "Flash -35%"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "flash_deals");
    XLSX.writeFile(wb, "modele-flash-deals.xlsx");
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      const parsed: ParsedRow[] = raw.map((r, i) => {
        const mapped: Record<string, any> = {};
        for (const [k, v] of Object.entries(r)) {
          const key = HEADER_ALIASES[normHeader(k)];
          if (key && (mapped[key] === undefined || mapped[key] === "")) mapped[key] = v;
        }
        return {
          line: i + 2,
          identifier: String(mapped.identifier ?? "").trim(),
          discountPrice: toNumber(mapped.discount),
          publicPrice: toNumber(mapped.public),
          quantity: mapped.quantity === "" || mapped.quantity === undefined ? null : toNumber(mapped.quantity),
          startsAt: toIso(mapped.starts) ?? new Date().toISOString(),
          endsAt: toIso(mapped.ends),
          label: mapped.label ? String(mapped.label).trim() : "Flash",
        };
      });

      // Résolution produits (gtin, slug, id)
      const ids = parsed.map((p) => p.identifier).filter(Boolean);
      const { data: byGtin } = await supabase
        .from("products")
        .select("id, name, slug, gtin, best_price_incl_vat, reference_price, pvp_ttc_cents")
        .in("gtin", ids);
      const { data: bySlug } = await supabase
        .from("products")
        .select("id, name, slug, gtin, best_price_incl_vat, reference_price, pvp_ttc_cents")
        .in("slug", ids);

      const index = new Map<string, any>();
      for (const p of [...(byGtin ?? []), ...(bySlug ?? [])]) {
        if (p.gtin) index.set(String(p.gtin), p);
        if (p.slug) index.set(String(p.slug), p);
        index.set(String(p.id), p);
      }

      const resolved = parsed.map((r) => {
        if (!r.identifier) return { ...r, error: "Identifiant produit manquant" };
        const p = index.get(r.identifier);
        if (!p) return { ...r, error: "Produit introuvable (GTIN / slug / id)" };
        if (!r.discountPrice || r.discountPrice <= 0) return { ...r, productId: p.id, productName: p.name, error: "Prix promo invalide" };
        if (!r.endsAt) return { ...r, productId: p.id, productName: p.name, error: "Date de fin manquante" };
        if (r.quantity !== null && (!Number.isInteger(r.quantity) || r.quantity <= 0))
          return { ...r, productId: p.id, productName: p.name, error: "Quantité invalide" };
        return {
          ...r,
          productId: p.id,
          productName: p.name,
          currentPrice: p.best_price_incl_vat ?? p.reference_price ?? null,
          publicPrice: r.publicPrice ?? (p.pvp_ttc_cents ? p.pvp_ttc_cents / 100 : null),
        };
      });

      setRows(resolved);
    } catch (e: any) {
      toast.error(`Lecture du fichier impossible : ${e.message}`);
      setRows([]);
    } finally {
      setParsing(false);
    }
  };

  const valid = rows.filter((r) => !r.error);
  const invalid = rows.filter((r) => r.error);

  const handleImport = async () => {
    if (valid.length === 0) return;
    setImporting(true);
    const payload = valid.map((r) => ({
      product_id: r.productId!,
      discount_price_incl_vat: r.discountPrice!,
      original_price_incl_vat: r.currentPrice ?? r.publicPrice ?? r.discountPrice!,
      public_price_incl_vat: r.publicPrice,
      quantity_total: r.quantity,
      starts_at: r.startsAt,
      ends_at: r.endsAt,
      label: r.label,
      is_active: true,
    }));
    const { error } = await supabase.from("flash_deals").insert(payload as any);
    setImporting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${payload.length} vente(s) flash importée(s)`);
    qc.invalidateQueries({ queryKey: ["flash-deals-admin"] });
    setRows([]);
    setFileName(null);
    onDone?.();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-border p-4 text-sm">
        <p className="font-medium mb-1">Colonnes attendues</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          <strong>gtin</strong> (ou slug / product_id), <strong>prix_promo_ttc</strong>, <strong>prix_public_ttc</strong> (facultatif — repris du PVP si vide),{" "}
          <strong>quantite</strong> (facultatif — vide = illimitée), <strong>debut</strong> (facultatif — maintenant si vide), <strong>fin</strong>, <strong>label</strong>.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileDown size={14} className="mr-1" /> Modèle XLSX
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
            />
            <span className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground cursor-pointer">
              {parsing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Choisir un fichier
            </span>
          </label>
          {fileName && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{fileName}</span>}
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex items-center gap-3 text-sm">
            <Badge className="bg-emerald-500 text-white gap-1"><CheckCircle2 size={12} /> {valid.length} valide(s)</Badge>
            {invalid.length > 0 && (
              <Badge variant="destructive" className="gap-1"><AlertTriangle size={12} /> {invalid.length} en erreur</Badge>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto border border-border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ligne</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Promo</TableHead>
                  <TableHead>Public</TableHead>
                  <TableHead>Écart</TableHead>
                  <TableHead>Qté</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const delta = r.publicPrice && r.discountPrice ? r.publicPrice - r.discountPrice : null;
                  const pct = delta && r.publicPrice ? Math.round((delta / r.publicPrice) * 100) : null;
                  return (
                    <TableRow key={r.line}>
                      <TableCell className="text-xs">{r.line}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{r.productName || r.identifier}</TableCell>
                      <TableCell className="text-xs">{r.discountPrice?.toFixed(2) ?? "—"} €</TableCell>
                      <TableCell className="text-xs">{r.publicPrice?.toFixed(2) ?? "—"} €</TableCell>
                      <TableCell className="text-xs">
                        {pct !== null ? `-${pct}% · ${delta!.toFixed(2)} €` : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{r.quantity ?? "∞"}</TableCell>
                      <TableCell className="text-xs">{r.endsAt ? new Date(r.endsAt).toLocaleString("fr-FR") : "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.error ? <span className="text-destructive">{r.error}</span> : <span className="text-emerald-600">OK</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRows([]); setFileName(null); }}>Réinitialiser</Button>
            <Button onClick={handleImport} disabled={importing || valid.length === 0}>
              {importing ? "Import…" : `Importer ${valid.length} vente(s) flash`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
