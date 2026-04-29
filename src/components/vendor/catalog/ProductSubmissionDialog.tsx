import { useState } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Upload, FileSpreadsheet, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
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
import { isValidGtin, isValidCnk, normalizeDigits } from "@/lib/product-codes";

const submissionSchema = z.object({
  product_name: z.string().trim().min(2, "Nom requis (min 2 caractères)").max(200, "Max 200 caractères"),
  brand_name: z.string().trim().max(120, "Max 120 caractères").optional().or(z.literal("")),
  manufacturer_name: z.string().trim().max(120, "Max 120 caractères").optional().or(z.literal("")),
  gtin: z.string().trim().max(14, "GTIN max 14 chiffres").regex(/^\d*$/, "Chiffres uniquement").optional().or(z.literal("")),
  cnk_code: z.string().trim().max(10, "CNK max 10 caractères").optional().or(z.literal("")),
  category_hint: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(1000, "Max 1000 caractères").optional().or(z.literal("")),
});

const CSV_HEADERS = [
  "product_name", "brand_name", "manufacturer_name",
  "gtin", "cnk_code", "category_hint", "notes",
] as const;

type CsvRow = {
  index: number;
  data: Record<string, string>;
  errors: string[];
};

const MAX_CSV_ROWS = 500;

function parseCsv(text: string): { rows: CsvRow[]; missingHeaders: string[] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { rows: [], missingHeaders: [] };

  const splitLine = (line: string): string[] => {
    // Mini-parseur CSV : gère guillemets et séparateur ; ou ,
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

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  const missingHeaders = ["product_name"].filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) return { rows: [], missingHeaders };

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length && rows.length < MAX_CSV_ROWS; i++) {
    const cols = splitLine(lines[i]);
    const data: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if ((CSV_HEADERS as readonly string[]).includes(h)) {
        data[h] = (cols[idx] ?? "").slice(0, 1000);
      }
    });
    const errors: string[] = [];
    const parsed = submissionSchema.safeParse({
      product_name: data.product_name ?? "",
      brand_name: data.brand_name ?? "",
      manufacturer_name: data.manufacturer_name ?? "",
      gtin: data.gtin ? normalizeDigits(data.gtin) : "",
      cnk_code: data.cnk_code ? normalizeDigits(data.cnk_code) : "",
      category_hint: data.category_hint ?? "",
      notes: data.notes ?? "",
    });
    if (!parsed.success) {
      parsed.error.issues.forEach((iss) => errors.push(`${iss.path[0]}: ${iss.message}`));
    } else {
      if (parsed.data.gtin && !isValidGtin(parsed.data.gtin)) errors.push("GTIN: clé de contrôle invalide");
      if (parsed.data.cnk_code && !isValidCnk(parsed.data.cnk_code)) errors.push("CNK: 7 chiffres attendus");
    }
    rows.push({ index: i, data: parsed.success ? parsed.data : data, errors });
  }
  return { rows, missingHeaders };
}

const CSV_TEMPLATE =
  CSV_HEADERS.join(",") +
  "\n" +
  `"Doliprane 1000mg comprimés","Sanofi","Sanofi Aventis","3400930000000","1234567","Antalgiques","16 comprimés"\n`;

