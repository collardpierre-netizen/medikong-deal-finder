import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DeclaredPriceRow = {
  id: string;
  supplier_name: string | null;
  price_excl_vat_cents: number;
  updated_at: string;
  customer: { company_name: string | null; is_test: boolean | null } | null;
  product: { name: string | null } | null;
};

const eur = (cents: number) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(cents / 100);
const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Écran admin « Prix déclarés » : prix d'achat saisis par les officines dans Scan (« Vous le payez combien ? »). */
export default function AdminScanDeclaredPrices() {
  const [pharmacy, setPharmacy] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-scan-declared-prices"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pharmacy_product_declared_prices")
        .select("id, supplier_name, price_excl_vat_cents, updated_at, customer:customers(company_name, is_test), product:products(name)")
        .order("updated_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as DeclaredPriceRow[];
    },
  });

  // Règle mémoire : les comptes de test sont exclus de tout tableau de bord.
  const rows = useMemo(() => (data ?? []).filter((row) => row.customer?.is_test !== true), [data]);

  const pharmacies = useMemo(() => [...new Set(rows.map((row) => row.customer?.company_name).filter(Boolean) as string[])].sort(), [rows]);
  const suppliers = useMemo(() => [...new Set(rows.map((row) => row.supplier_name).filter(Boolean) as string[])].sort(), [rows]);

  const filtered = useMemo(() => rows
    .filter((row) => pharmacy === "all" || row.customer?.company_name === pharmacy)
    .filter((row) => supplier === "all" || row.supplier_name === supplier)
    .filter((row) => {
      if (!search.trim()) return true;
      const needle = search.trim().toLowerCase();
      return (row.product?.name ?? "").toLowerCase().includes(needle);
    }), [rows, pharmacy, supplier, search]);

  const avgPrice = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.reduce((sum, row) => sum + row.price_excl_vat_cents, 0) / filtered.length;
  }, [filtered]);

  const exportCsv = () => {
    const headers = ["Officine", "Produit", "Fournisseur déclaré", "Prix HTVA", "Dernière mise à jour"];
    const lines = filtered.map((row) => [
      row.customer?.company_name ?? "",
      row.product?.name ?? "",
      row.supplier_name ?? "",
      (row.price_excl_vat_cents / 100).toFixed(2).replace(".", ","),
      dateFr(row.updated_at),
    ]);
    const csv = [headers, ...lines].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "prix-declares-scan.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <AdminTopBar title="Prix déclarés" subtitle="Prix d'achat saisis par les officines dans Scan (« Vous le payez combien ? ») — comptes de test exclus" />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground">Déclarations</span>
          <div className="mt-1 text-2xl font-bold text-foreground">{filtered.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground">Officines</span>
          <div className="mt-1 text-2xl font-bold text-foreground">{new Set(filtered.map((row) => row.customer?.company_name)).size}</div>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground">Prix moyen déclaré</span>
          <div className="mt-1 text-2xl font-bold text-foreground">{avgPrice != null ? eur(avgPrice) : "—"}</div>
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
        <div className="min-w-52 space-y-1.5">
          <label className="text-xs font-medium">Fournisseur déclaré</label>
          <Select value={supplier} onValueChange={setSupplier}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les fournisseurs</SelectItem>
              {suppliers.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-64 space-y-1.5">
          <label htmlFor="declared-search" className="text-xs font-medium">Produit</label>
          <Input id="declared-search" placeholder="Rechercher un produit…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Button variant="outline" className="ml-auto" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Exporter CSV</Button>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : error ? (
          <p className="px-4 py-8 text-center text-sm text-destructive">Erreur de chargement : {(error as Error).message}</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun prix déclaré pour ces filtres.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  {["Officine", "Produit", "Fournisseur déclaré", "Prix HTVA", "Dernière mise à jour"].map((heading) => (
                    <TableHead key={heading} className="whitespace-nowrap">{heading}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.customer?.company_name ?? "—"}</TableCell>
                    <TableCell>{row.product?.name ?? "—"}</TableCell>
                    <TableCell>{row.supplier_name ?? "—"}</TableCell>
                    <TableCell>{eur(row.price_excl_vat_cents)}</TableCell>
                    <TableCell className="text-muted-foreground">{dateFr(row.updated_at)}</TableCell>
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
