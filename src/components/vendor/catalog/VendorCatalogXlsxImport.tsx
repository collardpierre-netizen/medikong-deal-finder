import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type ImportResult = {
  ok: boolean;
  dryRun: boolean;
  totals: { rows_total: number; matched: number; unmatched: number; skipped: number };
  offers_upserted: number;
  submissions_created: number;
  errors: { line: number; reason: string }[];
};

export function VendorCatalogXlsxImport({ children }: { children?: React.ReactNode }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      if (!/\.xlsx?$/i.test(file.name)) throw new Error("Format invalide (XLSX attendu)");
      if (file.size > 10 * 1024 * 1024) throw new Error("Fichier trop volumineux (max 10 Mo)");
      const form = new FormData();
      form.append("file", file);
      form.append("dryRun", String(dryRun));
      const { data, error } = await supabase.functions.invoke("import-vendor-catalog-xlsx", {
        body: form,
      });
      if (error) throw error;
      return data as ImportResult;
    },
    onSuccess: (r) => {
      setResult(r);
      toast({
        title: r.dryRun ? "Simulation terminée" : "Import terminé",
        description: `${r.totals.matched} offres, ${r.totals.unmatched} propositions, ${r.totals.skipped} ignorées`,
      });
      if (!r.dryRun) {
        qc.invalidateQueries({ queryKey: ["vendor-submissions"] });
        qc.invalidateQueries({ queryKey: ["vendor-offers"] });
      }
    },
    onError: (e: any) => {
      toast({
        title: "Échec de l'import",
        description: e?.message ?? "Erreur inconnue",
        variant: "destructive",
      });
    },
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) mutation.mutate(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResult(null); }}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline" className="gap-1">
            <FileSpreadsheet className="h-4 w-4" /> Importer un XLSX
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer un catalogue XLSX</DialogTitle>
          <DialogDescription>
            Colonnes reconnues : GTIN/EAN, CNK, nom, marque, fabricant, prix HT, prix TTC, TVA, stock, MOQ, MOV,
            délai de livraison. Les lignes sans correspondance produit créent une proposition à valider.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Checkbox id="dryRun" checked={dryRun} onCheckedChange={(v) => setDryRun(!!v)} />
          <Label htmlFor="dryRun" className="text-xs">
            Mode simulation (n'enregistre rien — vérifiez le rapport avant)
          </Label>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={onPick}
        />

        <Button
          onClick={() => fileRef.current?.click()}
          disabled={mutation.isPending}
          className="gap-2"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Choisir un fichier
        </Button>

        {result && (
          <div className="border rounded-lg p-3 text-[12px] space-y-1 bg-muted/30">
            <p><strong>Lignes :</strong> {result.totals.rows_total}</p>
            <p><strong>Offres {result.dryRun ? "à upserter" : "upsertées"} :</strong> {result.totals.matched}{!result.dryRun ? ` (${result.offers_upserted} OK)` : ""}</p>
            <p><strong>Propositions {result.dryRun ? "à créer" : "créées"} :</strong> {result.totals.unmatched}{!result.dryRun ? ` (${result.submissions_created} OK)` : ""}</p>
            <p><strong>Lignes ignorées :</strong> {result.totals.skipped}</p>
            {result.errors?.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-destructive">
                  {result.errors.length} avertissement(s)
                </summary>
                <ul className="mt-1 max-h-40 overflow-auto pl-4 list-disc">
                  {result.errors.slice(0, 50).map((e, i) => (
                    <li key={i}>{e.line ? `Ligne ${e.line} : ` : ""}{e.reason}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
