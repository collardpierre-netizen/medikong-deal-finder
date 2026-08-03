import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Upload, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ---------- Colonnes reconnues (aliases FR/EN, insensibles casse/accents) ---------- */

const norm = (s: string) =>
  s.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const FIELD_ALIASES: Record<string, string[]> = {
  ean: ["ean", "ean13", "gtin", "code_barre", "code_barres", "barcode"],
  cnk: ["cnk", "cnk_code", "code_cnk", "apb"],
  designation: ["designation", "nom", "produit", "libelle", "description", "name", "product"],
  quantity: ["quantity", "quantite", "qte", "qty", "stock"],
  price_ht: ["price_ht", "prix_ht", "prix_htva", "prix_unitaire_ht", "unit_price_ht", "prix"],
  vat_rate: ["vat_rate", "tva", "taux_tva", "vat"],
  dlu: ["dlu", "date_peremption", "peremption", "expiry", "expiry_date", "exp"],
  lot_number: ["lot_number", "lot", "numero_lot", "batch"],
  product_state: ["product_state", "etat", "etat_produit", "state"],
  grade: ["grade", "qualite"],
  delivery_condition: ["delivery_condition", "livraison", "condition_livraison", "delivery"],
  allow_partial: ["allow_partial", "vente_partielle", "partiel", "partial"],
  moq: ["moq", "quantite_minimum", "min_qty", "minimum"],
  lot_size: ["lot_size", "taille_lot", "increment"],
  pieces_per_pack: ["pieces_per_pack", "pieces_par_pack", "unites_par_pack"],
  packs_per_box: ["packs_per_box", "packs_par_carton", "packs_par_box"],
  boxes_per_pallet: ["boxes_per_pallet", "cartons_par_palette", "boxes_par_palette"],
  unit_weight_g: ["unit_weight_g", "poids_unitaire_g", "poids_g", "poids"],
  seller_city: ["seller_city", "ville", "city"],
  seller_postal_code: ["seller_postal_code", "code_postal", "cp", "postal_code"],
  seller_province: ["seller_province", "province", "region"],
  photo_url: ["photo_url", "photo", "image", "image_url", "product_image_url"],
};

const HEADER_MAP: Record<string, string> = {};
for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const a of aliases) HEADER_MAP[a] = field;
}

const STATE_MAP: Record<string, string> = {
  intact: "intact", neuf: "intact", ok: "intact",
  damaged_packaging: "damaged_packaging", emballage_abime: "damaged_packaging", abime: "damaged_packaging",
  near_expiry: "near_expiry", proche_peremption: "near_expiry", courte_dlu: "near_expiry",
};

const DELIVERY_MAP: Record<string, string> = {
  both: "both", les_deux: "both", tous: "both",
  pickup: "pickup", enlevement: "pickup", retrait: "pickup",
  shipping: "shipping", livraison: "shipping", expedition: "shipping",
};

/* ---------- Parsing helpers ---------- */

const toNum = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const toBool = (v: any): boolean => {
  const s = String(v ?? "").trim().toLowerCase();
  return ["1", "true", "vrai", "oui", "yes", "y", "x"].includes(s);
};

