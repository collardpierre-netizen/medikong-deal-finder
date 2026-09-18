// Admin — Parcours complet par apporteur : offres du devis, devis, commande,
// bon de livraison et signature de réception. Lecture seule.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fmtEur } from "@/lib/format-currency";
import { ExternalLink, FileSignature, FileText, Handshake, PenLine, Search, Tag } from "lucide-react";

type Row = {
  key: string;
  affiliateId: string | null;
  affiliateLabel: string | null;
  customerLabel: string;
  quoteId: string | null;
  quoteNumber: string | null;
  quoteStatus: string | null;
  quoteCreatedAt: string | null;
  offerLines: number;
  offerLinked: number;
  orderId: string | null;
  orderNumber: string | null;
  orderCreatedAt: string | null;
  orderStatus: string | null;
  orderPaymentStatus: string | null;
  amountInclVat: number | null;
  deliveryNoteNumber: string | null;
  deliveryNoteStatus: string | null;
  confirmedAt: string | null;
  confirmedByName: string | null;
  signaturePath: string | null;
};

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-BE") : "—");
const fmtDateTime = (v: string | null) => (v ? new Date(v).toLocaleString("fr-BE") : "—");

export default function AdminParcoursApporteur() {
  const [search, setSearch] = useState("");
  const [affiliateFilter, setAffiliateFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");

  const { data: rows = [], isLoading, error } = useQuery<Row[]>({
    queryKey: ["admin-parcours-apporteur"],
    queryFn: async () => {
      const [quotesRes, commRes, refRes] = await Promise.all([
        supabase
          .from("quotes")
          .select(
            "id, quote_number, status, created_at, order_id, customer_id, total_ttc_cents, quote_lines(id, offer_id), customers(company_name, email, auth_user_id)"
          )
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("affiliate_commissions")
          .select("order_id, affiliate_id, status, affiliates(affiliate_code, display_name, company_name)")
          .limit(2000),
        supabase
          .from("affiliate_referrals")
          .select("user_id, affiliate_id, status, affiliates(affiliate_code, display_name, company_name)")
          .limit(2000),
      ]);
      if (quotesRes.error) throw quotesRes.error;
      if (commRes.error) throw commRes.error;
      if (refRes.error) throw refRes.error;

      const quotes = quotesRes.data ?? [];
      const orderIds = Array.from(new Set(quotes.map((q: any) => q.order_id).filter(Boolean)));

      let orders: any[] = [];
      let notes: any[] = [];
      if (orderIds.length > 0) {
        const [ordersRes, notesRes] = await Promise.all([
          supabase
            .from("orders")
            .select("id, order_number, created_at, status, payment_status, total_incl_vat")
            .in("id", orderIds),
          supabase
            .from("delivery_notes")
            .select("id, order_id, document_number, status, issued_at, confirmed_at, confirmed_by_name, signature_storage_path")
            .in("order_id", orderIds),
        ]);
        if (ordersRes.error) throw ordersRes.error;
        if (notesRes.error) throw notesRes.error;
        orders = ordersRes.data ?? [];
        notes = notesRes.data ?? [];
      }

      const orderById = new Map(orders.map((o: any) => [o.id, o]));

      const noteByOrder = new Map<string, any>();
      for (const n of notes) {
        if (n.status === "cancelled") continue;
        const prev = noteByOrder.get(n.order_id);
        if (!prev || (n.issued_at ?? "") > (prev.issued_at ?? "")) noteByOrder.set(n.order_id, n);
      }

      const affByOrder = new Map<string, any>();
      for (const c of commRes.data ?? []) {
        if (c.status === "cancelled") continue;
        if (!affByOrder.has(c.order_id)) affByOrder.set(c.order_id, c);
      }
      const affByUser = new Map<string, any>();
      for (const r of refRes.data ?? []) {
        if (!r.user_id) continue;
        if (!affByUser.has(r.user_id)) affByUser.set(r.user_id, r);
      }

      const labelOf = (aff: any) =>
        aff ? `${aff.display_name || aff.company_name || "Apporteur"} (${aff.affiliate_code})` : null;

      return quotes.map((q: any) => {
        const order = q.order_id ? orderById.get(q.order_id) ?? null : null;
        const note = q.order_id ? noteByOrder.get(q.order_id) ?? null : null;
        const link = (q.order_id ? affByOrder.get(q.order_id) : null) ?? affByUser.get(q.customers?.auth_user_id) ?? null;
        const lines = q.quote_lines ?? [];
        return {
          key: q.id,
          affiliateId: link?.affiliate_id ?? null,
          affiliateLabel: labelOf(link?.affiliates),
          customerLabel: q.customers?.company_name || q.customers?.email || "—",
          quoteId: q.id,
          quoteNumber: q.quote_number ?? null,
          quoteStatus: q.status ?? null,
          quoteCreatedAt: q.created_at ?? null,
          offerLines: lines.length,
          offerLinked: lines.filter((l: any) => l.offer_id).length,
          orderId: order?.id ?? q.order_id ?? null,
          orderNumber: order?.order_number ?? null,
          orderCreatedAt: order?.created_at ?? null,
          orderStatus: order?.status ?? null,
          orderPaymentStatus: order?.payment_status ?? null,
          amountInclVat:
            order?.total_incl_vat != null
              ? Number(order.total_incl_vat)
              : q.total_ttc_cents != null
              ? Number(q.total_ttc_cents) / 100
              : null,
          deliveryNoteNumber: note?.document_number ?? null,
          deliveryNoteStatus: note?.status ?? null,
          confirmedAt: note?.confirmed_at ?? null,
          confirmedByName: note?.confirmed_by_name ?? null,
          signaturePath: note?.signature_storage_path ?? null,
        } as Row;
      });
    },
  });

  const affiliates = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.affiliateId && r.affiliateLabel) m.set(r.affiliateId, r.affiliateLabel);
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (affiliateFilter === "none") {
        if (r.affiliateId != null) return false;
      } else if (affiliateFilter !== "all" && r.affiliateId !== affiliateFilter) return false;

      if (stageFilter === "quote_only" && r.orderId) return false;
      if (stageFilter === "order" && !r.orderId) return false;
      if (stageFilter === "no_delivery" && r.deliveryNoteNumber) return false;
      if (stageFilter === "signed" && !r.confirmedAt) return false;
      if (stageFilter === "unsigned" && r.confirmedAt) return false;

      if (!q) return true;
      return [r.quoteNumber, r.orderNumber, r.customerLabel, r.deliveryNoteNumber, r.affiliateLabel]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, affiliateFilter, stageFilter]);

  const openSignature = async (path: string) => {
    const { data, error: sigErr } = await supabase.storage.from("delivery-signatures").createSignedUrl(path, 300);
    if (sigErr || !data?.signedUrl) {
      toast.error("Signature indisponible");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div>
      <AdminTopBar
        title="Parcours par apporteur"
        subtitle="Offres, devis, commandes, bons de livraison et signatures"
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Devis, commande, client, BL, apporteur…"
            className="pl-8 w-72"
          />
        </div>
        <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Apporteur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les apporteurs</SelectItem>
            <SelectItem value="none">Sans apporteur</SelectItem>
            {affiliates.map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Étape" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les étapes</SelectItem>
            <SelectItem value="quote_only">Devis sans commande</SelectItem>
            <SelectItem value="order">Converti en commande</SelectItem>
            <SelectItem value="no_delivery">Sans bon de livraison</SelectItem>
            <SelectItem value="signed">Réception signée</SelectItem>
            <SelectItem value="unsigned">Réception non signée</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">{filtered.length} ligne(s)</span>
      </div>

      {error && <div className="p-4 text-sm text-red-600">Chargement impossible : {(error as any).message}</div>}

      <div className="bg-white border rounded-lg overflow-x-auto" style={{ borderColor: "#E2E8F0" }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: "#F8FAFC" }}>
            <tr className="text-[11px] uppercase font-semibold text-slate-500">
              <th className="text-left px-3 py-2">Apporteur</th>
              <th className="text-left px-3 py-2">Client</th>
              <th className="text-left px-3 py-2">Offres</th>
              <th className="text-left px-3 py-2">Devis</th>
              <th className="text-left px-3 py-2">Commande</th>
              <th className="text-left px-3 py-2">Bon de livraison</th>
              <th className="text-left px-3 py-2">Signature</th>
              <th className="text-right px-3 py-2">Montant TVAC</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                  Chargement…
                </td>
              </tr>
            )}
            {!isLoading &&
              filtered.map((r) => (
                <tr key={r.key} className="border-t">
                  <td className="px-3 py-2">
                    {r.affiliateLabel ? (
                      <span className="inline-flex items-center gap-1">
                        <Handshake size={12} className="text-slate-400" /> {r.affiliateLabel}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.customerLabel}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      <Tag size={12} className="text-slate-400" />
                      {r.offerLines} ligne(s)
                    </span>
                    <div className="text-xs text-slate-500">{r.offerLinked} liée(s) à une offre</div>
                  </td>
                  <td className="px-3 py-2">
                    {r.quoteNumber ? (
                      <>
                        <Link to={`/admin/devis/${r.quoteId}`} className="font-medium text-sky-700 hover:underline">
                          {r.quoteNumber}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {r.quoteStatus ?? "—"} · {fmtDate(r.quoteCreatedAt)}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.orderId ? (
                      <>
                        <div className="font-medium">{r.orderNumber ?? "—"}</div>
                        <div className="text-xs text-slate-500">
                          {r.orderStatus ?? "—"} · {r.orderPaymentStatus ?? "—"}
                        </div>
                        <div className="text-xs text-slate-500">{fmtDate(r.orderCreatedAt)}</div>
                      </>
                    ) : (
                      <Badge variant="outline">Pas encore commandé</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.deliveryNoteNumber ? (
                      <>
                        <div className="font-medium inline-flex items-center gap-1">
                          <FileText size={12} className="text-slate-400" /> {r.deliveryNoteNumber}
                        </div>
                        <div className="text-xs text-slate-500">{r.deliveryNoteStatus ?? "—"}</div>
                      </>
                    ) : (
                      <Badge variant="outline">Aucun BL</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.confirmedAt ? (
                      <div className="space-y-0.5">
                        <div className="inline-flex items-center gap-1 text-emerald-700">
                          <FileSignature size={12} /> Signée
                        </div>
                        <div className="text-xs text-slate-500">
                          {r.confirmedByName || "—"} · {fmtDateTime(r.confirmedAt)}
                        </div>
                        {r.signaturePath && (
                          <button
                            type="button"
                            onClick={() => openSignature(r.signaturePath!)}
                            className="text-xs text-sky-600 hover:underline inline-flex items-center gap-1"
                          >
                            <PenLine size={11} /> Voir la signature
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">Non signée</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.amountInclVat != null ? `${fmtEur(r.amountInclVat)} €` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.orderId ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/commandes/${r.orderId}`}>
                          <ExternalLink size={12} className="mr-1" /> Commande
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/devis/${r.quoteId}`}>
                          <ExternalLink size={12} className="mr-1" /> Devis
                        </Link>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                  Aucun parcours ne correspond à ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
