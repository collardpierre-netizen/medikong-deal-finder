import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VEmptyState } from "@/components/vendor/ui/VEmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { fmtEur, fmtEurFromCents } from "@/lib/format-currency";
import { formatUpdatedAt } from "@/lib/format-date";
import {
  ShoppingCart, FileText, BanknoteIcon, RotateCcw, Loader2, Search, PackageX, Truck,
} from "lucide-react";

type BadgeColor = "info" | "success" | "warning" | "default";

const ORDER_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  draft: { label: "Brouillon", color: "default" },
  pending: { label: "En attente", color: "warning" },
  confirmed: { label: "Confirmée", color: "info" },
  processing: { label: "En préparation", color: "info" },
  forwarded: { label: "Transmise", color: "info" },
  partially_shipped: { label: "Part. expédiée", color: "info" },
  shipped: { label: "Expédiée", color: "info" },
  delivered: { label: "Livrée", color: "success" },
  cancelled: { label: "Annulée", color: "default" },
};

const RELEASE_DECISION: Record<string, { label: string; color: BadgeColor }> = {
  full: { label: "Paiement complet", color: "success" },
  partial: { label: "Paiement partiel", color: "warning" },
  blocked: { label: "Paiement bloqué", color: "default" },
  none: { label: "Aucun paiement", color: "default" },
};

const RESTOCK_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  draft: { label: "Brouillon", color: "default" },
  pending: { label: "En validation", color: "warning" },
  published: { label: "Publié", color: "success" },
  sold: { label: "Vendu", color: "info" },
  rejected: { label: "Refusé", color: "default" },
  expired: { label: "Expiré", color: "default" },
  archived: { label: "Archivé", color: "default" },
};

