import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, ShieldAlert, ExternalLink } from "lucide-react";

type BlockedOffer = {
  offer_id: string;
  vendor_id: string;
  vendor_name: string | null;
  vendor_display_code: string | null;
  product_id: string | null;
  product_name: string | null;
  product_gtin: string | null;
  is_active: boolean;
  updated_at: string | null;
  missing_distributor: boolean;
  missing_mandate: boolean;
  is_authorized_distributor: boolean;
  mandate_signed_at: string | null;
  reason: string;
};

export default function AdminBlockedOffers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

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

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((r) =>
      [r.vendor_name, r.vendor_display_code, r.product_name, r.product_gtin, r.reason]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, search]);

  const stats = useMemo(() => {
    const total = data?.length ?? 0;
    const missingBoth = (data ?? []).filter((r) => r.missing_distributor && r.missing_mandate).length;
    const missingDist = (data ?? []).filter((r) => r.missing_distributor && !r.missing_mandate).length;
    const missingMandate = (data ?? []).filter((r) => !r.missing_distributor && r.missing_mandate).length;
    return { total, missingBoth, missingDist, missingMandate };
  }, [data]);

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
        <CardHeader>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Rechercher (vendeur, produit, GTIN, motif)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <span className="text-xs text-muted-foreground">{rows.length} résultat(s)</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendeur</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Motif exact</TableHead>
                <TableHead>Distributeur</TableHead>
                <TableHead>Mandat</TableHead>
                <TableHead>Mise à jour</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune offre bloquée 🎉</TableCell></TableRow>
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