const toDate = (v: any): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/); // MM/YYYY → fin de mois
  if (m) {
    const last = new Date(Number(m[2]), Number(m[1]), 0).getDate();
    return `${m[2]}-${m[1].padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  }
  return null;
};

type ParsedRow = {
  line: number;
  values: Record<string, any>;
  errors: string[];
  warnings: string[];
};

function buildRow(raw: Record<string, any>, line: number): ParsedRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const g = (f: string) => raw[f];

  const designation = String(g("designation") ?? "").trim();
  const quantity = toNum(g("quantity"));
  const price_ht = toNum(g("price_ht"));
  const ean = g("ean") ? String(g("ean")).replace(/\D/g, "") : null;
  const cnk = g("cnk") ? String(g("cnk")).replace(/\D/g, "") : null;

  if (!designation) errors.push("Désignation manquante");
  if (!ean && !cnk) warnings.push("Ni EAN ni CNK — l'offre ne sera pas rattachée au catalogue");
  if (ean && ean.length !== 13) warnings.push(`EAN «${ean}» n'a pas 13 chiffres`);
  if (quantity === null || quantity <= 0) errors.push("Quantité invalide (> 0 attendu)");
  if (price_ht === null || price_ht <= 0) errors.push("Prix HT invalide (> 0 attendu)");

  const vat = toNum(g("vat_rate"));
  const vat_rate = vat === null ? 21 : vat;
  if (![0, 6, 21].includes(vat_rate)) warnings.push(`TVA inhabituelle (${vat_rate}%)`);

  const dluRaw = g("dlu");
  const dlu = toDate(dluRaw);
  if (dluRaw && !dlu) warnings.push("DLU illisible — ignorée");

  const state = STATE_MAP[norm(String(g("product_state") ?? "intact"))] ?? null;
  if (g("product_state") && !state) warnings.push("État produit inconnu → intact");

  const deliv = DELIVERY_MAP[norm(String(g("delivery_condition") ?? "both"))] ?? null;
  if (g("delivery_condition") && !deliv) warnings.push("Condition de livraison inconnue → both");

  const gradeRaw = String(g("grade") ?? "A").trim().toUpperCase();
  const grade = ["A", "B", "C", "D"].includes(gradeRaw) ? gradeRaw : "A";
  if (g("grade") && grade !== gradeRaw) warnings.push("Grade inconnu → A");

  const moq = toNum(g("moq"));
  const lot_size = toNum(g("lot_size"));

  const values: Record<string, any> = {
    ean: ean || null,
    cnk: cnk || null,
    designation,
    quantity: quantity ?? 1,
    price_ht: price_ht ?? 0,
    vat_rate,
    dlu,
    lot_number: g("lot_number") ? String(g("lot_number")).trim() : null,
    product_state: state ?? "intact",
    delivery_condition: deliv ?? "both",
    grade,
    allow_partial: toBool(g("allow_partial")),
    moq: moq && moq >= 1 ? Math.round(moq) : 1,
    lot_size: lot_size && lot_size >= 1 ? Math.round(lot_size) : 1,
    seller_city: g("seller_city") ? String(g("seller_city")).trim() : null,
    seller_postal_code: g("seller_postal_code") ? String(g("seller_postal_code")).trim() : null,
    seller_province: g("seller_province") ? String(g("seller_province")).trim() : null,
  };

  for (const f of ["pieces_per_pack", "packs_per_box", "boxes_per_pallet", "unit_weight_g"]) {
    const n = toNum(g(f));
    if (n && n > 0) values[f] = Math.round(n);
  }
  const photo = g("photo_url") ? String(g("photo_url")).trim() : null;
  if (photo) {
    values.photo_url = photo;
    values.photos = [photo];
  }

  if (values.moq > values.quantity) warnings.push("MOQ > quantité");

  return { line, values, errors, warnings };
}

