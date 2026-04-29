import { useMemo, useState } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  Plus, Loader2, Upload, FileSpreadsheet, Download, AlertTriangle,
  CheckCircle2, FileWarning, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isValidGtin, isValidCnk, normalizeDigits } from "@/lib/product-codes";
import { useCategorySuggestion } from "@/hooks/useCategorySuggestion";
import { Sparkles } from "lucide-react";
import { startImportJob } from "@/hooks/useImportJob";
import { ImportJobProgress } from "@/components/imports/ImportJobProgress";

const submissionSchema = z.object({
  product_name: z.string().trim().min(2, "Nom requis (min 2 caractères)").max(200, "Max 200 caractères"),
  brand_name: z.string().trim().max(120, "Max 120 caractères").optional().or(z.literal("")),
  manufacturer_name: z.string().trim().max(120, "Max 120 caractères").optional().or(z.literal("")),
  gtin: z.string().trim().max(14, "GTIN max 14 chiffres").regex(/^\d*$/, "Chiffres uniquement").optional().or(z.literal("")),
  cnk_code: z.string().trim().max(10, "CNK max 10 caractères").optional().or(z.literal("")),
  category_hint: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(1000, "Max 1000 caractères").optional().or(z.literal("")),
});

const FIELD_HEADERS = [
  "product_name", "brand_name", "manufacturer_name",
  "gtin", "cnk_code", "category_hint", "notes",
] as const;

type ImportRow = {
  index: number; // 1-based row number in the source file (header excluded)
  data: Record<string, string>;
  errors: string[];
};

const MAX_ROWS = 500;
const MAX_FILE_BYTES = 2_000_000; // 2 MB

function validateRow(raw: Record<string, string>): ImportRow["errors"] {
  const errors: string[] = [];
  const parsed = submissionSchema.safeParse({
    product_name: raw.product_name ?? "",
    brand_name: raw.brand_name ?? "",
    manufacturer_name: raw.manufacturer_name ?? "",
    gtin: raw.gtin ? normalizeDigits(raw.gtin) : "",
    cnk_code: raw.cnk_code ? normalizeDigits(raw.cnk_code) : "",
    category_hint: raw.category_hint ?? "",
    notes: raw.notes ?? "",
  });
  if (!parsed.success) {
    parsed.error.issues.forEach((iss) => errors.push(`${iss.path[0]}: ${iss.message}`));
    return errors;
  }
  if (parsed.data.gtin && !isValidGtin(parsed.data.gtin)) {
    errors.push("gtin: clé de contrôle invalide");
  }
  if (parsed.data.cnk_code && !isValidCnk(parsed.data.cnk_code)) {
    errors.push("cnk_code: 7 chiffres attendus");
  }
  return errors;
}