export function ProductSubmissionDialog({ children }: { children?: React.ReactNode }) {
  const { data: vendor } = useCurrentVendor();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"form" | "csv">("form");

  // ===== Single-form state =====
  const [form, setForm] = useState({
    product_name: "", brand_name: "", manufacturer_name: "",
    gtin: "", cnk_code: "", category_hint: "", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ===== CSV state =====
  const [csvName, setCsvName] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvIssue, setCsvIssue] = useState<string | null>(null);

  const reset = () => {
    setForm({ product_name: "", brand_name: "", manufacturer_name: "", gtin: "", cnk_code: "", category_hint: "", notes: "" });
    setErrors({});
    setCsvName(null); setCsvRows([]); setCsvIssue(null);
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

  const csvMutation = useMutation({
    mutationFn: async () => {
      if (!vendor?.id) throw new Error("Vendeur introuvable");
      const valid = csvRows.filter((r) => r.errors.length === 0);
      if (valid.length === 0) throw new Error("Aucune ligne valide à importer");
      const payloads = valid.map((r) => ({
        vendor_id: vendor.id,
        status: "submitted" as const,
        proposed_payload: Object.fromEntries(
          Object.entries(r.data).filter(([, v]) => v && String(v).trim() !== "")
        ),
      }));
      // Insertion par lots de 100
      for (let i = 0; i < payloads.length; i += 100) {
        const batch = payloads.slice(i, i + 100);
        const { error } = await supabase.from("product_submissions").insert(batch as any);
        if (error) throw error;
      }
      return valid.length;
    },
    onSuccess: (count) => {
      toast({
        title: `${count} référence${count > 1 ? "s" : ""} soumise${count > 1 ? "s" : ""}`,
        description: "Suivez l'avancement dans « Mes propositions ».",
      });
      qc.invalidateQueries({ queryKey: ["vendor-submissions"] });
      reset();
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Erreur d'import", description: err?.message ?? "Import impossible", variant: "destructive" });
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleCsvFile = async (file: File) => {
    setCsvIssue(null);
    setCsvRows([]);
    setCsvName(file.name);
    if (file.size > 1_000_000) { setCsvIssue("Fichier trop volumineux (max 1 Mo)."); return; }
    const text = await file.text();
    const { rows, missingHeaders } = parseCsv(text);
    if (missingHeaders.length > 0) {
      setCsvIssue(`En-tête manquant : ${missingHeaders.join(", ")}. La colonne « product_name » est requise.`);
      return;
    }
    if (rows.length === 0) { setCsvIssue("Aucune ligne détectée dans le fichier."); return; }
    setCsvRows(rows);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modele-propositions-produits.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = csvRows.filter((r) => r.errors.length === 0).length;
  const errorCount = csvRows.length - validCount;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline" className="gap-1">
            <Plus className="h-4 w-4" /> Proposer une référence
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Proposer une ou plusieurs références</DialogTitle>
          <DialogDescription>
            Renseignez ce que vous savez. Notre équipe valide chaque fiche avant publication.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="form" className="gap-2"><Plus className="h-4 w-4" /> Formulaire</TabsTrigger>
            <TabsTrigger value="csv" className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Import CSV</TabsTrigger>
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
                Colonnes acceptées : <span className="font-mono">{CSV_HEADERS.join(", ")}</span>.
                Limite {MAX_CSV_ROWS} lignes.
              </p>
              <Button variant="outline" size="sm" className="gap-1" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5" /> Modèle CSV
              </Button>
            </div>

            <label
              htmlFor="csv-upload"
              className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/40 transition"
            >
              <Upload className="h-6 w-6 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">{csvName ?? "Cliquez ou déposez votre fichier CSV"}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">UTF-8, séparateur , ou ; — max 1 Mo</p>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }}
              />
            </label>

            {csvIssue && (
              <div className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {csvIssue}
              </div>
            )}

            {csvRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {validCount} valide{validCount > 1 ? "s" : ""}
                  </Badge>
                  {errorCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> {errorCount} en erreur
                    </Badge>
                  )}
                </div>

                <div className="border rounded-md max-h-56 overflow-auto text-xs">
                  <table className="w-full">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-1.5 font-medium">#</th>
                        <th className="text-left p-1.5 font-medium">Nom</th>
                        <th className="text-left p-1.5 font-medium">GTIN</th>
                        <th className="text-left p-1.5 font-medium">CNK</th>
                        <th className="text-left p-1.5 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 50).map((r) => (
                        <tr key={r.index} className="border-t">
                          <td className="p-1.5 text-muted-foreground">{r.index}</td>
                          <td className="p-1.5 max-w-[240px] truncate">{r.data.product_name || "—"}</td>
                          <td className="p-1.5 font-mono">{r.data.gtin || "—"}</td>
                          <td className="p-1.5 font-mono">{r.data.cnk_code || "—"}</td>
                          <td className="p-1.5">
                            {r.errors.length === 0 ? (
                              <span className="text-emerald-600">OK</span>
                            ) : (
                              <span className="text-destructive" title={r.errors.join(" · ")}>
                                {r.errors[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvRows.length > 50 && (
                    <div className="p-2 text-[11px] text-muted-foreground text-center border-t">
                      … {csvRows.length - 50} ligne(s) supplémentaire(s) non affichée(s)
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={csvMutation.isPending}>Annuler</Button>
              <Button
                onClick={() => csvMutation.mutate()}
                disabled={csvMutation.isPending || validCount === 0 || !vendor?.id}
              >
                {csvMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