function Row({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border/60 py-3 last:border-0">{children}</div>;
}

export default function VendorTracking() {
  const vendorQuery = useCurrentVendor();
  const vendorId = vendorQuery.data?.id;
  const [search, setSearch] = useState("");

  // ---- Commandes reçues -------------------------------------------------
  const ordersQuery = useQuery({
    queryKey: ["vendor-tracking-orders", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data: lines, error } = await supabase
        .from("order_lines")
        .select("id, order_id, quantity, quantity_shipped, line_total_excl_vat, fulfillment_status")
        .eq("vendor_id", vendorId!);
      if (error) throw error;
      if (!lines?.length) return [];

      const orderIds = [...new Set(lines.map((l) => l.order_id))];
      const { data: orders } = await (supabase as any)
        .from("vendor_orders_v")
        .select("id, order_number, status, created_at, payment_status, hidden_from_list, deleted_at")
        .in("id", orderIds)
        .eq("hidden_from_list", false)
        .is("deleted_at", null);

      const byOrder = new Map<string, any>();
      for (const o of orders || []) {
        byOrder.set(o.id, {
          order_id: o.id,
          order_number: o.order_number,
          status: o.status,
          payment_status: o.payment_status,
          created_at: o.created_at,
          lines: 0,
          units: 0,
          units_shipped: 0,
          total_ht: 0,
        });
      }
      for (const l of lines) {
        const agg = byOrder.get(l.order_id);
        if (!agg) continue;
        agg.lines += 1;
        agg.units += l.quantity ?? 0;
        agg.units_shipped += l.quantity_shipped ?? 0;
        agg.total_ht += Number(l.line_total_excl_vat ?? 0);
      }
      return Array.from(byOrder.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
  });

  // ---- Bons de livraison + lignes --------------------------------------
  const notesQuery = useQuery({
    queryKey: ["vendor-tracking-delivery-notes", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data: notes, error } = await supabase
        .from("delivery_notes")
        .select(
          "id, order_id, document_number, status, carrier, tracking_number, issued_at, confirmed_at, confirmed_by_name, client_remarks, cancelled_at, cancellation_reason",
        )
        .eq("vendor_id", vendorId!)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      if (!notes?.length) return { notes: [] as any[], linesByNote: new Map<string, any[]>(), orderNumbers: new Map<string, string>() };

      const noteIds = notes.map((n) => n.id);
      const orderIds = [...new Set(notes.map((n) => n.order_id))];
      const [linesRes, ordersRes] = await Promise.all([
        supabase
          .from("delivery_note_lines")
          .select("id, delivery_note_id, order_line_id, quantity, accepted_quantity, refused_quantity, refusal_reason")
          .in("delivery_note_id", noteIds),
        (supabase as any)
          .from("vendor_orders_v")
          .select("id, order_number")
          .in("id", orderIds),
      ]);

      const linesByNote = new Map<string, any[]>();
      for (const l of linesRes.data || []) {
        const arr = linesByNote.get(l.delivery_note_id) || [];
        arr.push(l);
        linesByNote.set(l.delivery_note_id, arr);
      }
      const orderNumbers = new Map<string, string>(
        ((ordersRes as any).data || []).map((o: any) => [o.id, o.order_number]),
      );
      return { notes, linesByNote, orderNumbers };
    },
  });

  // ---- Paiements débloqués ---------------------------------------------
  const releasesQuery = useQuery({
    queryKey: ["vendor-tracking-payment-releases", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_payment_releases")
        .select("id, delivery_note_id, decision, authorized_amount_ht_cents, reason, decided_at")
        .eq("vendor_id", vendorId!)
        .order("decided_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // ---- Remises en stock (lots ReStock) ---------------------------------
  const restockQuery = useQuery({
    queryKey: ["vendor-tracking-restock-offers"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return [];
      const { data: seller } = await supabase
        .from("restock_buyers")
        .select("id")
        .eq("auth_user_id", uid)
        .maybeSingle();
      if (!seller?.id) return [];
      const { data, error } = await supabase
        .from("restock_offers")
        .select("id, designation, ean, cnk, quantity, price_ht, dlu, status, lot_number, created_at, updated_at")
        .eq("seller_id", seller.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const noteNumberById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of notesQuery.data?.notes || []) m.set(n.id, n.document_number);
    return m;
  }, [notesQuery.data]);

  const q = search.trim().toLowerCase();

  const filteredOrders = useMemo(
    () => (ordersQuery.data || []).filter((o) => !q || (o.order_number || "").toLowerCase().includes(q)),
    [ordersQuery.data, q],
  );

  const filteredNotes = useMemo(() => {
    const notes = notesQuery.data?.notes || [];
    if (!q) return notes;
    return notes.filter((n) => {
      const on = notesQuery.data?.orderNumbers.get(n.order_id) || "";
      return (
        (n.document_number || "").toLowerCase().includes(q) ||
        on.toLowerCase().includes(q) ||
        (n.tracking_number || "").toLowerCase().includes(q)
      );
    });
  }, [notesQuery.data, q]);

  const filteredReleases = useMemo(() => {
    const rows = releasesQuery.data || [];
    if (!q) return rows;
    return rows.filter((r) => (noteNumberById.get(r.delivery_note_id) || "").toLowerCase().includes(q));
  }, [releasesQuery.data, q, noteNumberById]);

  // Retours / refus à réintégrer : lignes de BL avec refus + BL annulés
  const returns = useMemo(() => {
    const notes = notesQuery.data?.notes || [];
    const linesByNote = notesQuery.data?.linesByNote;
    const rows: Array<{
      key: string;
      note_number: string;
      order_number: string;
      kind: "refus" | "annulation";
      units: number;
      reason: string | null;
      at: string | null;
    }> = [];
    for (const n of notes) {
      const orderNumber = notesQuery.data?.orderNumbers.get(n.order_id) || "—";
      if (n.status === "cancelled" || n.cancelled_at) {
        const units = (linesByNote?.get(n.id) || []).reduce((s, l) => s + (l.quantity ?? 0), 0);
        rows.push({
          key: `cancel-${n.id}`,
          note_number: n.document_number,
          order_number: orderNumber,
          kind: "annulation",
          units,
          reason: n.cancellation_reason ?? null,
          at: n.cancelled_at ?? n.issued_at ?? null,
        });
        continue;
      }
      for (const l of linesByNote?.get(n.id) || []) {
        if ((l.refused_quantity ?? 0) > 0) {
          rows.push({
            key: `refus-${l.id}`,
            note_number: n.document_number,
            order_number: orderNumber,
            kind: "refus",
            units: l.refused_quantity,
            reason: l.refusal_reason ?? null,
            at: n.confirmed_at ?? n.issued_at ?? null,
          });
        }
      }
    }
    return rows
      .filter((r) => !q || r.note_number.toLowerCase().includes(q) || r.order_number.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
  }, [notesQuery.data, q]);

  const filteredRestock = useMemo(() => {
    const rows = restockQuery.data || [];
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.designation || "").toLowerCase().includes(q) ||
        (r.ean || "").toLowerCase().includes(q) ||
        (r.cnk || "").toLowerCase().includes(q),
    );
  }, [restockQuery.data, q]);

  const loading =
    vendorQuery.isLoading ||
    ordersQuery.isLoading ||
    notesQuery.isLoading ||
    releasesQuery.isLoading ||
    restockQuery.isLoading;

  const releasedTotalCents = (releasesQuery.data || [])
    .filter((r) => r.decision === "full" || r.decision === "partial")
    .reduce((s, r) => s + (r.authorized_amount_ht_cents ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suivi</h1>
          <p className="text-sm text-muted-foreground">
            Commandes reçues, bons de livraison, paiements débloqués et remises en stock.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (commande, BL, produit…)"
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <VCard className="p-4">
          <p className="text-xs text-muted-foreground">Commandes reçues</p>
          <p className="text-xl font-semibold">{(ordersQuery.data || []).length}</p>
        </VCard>
        <VCard className="p-4">
          <p className="text-xs text-muted-foreground">Bons de livraison</p>
          <p className="text-xl font-semibold">{(notesQuery.data?.notes || []).length}</p>
        </VCard>
        <VCard className="p-4">
          <p className="text-xs text-muted-foreground">Paiements débloqués (HT)</p>
          <p className="text-xl font-semibold">{fmtEurFromCents(releasedTotalCents)}</p>
        </VCard>
        <VCard className="p-4">
          <p className="text-xs text-muted-foreground">Lots ReStock</p>
          <p className="text-xl font-semibold">{(restockQuery.data || []).length}</p>
        </VCard>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={16} /> Chargement du suivi…
        </div>
      ) : (
        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Commandes reçues</TabsTrigger>
            <TabsTrigger value="notes">Bons de livraison</TabsTrigger>
            <TabsTrigger value="releases">Paiements débloqués</TabsTrigger>
            <TabsTrigger value="restock">Remises en stock</TabsTrigger>
          </TabsList>

          {/* Commandes reçues */}
          <TabsContent value="orders" className="mt-4">
            <VCard className="p-4">
              {filteredOrders.length === 0 ? (
                <VEmptyState icon="ShoppingCart" title="Aucune commande" description="Aucune commande reçue pour le moment." />
              ) : (
                filteredOrders.map((o) => {
                  const st = ORDER_STATUS[o.status] || { label: o.status, color: "default" as BadgeColor };
                  return (
                    <Row key={o.order_id}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Link to={`/vendor/commandes/${o.order_id}`} className="font-medium hover:underline">
                            {o.order_number}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {formatUpdatedAt(o.created_at)} · {o.lines} ligne(s) · {o.units_shipped}/{o.units} unité(s) expédiée(s)
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{fmtEur(o.total_ht)} HT</span>
                          <VBadge color={st.color}>{st.label}</VBadge>
                        </div>
                      </div>
                    </Row>
                  );
                })
              )}
            </VCard>
          </TabsContent>

          {/* Bons de livraison */}
          <TabsContent value="notes" className="mt-4">
            <VCard className="p-4">
              {filteredNotes.length === 0 ? (
                <VEmptyState icon="FileText" title="Aucun bon de livraison" description="Aucun bon de livraison émis sur vos commandes." />
              ) : (
                filteredNotes.map((n) => {
                  const lines = notesQuery.data?.linesByNote.get(n.id) || [];
                  const units = lines.reduce((s, l) => s + (l.quantity ?? 0), 0);
                  const refused = lines.reduce((s, l) => s + (l.refused_quantity ?? 0), 0);
                  const cancelled = n.status === "cancelled" || !!n.cancelled_at;
                  return (
                    <Row key={n.id}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {n.document_number}
                            <span className="ml-2 text-xs text-muted-foreground">
                              commande {notesQuery.data?.orderNumbers.get(n.order_id) || "—"}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Émis le {formatUpdatedAt(n.issued_at)} · {units} unité(s)
                            {refused > 0 && ` · ${refused} refusée(s)`}
                            {n.carrier && ` · ${n.carrier}`}
                            {n.tracking_number && ` · suivi ${n.tracking_number}`}
                          </p>
                          {n.confirmed_at && (
                            <p className="text-xs text-muted-foreground">
                              Signé le {formatUpdatedAt(n.confirmed_at)}
                              {n.confirmed_by_name && ` par ${n.confirmed_by_name}`}
                              {n.client_remarks && ` — « ${n.client_remarks} »`}
                            </p>
                          )}
                          {cancelled && n.cancellation_reason && (
                            <p className="text-xs text-muted-foreground">Annulé : {n.cancellation_reason}</p>
                          )}
                        </div>
                        <VBadge color={cancelled ? "default" : n.confirmed_at ? "success" : "info"}>
                          {cancelled ? "Annulé" : n.confirmed_at ? "Signé" : "En attente de signature"}
                        </VBadge>
                      </div>
                    </Row>
                  );
                })
              )}
            </VCard>
          </TabsContent>

          {/* Paiements débloqués */}
          <TabsContent value="releases" className="mt-4">
            <VCard className="p-4">
              {filteredReleases.length === 0 ? (
                <VEmptyState icon="Banknote" title="Aucun déblocage" description="Aucune décision de paiement enregistrée." />
              ) : (
                filteredReleases.map((r) => {
                  const d = RELEASE_DECISION[r.decision] || { label: r.decision, color: "default" as BadgeColor };
                  return (
                    <Row key={r.id}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{noteNumberById.get(r.delivery_note_id) || "Bon de livraison"}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.decided_at ? formatUpdatedAt(r.decided_at) : "—"}
                            {r.reason && ` · ${r.reason}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {fmtEurFromCents(r.authorized_amount_ht_cents ?? 0)} HT
                          </span>
                          <VBadge color={d.color}>{d.label}</VBadge>
                        </div>
                      </div>
                    </Row>
                  );
                })
              )}
            </VCard>
          </TabsContent>

          {/* Remises en stock */}
          <TabsContent value="restock" className="mt-4 space-y-4">
            <VCard className="p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <RotateCcw size={16} /> Mes lots ReStock
              </h2>
              {filteredRestock.length === 0 ? (
                <VEmptyState icon="Truck" title="Aucun lot" description="Aucun lot de déstockage publié avec ce compte." />
              ) : (
                filteredRestock.map((r) => {
                  const st = RESTOCK_STATUS[r.status] || { label: r.status, color: "default" as BadgeColor };
                  return (
                    <Row key={r.id}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{r.designation}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.ean || r.cnk || "—"} · {r.quantity} unité(s)
                            {r.lot_number && ` · lot ${r.lot_number}`}
                            {r.dlu && ` · DLU ${formatUpdatedAt(r.dlu)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{fmtEur(Number(r.price_ht ?? 0))} HT</span>
                          <VBadge color={st.color}>{st.label}</VBadge>
                        </div>
                      </div>
                    </Row>
                  );
                })
              )}
            </VCard>

            <VCard className="p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <PackageX size={16} /> Retours à réintégrer
              </h2>
              {returns.length === 0 ? (
                <VEmptyState
                  icon="PackageX"
                  title="Aucun retour"
                  description="Aucune unité refusée ni bon de livraison annulé à réintégrer."
                />
              ) : (
                returns.map((r) => (
                  <Row key={r.key}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {r.note_number}
                          <span className="ml-2 text-xs text-muted-foreground">commande {r.order_number}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.at ? formatUpdatedAt(r.at) : "—"} · {r.units} unité(s)
                          {r.reason && ` · ${r.reason}`}
                        </p>
                      </div>
                      <VBadge color={r.kind === "annulation" ? "default" : "warning"}>
                        {r.kind === "annulation" ? "BL annulé" : "Unités refusées"}
                      </VBadge>
                    </div>
                  </Row>
                ))
              )}
            </VCard>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