function normalizeHeader(h: string): string {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  const splitLine = (line: string): string[] => {
    const sep = line.includes(";") && !line.includes(",") ? ";" : ",";
    const out: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQ = !inQ; continue; }
      if (c === sep && !inQ) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

function buildRows(headers: string[], rawRows: string[][]): { rows: ImportRow[]; missingHeaders: string[] } {
  const norm = headers.map(normalizeHeader);
  const missingHeaders = ["product_name"].filter((h) => !norm.includes(h));
  if (missingHeaders.length > 0) return { rows: [], missingHeaders };

  const rows: ImportRow[] = [];
  for (let i = 0; i < rawRows.length && rows.length < MAX_ROWS; i++) {
    const cols = rawRows[i];
    const data: Record<string, string> = {};
    norm.forEach((h, idx) => {
      if ((FIELD_HEADERS as readonly string[]).includes(h)) {
        data[h] = String(cols[idx] ?? "").slice(0, 1000);
      }
    });
    rows.push({ index: i + 2, data, errors: validateRow(data) });
  }
  return { rows, missingHeaders };
}

const CSV_TEMPLATE =
  FIELD_HEADERS.join(",") +
  "\n" +
  `"Doliprane 1000mg comprimés","Sanofi","Sanofi Aventis","3400930000000","1234567","Antalgiques","16 comprimés"\n` +
  `"Nurofen 200mg 24cp","Reckitt","Reckitt Benckiser","5000158078123","1857423","AINS","Boîte 24 comprimés"\n`;

const COLUMN_GUIDE: Record<(typeof FIELD_HEADERS)[number], { label: string; required: boolean; help: string; example: string }> = {
  product_name:      { label: "Nom du produit",   required: true,  help: "2 à 200 caractères. Indiquez le dosage et le conditionnement.", example: "Doliprane 1000mg comprimés" },
  brand_name:        { label: "Marque",           required: false, help: "Marque commerciale (max 120 caractères).",                     example: "Sanofi" },
  manufacturer_name: { label: "Fabricant",        required: false, help: "Laboratoire / fabricant officiel (max 120 caractères).",      example: "Sanofi Aventis" },
  gtin:              { label: "GTIN / EAN",       required: false, help: "8, 12, 13 ou 14 chiffres. Clé de contrôle vérifiée.",         example: "3400930000000" },
  cnk_code:          { label: "CNK (Belgique)",   required: false, help: "7 chiffres exactement (code APB belge).",                     example: "1234567" },
  category_hint:     { label: "Catégorie",        required: false, help: "Suggestion libre, l'équipe catalogue valide le rattachement.", example: "Antalgiques" },
  notes:             { label: "Notes internes",   required: false, help: "Conditionnement, lien fournisseur, infos utiles (max 1000).",  example: "16 comprimés" },
};

function downloadBlob(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildXlsxTemplate(): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // ===== Feuille "Modèle" =====
  // Row 1 = clés techniques (lues par l'import). Les libellés FR sont en commentaires de cellule.
  const headerRow = FIELD_HEADERS.map((h) => h);
  const example1 = FIELD_HEADERS.map((h) => COLUMN_GUIDE[h].example);
  const example2 = ["Nurofen 200mg 24cp", "Reckitt", "Reckitt Benckiser", "5000158078123", "1857423", "AINS", "Boîte 24 comprimés"];
  const blank = FIELD_HEADERS.map(() => "");

  const aoa: any[][] = [headerRow, example1, example2, blank, blank, blank];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Forcer le format texte pour GTIN et CNK (évite la notation scientifique)
  const gtinCol = FIELD_HEADERS.indexOf("gtin");
  const cnkCol = FIELD_HEADERS.indexOf("cnk_code");
  for (let r = 1; r < aoa.length; r++) {
    [gtinCol, cnkCol].forEach((c) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (ws[ref]) { ws[ref].t = "s"; ws[ref].z = "@"; }
    });
  }

  // Largeurs de colonnes
  ws["!cols"] = [
    { wch: 38 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 30 },
  ];

  // Commentaires d'aide sur l'en-tête + libellé FR
  FIELD_HEADERS.forEach((h, idx) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: idx });
    const guide = COLUMN_GUIDE[h];
    if (ws[ref]) {
      (ws[ref] as any).c = [{
        a: "MediKong",
        t: `${guide.label}${guide.required ? " (OBLIGATOIRE)" : " (optionnel)"}\n${guide.help}\n\nExemple : ${guide.example}`,
      }];
    }
  });

  // Geler la 1re ligne (en-têtes)
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: FIELD_HEADERS.length - 1 } });

  XLSX.utils.book_append_sheet(wb, ws, "Modèle");

  // ===== Feuille "Guide" =====
  const guideAoa: any[][] = [
    ["Champ", "Clé technique", "Obligatoire", "Règles", "Exemple"],
    ...FIELD_HEADERS.map((h) => {
      const g = COLUMN_GUIDE[h];
      return [g.label, h, g.required ? "Oui" : "Non", g.help, g.example];
    }),
    [],
    ["Notes générales :"],
    ["• La 1re ligne du fichier doit contenir les clés techniques (product_name, gtin, etc.)."],
    ["• L'ordre des colonnes peut varier — les clés sont reconnues automatiquement."],
    ["• Maximum 500 lignes par fichier, taille max 2 Mo."],
    ["• GTIN : 8, 12, 13 ou 14 chiffres avec clé de contrôle valide."],
    ["• CNK : 7 chiffres exactement."],
    ["• Les lignes en erreur sont affichées dans l'aperçu et peuvent être réexportées en CSV."],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideAoa);
  wsGuide["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 60 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, "Guide");

  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}



