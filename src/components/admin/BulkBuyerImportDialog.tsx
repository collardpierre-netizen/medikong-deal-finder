import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Upload, Loader2 } from "lucide-react";

type Row = { name: string; apb: string; type: string; email: string; phone: string };
type Result = { line: number; name: string; email: string; status: "created" | "skipped" | "error"; message?: string | null; email_sent?: boolean };

const MAX = 200;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const norm = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
const TYPES: Record<string, boolean> = {
  pharmacien: true, pharmacie: true, "professionnel de sante": false, medecin: false,
  "maison de repos": false, groupement: false, revendeur: false,
};

function mapRecord(rec: Record<string, unknown>): Row {
  const get = (...keys: string[]) => {
    for (const k of Object.keys(rec)) if (keys.includes(norm(k))) return String(rec[k] ?? "").trim();
    return "";
  };
  return {
    name: get("nom", "name", "societe", "officine"),
    apb: get("apb", "numero apb", "n° apb"),
    type: get("type", "profil"),
    email: get("email", "e-mail", "mail").toLowerCase(),
    phone: get("tel", "tél", "telephone", "phone"),
  };
}

function parsePaste(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const cells = lines.map((l) => l.split(sep).map((c) => c.trim()));
  const hasHeader = cells[0].some((c) => ["nom", "email", "type", "apb"].includes(norm(c)));
  if (hasHeader) {
    const head = cells[0];
    return cells.slice(1).map((c) => mapRecord(Object.fromEntries(head.map((h, i) => [h, c[i] ?? ""]))));
  }
  return cells.map((c) => ({ name: c[0] ?? "", apb: c[1] ?? "", type: c[2] ?? "", email: (c[3] ?? "").toLowerCase(), phone: c[4] ?? "" }));
}

function check(rows: Row[]) {
  const seen = new Set<string>();
  return rows.map((r) => {
    const t = TYPES[norm(r.type)];
    let status: "ok" | "skip" | "error" = "ok";
    let msg = "";
    if (!r.name) { status = "error"; msg = "Nom manquant"; }
    else if (!EMAIL_RE.test(r.email)) { status = "error"; msg = "Email invalide"; }
    else if (t === undefined) { status = "error"; msg = `Type inconnu « ${r.type} »`; }
    else if (t && !r.apb.replace(/\D/g, "")) { status = "error"; msg = "APB requis"; }
    else if (seen.has(r.email)) { status = "skip"; msg = "Doublon dans la liste"; }
    if (status === "ok") seen.add(r.email);
    return { ...r, status, msg };
  });
}

