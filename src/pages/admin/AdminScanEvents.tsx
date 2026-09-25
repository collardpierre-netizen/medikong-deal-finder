import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ScanEventRow = {
  id: string;
  scanned_at: string;
  raw_code: string | null;
  gtin: string | null;
  cnk: string | null;
  match_status: string | null;
  verdict: string | null;
  best_price_excl_vat: number | null;
  ref_price_excl_vat: number | null;
  ref_source: string | null;
  delta_excl_vat: number | null;
  customer: { company_name: string | null; is_test: boolean | null } | null;
  product: { name: string | null } | null;
};

const eur = (value: number | null) =>
  value == null ? "—" : new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(value);
const dateFr = (iso: string) =>
  new Date(iso).toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const VERDICT_LABELS: Record<string, string> = {
  green: "Vert",
  orange: "Orange",
  red: "Rouge",
  unknown: "Inconnu",
};
const verdictVariant = (verdict: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (verdict === "green") return "default";
  if (verdict === "red") return "destructive";
  if (verdict === "orange") return "secondary";
  return "outline";
};

/** Écran admin « Scans » : journal individuel des scans des officines (comptes de test exclus). */
export default function AdminScanEvents() {
  const [pharmacy, setPharmacy] = useState("all");
  const [verdict, setVerdict] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-scan-events"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("scan_events")
        .select("id, scanned_at, raw_code, gtin, cnk, match_status, verdict, best_price_excl_vat, ref_price_excl_vat, ref_source, delta_excl_vat, customer:customers(company_name, is_test), product:products(name)")
        .order("scanned_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ScanEventRow[];
    },
  });

  // Règle mémoire : les comptes de test sont exclus de tout tableau de bord.
  const rows = useMemo(() => (data ?? []).filter((row) => row.customer?.is_test !== true), [data]);

  const pharmacies = useMemo(() => [...new Set(rows.map((row) => row.customer?.company_name).filter(Boolean) as string[])].sort(), [rows]);

  const filtered = useMemo(() => rows
    .filter((row) => pharmacy === "all" || row.customer?.company_name === pharmacy)
    .filter((row) => verdict === "all" || (row.verdict ?? "unknown") === verdict)
    .filter((row) => {
      if (!search.trim()) return true;
      const needle = search.trim().toLowerCase();
      return [row.product?.name, row.raw_code, row.gtin, row.cnk].some((field) => (field ?? "").toLowerCase().includes(needle));
    }), [rows, pharmacy, verdict, search]);

  const unknownCount = useMemo(() => filtered.filter((row) => !row.product).length, [filtered]);

  const exportCsv = () => {
    const headers = ["Date", "Officine", "Code scanné", "Produit", "Verdict", "Prix MediKong HTVA", "Prix référence HTVA", "Source référence", "Écart HTVA"];
    const lines = filtered.map((row) => [
      dateFr(row.scanned_at),
      row.customer?.company_name ?? "",
      row.gtin ?? row.raw_code ?? row.cnk ?? "",
      row.product?.name ?? "",
      VERDICT_LABELS[row.verdict ?? "unknown"] ?? row.verdict ?? "",
      row.best_price_excl_vat?.toFixed(2).replace(".", ",") ?? "",
      row.ref_price_excl_vat?.toFixed(2).replace(".", ",") ?? "",
      row.ref_source ?? "",
      row.delta_excl_vat?.toFixed(2).replace(".", ",") ?? "",
    ]);
    const csv = [headers, ...lines].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "scans.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <AdminTopBar title="Scans" subtitle="Journal des scans des officines — comptes de test exclus" />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground">Scans</span>
          <div className="mt-1 text-2xl font-bold text-foreground">{filtered.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground">Officines</span>
          <div className="mt-1 text-2xl font-bold text-foreground">{new Set(filtered.map((row) => row.customer?.company_name)).size}</div>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground">Codes non reconnus</span>
          <div className="mt-1 text-2xl font-bold text-foreground">{unknownCount}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="min-w-52 space-y-1.5">
          <label className="text-xs font-medium">Officine</label>
          <Select value={pharmacy} onValueChange={setPharmacy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les officines</SelectItem>
              {pharmacies.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-44 space-y-1.5">
          <label className="text-xs font-medium">Verdict</label>
          <Select value={verdict} onValueChange={setVerdict}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les verdicts</SelectItem>
              {Object.entries(VERDICT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-64 space-y-1.5">
          <label htmlFor="scan-search" className="text-xs font-medium">Produit ou code</label>
          <Input id="scan-search" placeholder="Nom, EAN, CNK…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Button variant="outline" className="ml-auto" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Exporter CSV</Button>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : error ? (
          <p className="px-4 py-8 text-center text-sm text-destructive">Erreur de chargement : {(error as Error).message}</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun scan pour ces filtres.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  {["Date", "Officine", "Code scanné", "Produit", "Verdict", "Prix MediKong", "Prix référence", "Écart"].map((heading) => (
                    <TableHead key={heading} className="whitespace-nowrap">{heading}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{dateFr(row.scanned_at)}</TableCell>
                    <TableCell className="font-medium">{row.customer?.company_name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.gtin ?? row.raw_code ?? row.cnk ?? "—"}</TableCell>
                    <TableCell>{row.product?.name ?? <span className="text-muted-foreground">Non reconnu</span>}</TableCell>
                    <TableCell><Badge variant={verdictVariant(row.verdict)}>{VERDICT_LABELS[row.verdict ?? "unknown"] ?? row.verdict ?? "—"}</Badge></TableCell>
                    <TableCell>{eur(row.best_price_excl_vat)}</TableCell>
                    <TableCell>{eur(row.ref_price_excl_vat)}{row.ref_source ? <span className="ml-1 text-xs text-muted-foreground">({row.ref_source})</span> : null}</TableCell>
                    <TableCell>{eur(row.delta_excl_vat)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