export function ProductSubmissionDialog({ children }: { children?: React.ReactNode }) {
  const { data: vendor } = useCurrentVendor();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"form" | "csv">("form");

  const [form, setForm] = useState({
    product_name: "", brand_name: "", manufacturer_name: "",
    gtin: "", cnk_code: "", category_hint: "", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [fileName, setFileName] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [fileIssue, setFileIssue] = useState<string | null>(null);
  const [showRejectedOnly, setShowRejectedOnly] = useState(true);
  const [importJobId, setImportJobId] = useState<string | null>(null);

  const { suggestion: catSuggestion, loading: catSuggestionLoading } = useCategorySuggestion(form.gtin, form.cnk_code);

  const reset = () => {
    setForm({ product_name: "", brand_name: "", manufacturer_name: "", gtin: "", cnk_code: "", category_hint: "", notes: "" });
    setErrors({});
    setFileName(null); setImportRows([]); setFileIssue(null); setShowRejectedOnly(true);
    setImportJobId(null);
    setTab("form");
  };

  const formMutation = useMutation({
    mutationFn: async () => {
      if (!vendor?.id) throw new Error("Vendeur introuvable");
      const parsed = submissionSchema.safeParse(form);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
        setErrors(errs);
        throw new Error("invalid");
      }
      setErrors({});
      const payload = Object.fromEntries(
        Object.entries(parsed.data).filter(([, v]) => v && String(v).trim() !== "")
      );
      const { error } = await supabase.from("product_submissions").insert({
        vendor_id: vendor.id,
        proposed_payload: payload as any,
        status: "submitted",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Proposition envoyée", description: "Notre équipe catalogue va l'examiner." });
      qc.invalidateQueries({ queryKey: ["vendor-submissions"] });
      reset();
      setOpen(false);
    },
    onError: (err: any) => {
      if (err?.message === "invalid") return;
      toast({ title: "Erreur", description: err?.message ?? "Envoi impossible", variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!vendor?.id) throw new Error("Vendeur introuvable");
      const valid = importRows.filter((r) => r.errors.length === 0);
      if (valid.length === 0) throw new Error("Aucune ligne valide à importer");

      const jobRows = valid.map((r) => ({
        index: r.index,
        data: Object.fromEntries(
          Object.entries(r.data).filter(([, v]) => v && String(v).trim() !== "")
        ),
        errors: [],
      }));

      const newJobId = await startImportJob({
        jobType: "product_submission",
        fileName: fileName ?? undefined,
        rows: jobRows,
        metadata: { vendor_id: vendor.id },
      });
      setImportJobId(newJobId);
      return valid.length;
    },
    onError: (err: any) => {
      toast({ title: "Erreur d'import", description: err?.message ?? "Import impossible", variant: "destructive" });
    },
  });

  const handleJobCompleted = () => {
    toast({
      title: "Import terminé",
      description: "Suivez l'avancement dans « Mes propositions ».",
    });
    qc.invalidateQueries({ queryKey: ["vendor-submissions"] });
    reset();
    setOpen(false);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleFile = async (file: File) => {
    setFileIssue(null);
    setImportRows([]);
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) { setFileIssue("Fichier trop volumineux (max 2 Mo)."); return; }

    let headers: string[] = [];
    let rawRows: string[][] = [];
    try {
      const isXlsx = /\.(xlsx|xls)$/i.test(file.name);
      if (isXlsx) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: "" });
        if (aoa.length === 0) { setFileIssue("Aucune ligne détectée dans la feuille."); return; }
        headers = (aoa[0] as any[]).map((c) => String(c ?? ""));
        rawRows = aoa.slice(1).map((row) => (row as any[]).map((c) => String(c ?? "")));
      } else {
        const text = await file.text();
        const parsed = parseCsvText(text);
        headers = parsed.headers;
        rawRows = parsed.rows;
      }
    } catch (e: any) {
      setFileIssue("Impossible de lire le fichier (format invalide).");
      return;
    }

    const { rows, missingHeaders } = buildRows(headers, rawRows);
    if (missingHeaders.length > 0) {
      setFileIssue(`En-tête manquant : ${missingHeaders.join(", ")}. La colonne « product_name » est requise.`);
      return;
    }
    if (rows.length === 0) { setFileIssue("Aucune ligne détectée dans le fichier."); return; }
    setImportRows(rows);
  };

  const downloadTemplate = () => {
    downloadBlob("modele-propositions-produits.csv", CSV_TEMPLATE, "text/csv");
  };

  const downloadXlsxTemplate = () => {
    const buffer = buildXlsxTemplate();
    downloadBlob(
      "modele-propositions-produits.xlsx",
      buffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  };

  const validCount = importRows.filter((r) => r.errors.length === 0).length;
  const rejected = useMemo(() => importRows.filter((r) => r.errors.length > 0), [importRows]);
  const errorCount = rejected.length;

  const downloadErrorsCsv = () => {
    if (rejected.length === 0) return;
    const headers = ["row", "errors", ...FIELD_HEADERS];
    const escape = (v: string) => {
      const s = String(v ?? "");
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    rejected.forEach((r) => {
      const cells = [
        String(r.index),
        r.errors.join(" | "),
        ...FIELD_HEADERS.map((h) => r.data[h] ?? ""),
      ];
      lines.push(cells.map(escape).join(","));
    });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(`erreurs-import-${stamp}.csv`, lines.join("\n"), "text/csv");
  };

  const visibleRows = showRejectedOnly ? rejected : importRows;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline" className="gap-1">
            <Plus className="h-4 w-4" /> Proposer une référence
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Proposer une ou plusieurs références</DialogTitle>
          <DialogDescription>
            Renseignez ce que vous savez. Notre équipe valide chaque fiche avant publication.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="form" className="gap-2"><Plus className="h-4 w-4" /> Formulaire</TabsTrigger>
            <TabsTrigger value="csv" className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Import CSV / XLSX</TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="mt-3">
            <div className="grid gap-3">
              <Field label="Nom du produit *" error={errors.product_name}>
                <Input value={form.product_name} onChange={set("product_name")} maxLength={200} placeholder="Ex : Doliprane 1000mg comprimés" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Marque" error={errors.brand_name}>
                  <Input value={form.brand_name} onChange={set("brand_name")} maxLength={120} />
                </Field>
                <Field label="Fabricant" error={errors.manufacturer_name}>
                  <Input value={form.manufacturer_name} onChange={set("manufacturer_name")} maxLength={120} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="GTIN / EAN" error={errors.gtin}>
                  <Input value={form.gtin} onChange={set("gtin")} maxLength={14} inputMode="numeric" />
                </Field>
                <Field label="CNK (BE)" error={errors.cnk_code}>
                  <Input value={form.cnk_code} onChange={set("cnk_code")} maxLength={10} />
                </Field>
              </div>
              <Field label="Catégorie suggérée" error={errors.category_hint}>
                <Input value={form.category_hint} onChange={set("category_hint")} maxLength={120} placeholder="Ex : Antalgiques" />
                {catSuggestion && catSuggestion.category_name.toLowerCase() !== form.category_hint.trim().toLowerCase() && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
                    <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium">Catégorie détectée : {catSuggestion.category_name}</div>
                      <div className="text-muted-foreground">
                        D'après {catSuggestion.matched_by === "gtin" ? "le GTIN" : "le CNK"} (produit déjà au catalogue : {catSuggestion.product_name})
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px]"
                      onClick={() => setForm(f => ({ ...f, category_hint: catSuggestion.category_name }))}
                    >
                      Utiliser
                    </Button>
                  </div>
                )}
                {catSuggestionLoading && !catSuggestion && (form.gtin || form.cnk_code) && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Recherche de catégorie…</p>
                )}
              </Field>
              <Field label="Notes pour notre équipe" error={errors.notes}>
                <Textarea value={form.notes} onChange={set("notes")} maxLength={1000} rows={3}
                  placeholder="Conditionnement, posologie, lien fournisseur…" />
              </Field>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={formMutation.isPending}>Annuler</Button>
              <Button onClick={() => formMutation.mutate()} disabled={formMutation.isPending || !vendor?.id}>
                {formMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Envoyer la proposition
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="csv" className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Colonnes acceptées : <span className="font-mono">{FIELD_HEADERS.join(", ")}</span>.
                Limite {MAX_ROWS} lignes.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="default" size="sm" className="gap-1" onClick={downloadXlsxTemplate}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Modèle XLSX
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" /> Modèle CSV
                </Button>
              </div>
            </div>

            <label
              htmlFor="csv-upload"
              className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/40 transition"
            >
              <Upload className="h-6 w-6 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">{fileName ?? "Cliquez ou déposez votre fichier CSV ou XLSX"}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">UTF-8, séparateur , ou ; — max 2 Mo</p>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>

            {fileIssue && (
              <div className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {fileIssue}
              </div>
            )}

            {importRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {validCount} valide{validCount > 1 ? "s" : ""}
                    </Badge>
                    {errorCount > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> {errorCount} refusée{errorCount > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {errorCount > 0 && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] gap-1"
                          onClick={() => setShowRejectedOnly((v) => !v)}
                        >
                          {showRejectedOnly ? "Voir toutes les lignes" : "Voir les refusées seules"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] gap-1"
                          onClick={downloadErrorsCsv}
                        >
                          <FileWarning className="h-3.5 w-3.5" />
                          Télécharger les erreurs ({errorCount})
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {errorCount > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <p>
                      Ces {errorCount} ligne{errorCount > 1 ? "s" : ""} ne seront pas envoyées.
                      Téléchargez le CSV d'erreurs, corrigez-les puis réimportez.
                    </p>
                  </div>
                )}

                <ScrollArea className="border rounded-md max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                      <tr>
                        <th className="text-left p-2 font-medium w-10">Ligne</th>
                        <th className="text-left p-2 font-medium">Nom</th>
                        <th className="text-left p-2 font-medium">GTIN</th>
                        <th className="text-left p-2 font-medium">CNK</th>
                        <th className="text-left p-2 font-medium">Marque</th>
                        <th className="text-left p-2 font-medium w-[40%]">Motifs de refus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground">
                            {showRejectedOnly
                              ? "Aucune ligne refusée. Toutes les références sont prêtes à être soumises."
                              : "Aucune ligne à afficher."}
                          </td>
                        </tr>
                      ) : (
                        visibleRows.map((r) => {
                          const rejected = r.errors.length > 0;
                          return (
                            <tr
                              key={r.index}
                              className={`border-t align-top ${rejected ? "bg-destructive/5" : ""}`}
                            >
                              <td className="p-2 text-muted-foreground font-mono">{r.index}</td>
                              <td className="p-2 max-w-[220px] truncate" title={r.data.product_name}>
                                {r.data.product_name || "—"}
                              </td>
                              <td className="p-2 font-mono">{r.data.gtin || "—"}</td>
                              <td className="p-2 font-mono">{r.data.cnk_code || "—"}</td>
                              <td className="p-2 max-w-[140px] truncate" title={r.data.brand_name}>
                                {r.data.brand_name || "—"}
                              </td>
                              <td className="p-2">
                                {rejected ? (
                                  <div className="flex flex-wrap gap-1">
                                    {r.errors.map((e, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 rounded bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px] font-medium"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                        {e}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 text-[11px]">
                                    <CheckCircle2 className="h-3 w-3" /> Prête
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            )}

            {importJobId && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <h3 className="text-sm font-semibold">Soumission en cours côté serveur</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vous pouvez fermer cette fenêtre — le traitement continue en arrière-plan.
                  Suivi complet dans <a href="/mes-imports" className="underline">Mes imports</a>.
                </p>
                <ImportJobProgress jobId={importJobId} onCompleted={handleJobCompleted} />
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={importMutation.isPending || !!importJobId}>
                {importJobId ? "Fermer" : "Annuler"}
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || !!importJobId || validCount === 0 || !vendor?.id}
              >
                {(importMutation.isPending || !!importJobId) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Soumettre {validCount > 0 ? `${validCount} référence${validCount > 1 ? "s" : ""}` : ""}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
