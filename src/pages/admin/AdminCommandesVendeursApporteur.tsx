// Admin — Commandes vendeurs par apporteur : bon de livraison, signature de réception,
// statut de paiement et déblocage du versement fournisseur.
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
import { ExternalLink, FileSignature, Handshake, PenLine, Search } from "lucide-react";

type Row = {
  key: string;
  orderId: string;
  orderNumber: string | null;
  orderCreatedAt: string | null;
  vendorId: string | null;
  vendorName: string;
  subOrderStatus: string | null;
  subOrderPaymentStatus: string | null;
  subtotalInclVat: number | null;
  affiliateId: string | null;
  affiliateLabel: string | null;
  deliveryNoteNumber: string | null;
  deliveryNoteStatus: string | null;
  confirmedAt: string | null;
  confirmedByName: string | null;
  signaturePath: string | null;
  releaseDecision: string | null;
  releaseDecidedAt: string | null;
};

const RELEASE_LABEL: Record<string, string> = {
  full: "Versement complet",
  partial: "Versement partiel",
  none: "Versement bloqué",
};

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-BE") : "—");
const fmtDateTime = (v: string | null) => (v ? new Date(v).toLocaleString("fr-BE") : "—");

export default function AdminCommandesVendeursApporteur() {
  const [search, setSearch] = useState("");
  const [affiliateFilter, setAffiliateFilter] = useState("all");
  const [releaseFilter, setReleaseFilter] = useState("all");

  const { data: rows = [], isLoading, error } = useQuery<Row[]>({
    queryKey: ["admin-vendor-orders-by-affiliate"],
    queryFn: async () => {
      const { data: subs, error: subErr } = await supabase
        .from("sub_orders")
        .select(
          "id, order_id, vendor_id, status, payment_status, subtotal_incl_vat, created_at, vendors(name, company_name), orders(order_number, created_at)"
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (subErr) throw subErr;

      const orderIds = Array.from(new Set((subs ?? []).map((s: any) => s.order_id).filter(Boolean)));
      if (orderIds.length === 0) return [];

      const [notesRes, commRes] = await Promise.all([
        supabase
          .from("delivery_notes")
          .select(
            "id, order_id, vendor_id, document_number, status, confirmed_at, confirmed_by_name, signature_storage_path, issued_at"
          )
          .in("order_id", orderIds),
        supabase
          .from("affiliate_commissions")
          .select("order_id, affiliate_id, status, affiliates(affiliate_code, display_name, company_name)")
          .in("order_id", orderIds),
      ]);
      if (notesRes.error) throw notesRes.error;
      if (commRes.error) throw commRes.error;

      const noteIds = (notesRes.data ?? []).map((n: any) => n.id);
      let releases: any[] = [];
      if (noteIds.length > 0) {
        const { data: rel, error: relErr } = await supabase
          .from("delivery_payment_releases")
          .select("delivery_note_id, decision, decided_at")
          .in("delivery_note_id", noteIds);
        if (relErr) throw relErr;
        releases = rel ?? [];
      }

      const releaseByNote = new Map<string, any>();
      for (const r of releases) {
        const prev = releaseByNote.get(r.delivery_note_id);
        if (!prev || (r.decided_at ?? "") > (prev.decided_at ?? "")) releaseByNote.set(r.delivery_note_id, r);
      }

      const noteByKey = new Map<string, any>();
      for (const n of notesRes.data ?? []) {
        if (n.status === "cancelled") continue;
        const key = `${n.order_id}|${n.vendor_id ?? ""}`;
        const prev = noteByKey.get(key);
        if (!prev || (n.issued_at ?? "") > (prev.issued_at ?? "")) noteByKey.set(key, n);
      }

      const affByOrder = new Map<string, any>();
      for (const c of commRes.data ?? []) {
        if (c.status === "cancelled") continue;
        if (!affByOrder.has(c.order_id)) affByOrder.set(c.order_id, c);
      }

      return (subs ?? []).map((s: any) => {
        const note = noteByKey.get(`${s.order_id}|${s.vendor_id ?? ""}`) ?? null;
        const rel = note ? releaseByNote.get(note.id) ?? null : null;
        const comm = affByOrder.get(s.order_id) ?? null;
        const aff = comm?.affiliates ?? null;
        return {
          key: s.id,
          orderId: s.order_id,
          orderNumber: s.orders?.order_number ?? null,
          orderCreatedAt: s.orders?.created_at ?? s.created_at ?? null,
          vendorId: s.vendor_id ?? null,
          vendorName: s.vendors?.company_name || s.vendors?.name || "—",
          subOrderStatus: s.status ?? null,
          subOrderPaymentStatus: s.payment_status ?? null,
          subtotalInclVat: s.subtotal_incl_vat != null ? Number(s.subtotal_incl_vat) : null,
          affiliateId: comm?.affiliate_id ?? null,
          affiliateLabel: aff
            ? `${aff.display_name || aff.company_name || "Apporteur"} (${aff.affiliate_code})`
            : null,
          deliveryNoteNumber: note?.document_number ?? null,
          deliveryNoteStatus: note?.status ?? null,
          confirmedAt: note?.confirmed_at ?? null,
          confirmedByName: note?.confirmed_by_name ?? null,
          signaturePath: note?.signature_storage_path ?? null,
          releaseDecision: rel?.decision ?? null,
          releaseDecidedAt: rel?.decided_at ?? null,
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
      if (affiliateFilter === "none" ? r.affiliateId != null : affiliateFilter !== "all" && r.affiliateId !== affiliateFilter)
        return false;
      if (releaseFilter === "released" && r.releaseDecision == null) return false;
      if (releaseFilter === "pending" && r.releaseDecision != null) return false;
      if (releaseFilter === "signed" && !r.confirmedAt) return false;
      if (releaseFilter === "unsigned" && r.confirmedAt) return false;
      if (!q) return true;
      return [r.orderNumber, r.vendorName, r.deliveryNoteNumber, r.affiliateLabel]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, affiliateFilter, releaseFilter]);

  const openSignature = async (path: string) => {
    const { data, error } = await supabase.storage.from("delivery-signatures").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error("Signature indisponible");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div>
      <AdminTopBar
        title="Commandes vendeurs par apporteur"
        subtitle="Bon de livraison, signature de réception et statut de paiement"
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Commande, vendeur, BL, apporteur…"
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
        <Select value={releaseFilter} onValueChange={setReleaseFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="État" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les états</SelectItem>
            <SelectItem value="signed">Réception signée</SelectItem>
            <SelectItem value="unsigned">Réception non signée</SelectItem>
            <SelectItem value="released">Versement décidé</SelectItem>
            <SelectItem value="pending">Versement en attente</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">{filtered.length} ligne(s)</span>
      </div>

      {error && <div className="p-4 text-sm text-red-600">Chargement impossible : {(error as any).message}</div>}

      <div className="bg-white border rounded-lg overflow-x-auto" style={{ borderColor: "#E2E8F0" }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: "#F8FAFC" }}>
            <tr className="text-[11px] uppercase font-semibold text-slate-500">
              <th className="text-left px-3 py-2">Commande</th>
              <th className="text-left px-3 py-2">Vendeur</th>
              <th className="text-left px-3 py-2">Apporteur</th>
              <th className="text-left px-3 py-2">Bon de livraison</th>
              <th className="text-left px-3 py-2">Signature</th>
              <th className="text-left px-3 py-2">Paiement</th>
              <th className="text-right px-3 py-2">Montant TVAC</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                  Chargement…
                </td>
              </tr>
            )}
            {!isLoading &&
              filtered.map((r) => (
                <tr key={r.key} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.orderNumber ?? "—"}</div>
                    <div className="text-xs text-slate-500">{fmtDate(r.orderCreatedAt)}</div>
                  </td>
                  <td className="px-3 py-2">{r.vendorName}</td>
                  <td className="px-3 py-2">
                    {r.affiliateLabel ? (
                      <span className="inline-flex items-center gap-1">
                        <Handshake size={12} className="text-slate-400" /> {r.affiliateLabel}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.deliveryNoteNumber ? (
                      <>
                        <div className="font-medium">{r.deliveryNoteNumber}</div>
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
                  <td className="px-3 py-2">
                    <div>{r.subOrderPaymentStatus ?? "—"}</div>
                    {r.releaseDecision ? (
                      <div className="text-xs text-slate-500">
                        {RELEASE_LABEL[r.releaseDecision] ?? r.releaseDecision} · {fmtDate(r.releaseDecidedAt)}
                      </div>
                    ) : (
                      <div className="text-xs text-amber-700">Versement en attente</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.subtotalInclVat != null ? `${fmtEur(r.subtotalInclVat)} €` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/commandes/${r.orderId}`}>
                        <ExternalLink size={12} className="mr-1" /> Ouvrir
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                  Aucune commande vendeur ne correspond à ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
