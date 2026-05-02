import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Check, X, AlertTriangle, Filter, Loader2 } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

type Status = "pending_approval" | "approved" | "rejected" | "draft" | "expired";

interface OverrideRow {
  id: string;
  vendor_id: string;
  product_id: string;
  commission_model: string;
  commission_rate: number | null;
  margin_split_pct: number | null;
  fixed_commission_amount: number | null;
  status: Status;
  valid_from: string | null;
  valid_until: string | null;
  note: string | null;
  rejected_reason: string | null;
  created_at: string;
  vendors: { id: string; name: string | null; company_name: string | null } | null;
  products: { id: string; name: string; gtin: string | null } | null;
}

function describeRule(r: OverrideRow): string {
  switch (r.commission_model) {
    case "flat_percentage":
      return `${r.commission_rate ?? "—"} %`;
    case "margin_split":
      return `Split marge ${r.margin_split_pct ?? "—"} %`;
    case "fixed_amount":
      return `${r.fixed_commission_amount ?? "—"} € / unité`;
    default:
      return r.commission_model;
  }
}

function StatusBadge({ s }: { s: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    pending_approval: { label: "En attente", cls: "bg-amber-100 text-amber-900 border-amber-300" },
    approved:        { label: "Approuvé",   cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
    rejected:        { label: "Rejeté",     cls: "bg-rose-100 text-rose-900 border-rose-300" },
    draft:           { label: "Brouillon",  cls: "bg-slate-100 text-slate-700 border-slate-300" },
    expired:         { label: "Expiré",     cls: "bg-zinc-100 text-zinc-600 border-zinc-300" },
  };
  const m = map[s] ?? map.pending_approval;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

interface OfferOverrideRow {
  id: string;
  vendor_id: string;
  product_id: string | null;
  commission_model: string;
  commission_rate: number | null;
  margin_split_pct: number | null;
  fixed_commission_amount: number | null;
  commission_override_status: Status;
  commission_valid_from: string | null;
  commission_valid_until: string | null;
  commission_override_reason: string | null;
  vendors: { id: string; name: string | null; company_name: string | null } | null;
  products: { id: string; name: string; gtin: string | null } | null;
}

function describeOfferRule(r: OfferOverrideRow): string {
  switch (r.commission_model) {
    case "flat_percentage": return `${r.commission_rate ?? "—"} %`;
    case "margin_split":    return `Split marge ${r.margin_split_pct ?? "—"} %`;
    case "fixed_amount":    return `${r.fixed_commission_amount ?? "—"} € / unité`;
    default: return r.commission_model;
  }
}

export default function AdminCommissionOverridesPage() {
  const qc = useQueryClient();
  const [scope, setScope] = useState<"product" | "offer">("product");
  const [tab, setTab] = useState<Status>("pending_approval");
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<{ id: string; scope: "product" | "offer" } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useQuery({
    enabled: scope === "product",
    queryKey: ["admin-commission-overrides", "product", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_product_commissions")
        .select(`
          id, vendor_id, product_id, commission_model, commission_rate,
          margin_split_pct, fixed_commission_amount, status, valid_from,
          valid_until, note, rejected_reason, created_at,
          vendors:vendor_id ( id, name, company_name ),
          products:product_id ( id, name, gtin )
        `)
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as OverrideRow[];
    },
  });

  const { data: offerData, isLoading: offerLoading } = useQuery({
    enabled: scope === "offer",
    queryKey: ["admin-commission-overrides", "offer", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select(`
          id, vendor_id, product_id, commission_model, commission_rate,
          margin_split_pct, fixed_commission_amount, commission_override_status,
          commission_valid_from, commission_valid_until, commission_override_reason,
          vendors:vendor_id ( id, name, company_name ),
          products:product_id ( id, name, gtin )
        `)
        .eq("commission_override_status", tab)
        .not("commission_model", "is", null)
        .order("commission_override_updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as OfferOverrideRow[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (vars: { id: string; scope: "product" | "offer"; decision: "approve" | "reject"; reason?: string }) => {
      if (vars.scope === "product") {
        const { error } = await supabase.rpc("admin_review_product_commission", {
          _id: vars.id,
          _decision: vars.decision,
          _reason: vars.reason ?? null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("admin_review_offer_commission" as any, {
          _offer_id: vars.id,
          _decision: vars.decision,
          _reason: vars.reason ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.decision === "approve" ? "Override approuvé" : "Override rejeté");
      qc.invalidateQueries({ queryKey: ["admin-commission-overrides"] });
      qc.invalidateQueries({ queryKey: ["effective-commission"] });
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const filtered = (data ?? []).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.vendors?.name?.toLowerCase().includes(q) ||
      r.vendors?.company_name?.toLowerCase().includes(q) ||
      r.products?.name?.toLowerCase().includes(q) ||
      r.products?.gtin?.toLowerCase().includes(q)
    );
  });

  const filteredOffers = (offerData ?? []).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.vendors?.name?.toLowerCase().includes(q) ||
      r.vendors?.company_name?.toLowerCase().includes(q) ||
      r.products?.name?.toLowerCase().includes(q) ||
      r.products?.gtin?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <Helmet><title>Commissions personnalisées — Admin MediKong</title></Helmet>

      <div>
        <h1 className="text-2xl font-bold text-mk-navy">Commissions personnalisées</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Validez ou rejetez les règles de commission proposées par les vendeurs sur des produits
          spécifiques. La cascade appliquée est : <strong>offre &gt; produit &gt; vendeur</strong>.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Demandes</CardTitle>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <Input
              placeholder="Vendeur, produit, GTIN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle scope produit / offre */}
          <Tabs value={scope} onValueChange={(v) => setScope(v as "product" | "offer")}>
            <TabsList>
              <TabsTrigger value="product">Overrides produit (vendeur × produit)</TabsTrigger>
              <TabsTrigger value="offer">Overrides offre (ligne unique)</TabsTrigger>
            </TabsList>
          </Tabs>

          <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
            <TabsList>
              <TabsTrigger value="pending_approval">En attente</TabsTrigger>
              <TabsTrigger value="approved">Approuvées</TabsTrigger>
              <TabsTrigger value="rejected">Rejetées</TabsTrigger>
              <TabsTrigger value="expired">Expirées</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-4">
              {scope === "product" ? (
                isLoading ? (
                  <div className="py-12 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Aucune demande dans ce statut.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendeur</TableHead>
                        <TableHead>Produit</TableHead>
                        <TableHead>Règle</TableHead>
                        <TableHead>Validité</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium">{r.vendors?.company_name || r.vendors?.name || "—"}</div>
                            <div className="text-xs text-muted-foreground font-mono">{r.vendor_id.slice(0, 8)}…</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium line-clamp-1 max-w-xs">{r.products?.name || "—"}</div>
                            {r.products?.gtin && (
                              <div className="text-xs text-muted-foreground font-mono">{r.products.gtin}</div>
                            )}
                            {r.note && (
                              <div className="text-xs text-amber-700 mt-1 italic">« {r.note} »</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-mk-navy">{describeRule(r)}</span>
                            <div className="text-xs text-muted-foreground capitalize">{r.commission_model.replace("_", " ")}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.valid_from ? new Date(r.valid_from).toLocaleDateString("fr-BE") : "—"}
                            {" → "}
                            {r.valid_until ? new Date(r.valid_until).toLocaleDateString("fr-BE") : "∞"}
                          </TableCell>
                          <TableCell><StatusBadge s={r.status} /></TableCell>
                          <TableCell className="text-right">
                            {r.status === "pending_approval" ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-rose-300 text-rose-700 hover:bg-rose-50"
                                  onClick={() => setRejectTarget({ id: r.id, scope: "product" })}
                                  disabled={reviewMutation.isPending}
                                >
                                  <X size={14} className="mr-1" /> Rejeter
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => reviewMutation.mutate({ id: r.id, scope: "product", decision: "approve" })}
                                  disabled={reviewMutation.isPending}
                                >
                                  <Check size={14} className="mr-1" /> Approuver
                                </Button>
                              </div>
                            ) : r.status === "rejected" && r.rejected_reason ? (
                              <span className="text-xs text-muted-foreground italic flex items-center justify-end gap-1">
                                <AlertTriangle size={12} /> {r.rejected_reason}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : offerLoading ? (
                <div className="py-12 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredOffers.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Aucun override offre dans ce statut.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendeur</TableHead>
                      <TableHead>Offre · Produit</TableHead>
                      <TableHead>Règle</TableHead>
                      <TableHead>Validité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOffers.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.vendors?.company_name || r.vendors?.name || "—"}</div>
                          <div className="text-xs text-muted-foreground font-mono">{r.vendor_id.slice(0, 8)}…</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium line-clamp-1 max-w-xs">{r.products?.name || "—"}</div>
                          {r.products?.gtin && (
                            <div className="text-xs text-muted-foreground font-mono">{r.products.gtin}</div>
                          )}
                          <div className="text-[10px] text-muted-foreground font-mono">offer #{r.id.slice(0, 8)}…</div>
                          {r.commission_override_reason && (
                            <div className="text-xs text-amber-700 mt-1 italic">« {r.commission_override_reason} »</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-mk-navy">{describeOfferRule(r)}</span>
                          <div className="text-xs text-muted-foreground capitalize">{r.commission_model.replace("_", " ")}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.commission_valid_from ? new Date(r.commission_valid_from).toLocaleDateString("fr-BE") : "—"}
                          {" → "}
                          {r.commission_valid_until ? new Date(r.commission_valid_until).toLocaleDateString("fr-BE") : "∞"}
                        </TableCell>
                        <TableCell><StatusBadge s={r.commission_override_status} /></TableCell>
                        <TableCell className="text-right">
                          {r.commission_override_status === "pending_approval" ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-rose-300 text-rose-700 hover:bg-rose-50"
                                onClick={() => setRejectTarget({ id: r.id, scope: "offer" })}
                                disabled={reviewMutation.isPending}
                              >
                                <X size={14} className="mr-1" /> Rejeter
                              </Button>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => reviewMutation.mutate({ id: r.id, scope: "offer", decision: "approve" })}
                                disabled={reviewMutation.isPending}
                              >
                                <Check size={14} className="mr-1" /> Approuver
                              </Button>
                            </div>
                          ) : r.commission_override_status === "rejected" && r.commission_override_reason ? (
                            <span className="text-xs text-muted-foreground italic flex items-center justify-end gap-1">
                              <AlertTriangle size={12} /> {r.commission_override_reason}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la demande de commission</DialogTitle>
            <DialogDescription>
              Précisez la raison du rejet (visible par le vendeur).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex : taux trop bas par rapport au défaut vendeur, période trop longue, produit hors scope…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectTarget &&
                reviewMutation.mutate({ id: rejectTarget.id, scope: rejectTarget.scope, decision: "reject", reason: rejectReason.trim() || undefined })
              }
              disabled={reviewMutation.isPending}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