export default function BulkBuyerImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [paste, setPaste] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  const checked = useMemo(() => check(rows), [rows]);
  const ready = checked.filter((r) => r.status === "ok");

  const reset = () => { setRows([]); setPaste(""); setResults(null); setVerified(false); };

  const onFile = async (f: File) => {
    const wb = XLSX.read(await f.arrayBuffer());
    const recs = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    setRows(recs.map(mapRecord).filter((r) => r.name || r.email));
    setResults(null);
  };

  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet([["Nom", "APB", "Type", "Email", "Tél"], ["Pharmacie du Centre", "123456", "pharmacien", "contact@pharmacie.be", "+32 2 000 00 00"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comptes");
    XLSX.writeFile(wb, "modele_comptes_acheteurs.xlsx");
  };

  const exportResults = () => {
    if (!results) return;
    const ws = XLSX.utils.json_to_sheet(results.map((r) => ({
      Ligne: r.line, Nom: r.name, Email: r.email,
      Statut: r.status === "created" ? "créé" : r.status === "skipped" ? "ignoré" : "erreur",
      "Email envoyé": r.status === "created" ? (r.email_sent ? "oui" : "non") : "", Détail: r.message ?? "",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Résultat");
    XLSX.writeFile(wb, "resultat_import_comptes.xlsx");
  };

  const submit = async () => {
    if (!ready.length) return;
    if (ready.length > MAX) { toast.error(`Maximum ${MAX} comptes par import`); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("bulk-create-buyers", {
      body: { verified, rows: ready.map(({ name, apb, type, email, phone }) => ({ name, apb, type, email, phone })) },
    });
    setBusy(false);
    if (error || !(data as any)?.success) {
      let detail = (data as any)?.error || error?.message || "Erreur";
      try { const t = await (error as any)?.context?.json?.(); if (t?.error) detail = t.error; } catch { /* */ }
      toast.error("Import impossible", { description: detail });
      return;
    }
    setResults((data as any).results);
    onDone?.();
  };

  const counts = results && {
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    mails: results.filter((r) => r.email_sent).length,
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer des comptes en masse</DialogTitle>
          <DialogDescription>Colonnes : Nom, APB, Type, Email, Tél. Types acceptés : pharmacien, professionnel de santé, maison de repos, groupement, revendeur. Maximum {MAX} comptes.</DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={template} className="gap-1.5"><Download size={14} /> Modèle Excel</Button>
              <label className="inline-flex">
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input text-sm cursor-pointer hover:bg-accent"><Upload size={14} /> Choisir un fichier</span>
              </label>
            </div>
            <div className="space-y-2">
              <Textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4}
                placeholder={"Ou collez des lignes (depuis Excel, ou séparées par ; ) :\nPharmacie du Centre;123456;pharmacien;contact@pharmacie.be;+32 2 000 00 00"} />
              <Button size="sm" variant="secondary" disabled={!paste.trim()} onClick={() => { setRows(parsePaste(paste)); setResults(null); }}>Lire les lignes collées</Button>
            </div>

            {checked.length > 0 && (
              <>
                <div className="text-sm text-muted-foreground">
                  {ready.length} prête(s) · {checked.filter((r) => r.status === "skip").length} ignorée(s) · {checked.filter((r) => r.status === "error").length} en erreur.
                  Les comptes déjà existants seront ignorés au moment de la création.
                </div>
                <div className="border border-border rounded-lg overflow-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0"><tr>{["", "Nom", "APB", "Type", "Email", "Tél", "Détail"].map((h) => <th key={h} className="text-left px-2 py-1.5">{h}</th>)}</tr></thead>
                    <tbody>
                      {checked.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1">{r.status === "ok" ? "✓" : r.status === "skip" ? "⚠" : "✗"}</td>
                          <td className="px-2 py-1">{r.name}</td><td className="px-2 py-1">{r.apb}</td><td className="px-2 py-1">{r.type}</td>
                          <td className="px-2 py-1">{r.email}</td><td className="px-2 py-1">{r.phone}</td>
                          <td className={`px-2 py-1 ${r.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>{r.msg}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={verified} onCheckedChange={(v) => setVerified(v === true)} />
                  Valider ces comptes d'office (accès aux prix dès le mot de passe choisi)
                </label>
                <div className="flex justify-end">
                  <Button onClick={submit} disabled={busy || !ready.length || ready.length > MAX} className="gap-1.5">
                    {busy && <Loader2 size={14} className="animate-spin" />} Créer {ready.length} compte(s)
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm">
              <strong>{counts!.created}</strong> créé(s) · <strong>{counts!.skipped}</strong> ignoré(s) · <strong>{counts!.errors}</strong> erreur(s) · <strong>{counts!.mails}</strong> email(s) envoyé(s)
            </div>
            <div className="border border-border rounded-lg overflow-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0"><tr>{["Ligne", "Nom", "Email", "Statut", "Détail"].map((h) => <th key={h} className="text-left px-2 py-1.5">{h}</th>)}</tr></thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.line} className="border-t border-border">
                      <td className="px-2 py-1">{r.line}</td><td className="px-2 py-1">{r.name}</td><td className="px-2 py-1">{r.email}</td>
                      <td className="px-2 py-1">{r.status === "created" ? "créé" : r.status === "skipped" ? "ignoré" : "erreur"}</td>
                      <td className="px-2 py-1 text-muted-foreground">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={exportResults} className="gap-1.5"><Download size={14} /> Télécharger le récapitulatif</Button>
              <Button onClick={reset}>Nouvel import</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
