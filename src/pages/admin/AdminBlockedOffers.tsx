import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, ShieldAlert, ExternalLink, CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BlockedOffer = {
  offer_id: string;
  vendor_id: string;
  vendor_name: string | null;
  vendor_display_code: string | null;
  product_id: string | null;
  product_name: string | null;
  product_gtin: string | null;
  brand_id: string | null;
  brand_name: string | null;
  is_active: boolean;
  updated_at: string | null;
  missing_distributor: boolean;
  missing_mandate: boolean;
  is_authorized_distributor: boolean;
  mandate_signed_at: string | null;
  reason: string;
};

type ReasonFilter = "all" | "both" | "distributor" | "mandate";

export default function AdminBlockedOffers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-blocked-offers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_blocked_offers_list" as any);
      if (error) throw error;
      return (data ?? []) as BlockedOffer[];
    },
  });

  const recheck = useMutation({
    mutationFn: async (offerId: string) => {
      const { data, error } = await supabase.rpc(
        "admin_recheck_offer_publication" as any,
        { _offer_id: offerId },
      );
      if (error) throw error;
      return data as { ok: boolean; activated?: boolean; reason?: string };
    },
    onSuccess: (res) => {
      if (res?.ok && res?.activated) {
        toast.success("Offre republiée", { description: res.reason });
      } else {
        toast.error("Toujours bloquée", { description: res?.reason ?? "Vendeur non conforme" });
      }
      qc.invalidateQueries({ queryKey: ["admin-blocked-offers"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur re-contrôle"),
  });

  const vendorOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((r) => {
      if (r.vendor_id) map.set(r.vendor_id, r.vendor_name || r.vendor_display_code || r.vendor_id);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [data]);

  const brandOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((r) => {
      if (r.brand_id) map.set(r.brand_id, r.brand_name || r.brand_id);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).setHours(0, 0, 0, 0) : null;
    const toTs = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : null;

    return (data ?? []).filter((r) => {
      if (vendorFilter !== "all" && r.vendor_id !== vendorFilter) return false;
      if (brandFilter !== "all" && r.brand_id !== brandFilter) return false;

      if (reasonFilter === "both" && !(r.missing_distributor && r.missing_mandate)) return false;
      if (reasonFilter === "distributor" && !(r.missing_distributor && !r.missing_mandate)) return false;
      if (reasonFilter === "mandate" && !(!r.missing_distributor && r.missing_mandate)) return false;

      if (fromTs !== null || toTs !== null) {
        const t = r.updated_at ? new Date(r.updated_at).getTime() : NaN;
        if (Number.isNaN(t)) return false;
        if (fromTs !== null && t < fromTs) return false;
        if (toTs !== null && t > toTs) return false;
      }

      if (q) {
        return [
          r.vendor_name, r.vendor_display_code, r.product_name,
          r.product_gtin, r.brand_name, r.reason,
        ].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      }
      return true;
    });
  }, [data, search, vendorFilter, brandFilter, reasonFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = data?.length ?? 0;
    const missingBoth = (data ?? []).filter((r) => r.missing_distributor && r.missing_mandate).length;
    const missingDist = (data ?? []).filter((r) => r.missing_distributor && !r.missing_mandate).length;
    const missingMandate = (data ?? []).filter((r) => !r.missing_distributor && r.missing_mandate).length;
    return { total, missingBoth, missingDist, missingMandate };
  }, [data]);

  const activeFilters =
    (vendorFilter !== "all" ? 1 : 0) +
    (brandFilter !== "all" ? 1 : 0) +
    (reasonFilter !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) +
    (search.trim() ? 1 : 0);

  function resetFilters() {
    setSearch(""); setVendorFilter("all"); setBrandFilter("all");
    setReasonFilter("all"); setDateFrom(undefined); setDateTo(undefined);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" />
            Offres bloquées par le garde-fou
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Offres <code>is_active = false</code> dont le vendeur n'est pas encore conforme
            (distributeur autorisé + mandat de facturation signé).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total bloquées</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.total}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Les deux manquants</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.missingBoth}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Distributeur ✗</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.missingDist}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Mandat ✗</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.missingMandate}</CardContent></Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Rechercher (vendeur, produit, GTIN, marque, motif)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />

            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Vendeur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les vendeurs</SelectItem>
                {vendorOptions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Marque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les marques</SelectItem>
                {brandOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={reasonFilter} onValueChange={(v) => setReasonFilter(v as ReasonFilter)}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Motif" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les motifs</SelectItem>
                <SelectItem value="both">Distributeur + mandat manquants</SelectItem>
                <SelectItem value="distributor">Distributeur non autorisé</SelectItem>
                <SelectItem value="mandate">Mandat non signé</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-[170px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Bloquée depuis"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-[170px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "Bloquée jusqu'à"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-4 w-4 mr-1" />
                Réinitialiser ({activeFilters})
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{rows.length} résultat(s)</div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendeur</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Marque</TableHead>
                <TableHead>Motif exact</TableHead>
                <TableHead>Distributeur</TableHead>
                <TableHead>Mandat</TableHead>
                <TableHead>Mise à jour</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune offre bloquée 🎉</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.offer_id}>
                  <TableCell>
                    <div className="font-medium">{r.vendor_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.vendor_display_code ?? ""}</div>
                    <Link
                      to={`/admin/vendeurs`}
                      className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      Fiche vendeur <ExternalLink className="h-3 w-3" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.product_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.product_gtin ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.brand_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">{r.reason}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.missing_distributor
                      ? <Badge variant="destructive">Non</Badge>
                      : <Badge variant="secondary">Oui</Badge>}
                  </TableCell>
                  <TableCell>
                    {r.missing_mandate
                      ? <Badge variant="destructive">Non signé</Badge>
                      : <Badge variant="secondary">
                          {r.mandate_signed_at ? new Date(r.mandate_signed_at).toLocaleDateString("fr-BE") : "Signé"}
                        </Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.updated_at ? new Date(r.updated_at).toLocaleString("fr-BE") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => recheck.mutate(r.offer_id)}
                      disabled={recheck.isPending}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${recheck.isPending ? "animate-spin" : ""}`} />
                      Re-contrôler
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