export function downloadRestockTemplate() {
  const sample = [
    {
      EAN: "5412345678901", CNK: "1234567", Designation: "Exemple crème hydratante 50 ml",
      Quantite: 120, "Prix HT": 8.45, TVA: 21, DLU: "31/12/2026", Lot: "L2026A",
      Etat: "intact", Grade: "A", Livraison: "both", "Vente partielle": "oui",
      MOQ: 12, "Taille lot": 6, "Pieces par pack": 1, "Packs par carton": 12,
      "Cartons par palette": 40, "Poids unitaire g": 90,
      Ville: "Bruxelles", "Code postal": "1000", Province: "Bruxelles",
      "Photo URL": "",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  ws["!cols"] = Object.keys(sample[0]).map(() => ({ wch: 20 }));
  const guide = XLSX.utils.aoa_to_sheet([
    ["Guide d'import ReStock"],
    [""],
    ["Colonnes obligatoires", "Designation, Quantite, Prix HT"],
    ["Recommandé", "EAN (13 chiffres) ou CNK — permet le rattachement au catalogue MediKong"],
    ["TVA", "6 (médicaments) ou 21 (OTC / parapharmacie). Défaut : 21"],
    ["DLU", "Formats acceptés : 31/12/2026, 2026-12-31, 12/2026 (= fin de mois)"],
    ["Etat", "intact | damaged_packaging | near_expiry (ou emballage_abime, proche_peremption)"],
    ["Grade", "A | B | C | D"],
    ["Livraison", "both | pickup | shipping (ou les_deux, enlevement, livraison)"],
    ["Vente partielle", "oui/non — si oui, renseignez MOQ et Taille lot"],
    ["Doublons", "Une ligne déjà présente (même EAN/CNK + même prix + même DLU) est ignorée"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Offres");
  XLSX.utils.book_append_sheet(wb, guide, "Guide");
  XLSX.writeFile(wb, "template-import-offres-restock.xlsx");
}

/* ---------- Composant ---------- */

type Props = { children?: React.ReactNode; defaultSellerId?: string };

export function RestockOffersBulkImport({ children, defaultSellerId }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [publishNow, setPublishNow] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [sellerId, setSellerId] = useState<string>(defaultSellerId ?? "");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ inserted: number; skipped: number } | null>(null);

  const { data: sellers = [] } = useQuery({
    queryKey: ["restock-sellers-for-import"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restock_buyers")
        .select("id, pharmacy_name, city, verified_status")
        .order("pharmacy_name");
      return data ?? [];
    },
    enabled: open && isAdmin,
  });

  const effectiveSellerId = sellerId || user?.id || "";

  const valid = useMemo(() => (rows ?? []).filter((r) => r.errors.length === 0), [rows]);
  const invalid = useMemo(() => (rows ?? []).filter((r) => r.errors.length > 0), [rows]);
  const warned = useMemo(() => valid.filter((r) => r.warnings.length > 0), [valid]);

  const reset = () => { setRows(null); setFileName(null); setDone(null); };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast({ title: "Format invalide", description: "XLSX, XLS ou CSV attendu", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Fichier trop volumineux", description: "10 Mo maximum", variant: "destructive" });
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });
      if (raw.length === 0) throw new Error("Aucune ligne détectée dans la première feuille");
      if (raw.length > 5000) throw new Error("5 000 lignes maximum par import");

      const parsed = raw.map((r, i) => {
        const mapped: Record<string, any> = {};
        for (const [k, v] of Object.entries(r)) {
          const field = HEADER_MAP[norm(k)];
          if (field && (mapped[field] === undefined || mapped[field] === "")) mapped[field] = v;
        }
        return buildRow(mapped, i + 2);
      }).filter((r) => Object.values(r.values).some((v) => v !== null && v !== "" && v !== undefined) && r.values.designation !== "" || r.errors.length > 0);

      setFileName(file.name);
      setDone(null);
      setRows(parsed);
    } catch (err: any) {
      toast({ title: "Lecture impossible", description: err?.message ?? "Fichier illisible", variant: "destructive" });
    }
  };

  const runImport = async () => {
    if (!effectiveSellerId) {
      toast({ title: "Vendeur manquant", description: "Sélectionnez le vendeur ReStock.", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      let candidates = valid.map((r) => r.values);

      let skipped = 0;
      if (skipDuplicates) {
        const { data: existing } = await supabase
          .from("restock_offers")
          .select("ean, cnk, price_ht, dlu, designation")
          .eq("seller_id", effectiveSellerId)
          .in("status", ["draft", "published", "counter_offer"]);
        const key = (o: any) =>
          [o.ean ?? "", o.cnk ?? "", o.ean || o.cnk ? "" : String(o.designation ?? "").toLowerCase(), Number(o.price_ht).toFixed(2), o.dlu ?? ""].join("|");
        const seen = new Set((existing ?? []).map(key));
        const kept: any[] = [];
        for (const c of candidates) {
          const k = key(c);
          if (seen.has(k)) { skipped++; continue; }
          seen.add(k);
          kept.push(c);
        }
        candidates = kept;
      }

      const payload = candidates.map((v) => ({
        ...v,
        seller_id: effectiveSellerId,
        status: publishNow ? "published" : "draft",
      }));

      let inserted = 0;
      for (let i = 0; i < payload.length; i += 200) {
        const chunk = payload.slice(i, i + 200);
        const { error, data } = await supabase.from("restock_offers").insert(chunk as any).select("id");
        if (error) throw error;
        inserted += data?.length ?? chunk.length;
      }

      setDone({ inserted, skipped });
      qc.invalidateQueries({ queryKey: ["restock-seller-offers"] });
      qc.invalidateQueries({ queryKey: ["restock-admin-offers"] });
      toast({
        title: "Import terminé",
        description: `${inserted} offre(s) créée(s)${skipped ? `, ${skipped} doublon(s) ignoré(s)` : ""}`,
      });
    } catch (err: any) {
      toast({ title: "Échec de l'import", description: err?.message ?? "Erreur inconnue", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline" className="gap-1 rounded-lg border-[#D0D5DC] text-[#5C6470] text-xs">
            <FileSpreadsheet size={14} /> Import en lots
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer des offres ReStock en lots</DialogTitle>
          <DialogDescription>
            Fichier XLSX ou CSV. Colonnes minimales : <strong>Designation</strong>, <strong>Quantite</strong>,{" "}
            <strong>Prix HT</strong>. Ajoutez EAN ou CNK pour rattacher l'offre au catalogue MediKong.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={downloadRestockTemplate}>
              <Download className="h-4 w-4" /> Modèle XLSX
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={onPick}
            />
            <Button size="sm" className="gap-2" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4" /> Choisir un fichier
            </Button>
            {fileName && <span className="text-xs text-muted-foreground truncate max-w-[220px]">📄 {fileName}</span>}
          </div>

          {isAdmin && (
            <div className="space-y-1">
              <Label className="text-xs">Vendeur ReStock</Label>
              <Select value={sellerId} onValueChange={setSellerId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Sélectionner un vendeur (ex. Destock Pharma)" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.pharmacy_name}{s.city ? ` — ${s.city}` : ""}
                      {s.verified_status !== "verified" ? " (non vérifié)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="rs-publish" checked={publishNow} onCheckedChange={(v) => setPublishNow(!!v)} />
              <Label htmlFor="rs-publish" className="text-xs">Publier directement (sinon brouillon)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="rs-dedupe" checked={skipDuplicates} onCheckedChange={(v) => setSkipDuplicates(!!v)} />
              <Label htmlFor="rs-dedupe" className="text-xs">Ignorer les doublons (EAN/CNK + prix + DLU)</Label>
            </div>
          </div>

          {rows && (
            <div className="rounded-lg border p-3 text-[12px] space-y-2 bg-muted/30">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>Lignes lues : <strong>{rows.length}</strong></span>
                <span className="text-emerald-700">✓ Valides : <strong>{valid.length}</strong></span>
                <span className="text-red-700">✗ En erreur : <strong>{invalid.length}</strong></span>
                <span className="text-amber-700">⚠ Avertissements : <strong>{warned.length}</strong></span>
              </div>

              {invalid.length > 0 && (
                <details open>
                  <summary className="cursor-pointer text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {invalid.length} ligne(s) ignorée(s)
                  </summary>
                  <ul className="mt-1 max-h-32 overflow-auto pl-4 list-disc">
                    {invalid.slice(0, 50).map((r) => (
                      <li key={r.line}>Ligne {r.line} : {r.errors.join(" · ")}</li>
                    ))}
                  </ul>
                </details>
              )}

              {warned.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-amber-700">{warned.length} avertissement(s)</summary>
                  <ul className="mt-1 max-h-32 overflow-auto pl-4 list-disc">
                    {warned.slice(0, 50).map((r) => (
                      <li key={r.line}>Ligne {r.line} : {r.warnings.join(" · ")}</li>
                    ))}
                  </ul>
                </details>
              )}

              {valid.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-2">Produit</th>
                        <th className="py-1 pr-2">EAN/CNK</th>
                        <th className="py-1 pr-2 text-right">Qté</th>
                        <th className="py-1 pr-2 text-right">Prix HT</th>
                        <th className="py-1 pr-2">DLU</th>
                        <th className="py-1">État</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valid.slice(0, 8).map((r) => (
                        <tr key={r.line} className="border-t">
                          <td className="py-1 pr-2 truncate max-w-[180px]">{r.values.designation}</td>
                          <td className="py-1 pr-2">{r.values.ean ?? r.values.cnk ?? "—"}</td>
                          <td className="py-1 pr-2 text-right">{r.values.quantity}</td>
                          <td className="py-1 pr-2 text-right">{Number(r.values.price_ht).toFixed(2)} €</td>
                          <td className="py-1 pr-2">{r.values.dlu ?? "—"}</td>
                          <td className="py-1">{r.values.grade} · {r.values.product_state}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {valid.length > 8 && (
                    <p className="mt-1 text-muted-foreground">… et {valid.length - 8} autre(s) ligne(s)</p>
                  )}
                </div>
              )}
            </div>
          )}

          {done && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5" />
              <span>
                {done.inserted} offre(s) créée(s) en {publishNow ? "publiées" : "brouillon"}
                {done.skipped ? ` · ${done.skipped} doublon(s) ignoré(s)` : ""}.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>
          <Button onClick={runImport} disabled={importing || !rows || valid.length === 0 || !!done} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importer {valid.length > 0 ? `${valid.length} offre(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
