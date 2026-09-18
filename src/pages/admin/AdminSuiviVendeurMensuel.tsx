// Admin — Suivi vendeur par mois : commandes, bons de livraison, paiements débloqués
// et montant HTVA par commande. Lecture seule.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtEur } from "@/lib/format-currency";
import { ChevronDown, ChevronRight, ExternalLink, Search } from "lucide-react";

type OrderRow = {
  orderId: string;
  orderNumber: string | null;
  createdAt: string | null;
  totalHt: number;
  lines: number;
  deliveryNotes: string[];
  signedNotes: number;
  releasedHt: number;
  releaseDecisions: string[];
};

type GroupRow = {
  key: string;
  month: string;
  vendorId: string | null;
  vendorName: string;
  orders: OrderRow[];
  ordersCount: number;
  totalHt: number;
  notesCount: number;
  signedCount: number;
  releasesCount: number;
  releasedHt: number;
};

const DECISION_LABEL: Record<string, string> = {
  full: "Complet",
  partial: "Partiel",
  none: "Aucun",
  blocked: "Bloqué",
};

const monthKey = (v: string | null) => (v ? v.slice(0, 7) : "—");
const monthLabel = (m: string) => {
  if (m === "—") return "Sans date";
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString("fr-BE", { month: "long", year: "numeric" });
};
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-BE") : "—");

export default function AdminSuiviVendeurMensuel() {
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: groups = [], isLoading, error } = useQuery<GroupRow[]>({
    queryKey: ["admin-vendor-monthly-tracking"],
    queryFn: async () => {
      const { data: lines, error: linesErr } = await supabase
        .from("order_lines")
        .select(
          "order_id, vendor_id, line_total_excl_vat, vendors(name, company_name), orders(order_number, created_at)"
        )
        .not("vendor_id", "is", null)
        .limit(5000);
      if (linesErr) throw linesErr;

      const orderIds = Array.from(new Set((lines ?? []).map((l: any) => l.order_id).filter(Boolean)));

      let notes: any[] = [];
      let releases: any[] = [];
      if (orderIds.length > 0) {
        const { data: noteData, error: noteErr } = await supabase
          .from("delivery_notes")
          .select("id, order_id, vendor_id, document_number, status, issued_at, confirmed_at")
          .in("order_id", orderIds);
        if (noteErr) throw noteErr;
        notes = noteData ?? [];

        const noteIds = notes.map((n) => n.id);
        if (noteIds.length > 0) {
          const { data: relData, error: relErr } = await supabase
            .from("delivery_payment_releases")
            .select("delivery_note_id, vendor_id, decision, authorized_amount_ht_cents, decided_at")
            .in("delivery_note_id", noteIds);
          if (relErr) throw relErr;
          releases = relData ?? [];
        }
      }

      const notesById = new Map<string, any>(notes.map((n) => [n.id, n]));
      const relByNote = new Map<string, any[]>();
      for (const r of releases) {
        const arr = relByNote.get(r.delivery_note_id) ?? [];
        arr.push(r);
        relByNote.set(r.delivery_note_id, arr);
      }
      const notesByOrderVendor = new Map<string, any[]>();
      for (const n of notes) {
        const k = `${n.order_id}|${n.vendor_id ?? ""}`;
        const arr = notesByOrderVendor.get(k) ?? [];
        arr.push(n);
        notesByOrderVendor.set(k, arr);
      }

      // Agrégat par vendeur × mois × commande (HTVA depuis les lignes du vendeur)
      const byGroup = new Map<string, GroupRow>();
      const byOrder = new Map<string, OrderRow>();

      for (const l of (lines ?? []) as any[]) {
        const createdAt = l.orders?.created_at ?? null;
        const month = monthKey(createdAt);
        const vendorId = l.vendor_id ?? null;
        const vendorName = l.vendors?.company_name || l.vendors?.name || "—";
        const gKey = `${month}|${vendorId ?? ""}`;
        let group = byGroup.get(gKey);
        if (!group) {
          group = {
            key: gKey,
            month,
            vendorId,
            vendorName,
            orders: [],
            ordersCount: 0,
            totalHt: 0,
            notesCount: 0,
            signedCount: 0,
            releasesCount: 0,
            releasedHt: 0,
          };
          byGroup.set(gKey, group);
        }

        const oKey = `${gKey}|${l.order_id}`;
        let order = byOrder.get(oKey);
        if (!order) {
          const relatedNotes = (notesByOrderVendor.get(`${l.order_id}|${vendorId ?? ""}`) ?? []).filter(
            (n) => n.status !== "cancelled"
          );
          const decisions: string[] = [];
          let releasedHt = 0;
          for (const n of relatedNotes) {
            for (const r of relByNote.get(n.id) ?? []) {
              decisions.push(r.decision);
              releasedHt += (r.authorized_amount_ht_cents ?? 0) / 100;
            }
          }
          order = {
            orderId: l.order_id,
            orderNumber: l.orders?.order_number ?? null,
            createdAt,
            totalHt: 0,
            lines: 0,
            deliveryNotes: relatedNotes.map((n) => n.document_number).filter(Boolean),
            signedNotes: relatedNotes.filter((n) => !!n.confirmed_at).length,
            releasedHt,
            releaseDecisions: decisions,
          };
          byOrder.set(oKey, order);
          group.orders.push(order);
          group.ordersCount += 1;
          group.notesCount += relatedNotes.length;
          group.signedCount += order.signedNotes;
          group.releasesCount += decisions.length;
          group.releasedHt += releasedHt;
        }
        order.lines += 1;
        order.totalHt += Number(l.line_total_excl_vat ?? 0);
        group.totalHt += Number(l.line_total_excl_vat ?? 0);
      }

      const result = Array.from(byGroup.values());
      for (const g of result) {
        g.orders.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
      }
      result.sort(
        (a, b) => b.month.localeCompare(a.month) || a.vendorName.localeCompare(b.vendorName)
      );
      return result;
    },
  });

  const months = useMemo(() => {
    const s = new Set(groups.map((g) => g.month));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [groups]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (monthFilter !== "all" && g.month !== monthFilter) return false;
      if (!q) return true;
      if (g.vendorName.toLowerCase().includes(q)) return true;
      return g.orders.some((o) => String(o.orderNumber ?? "").toLowerCase().includes(q));
    });
  }, [groups, search, monthFilter]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, g) => ({
          orders: acc.orders + g.ordersCount,
          notes: acc.notes + g.notesCount,
          releases: acc.releases + g.releasesCount,
          ht: acc.ht + g.totalHt,
          releasedHt: acc.releasedHt + g.releasedHt,
        }),
        { orders: 0, notes: 0, releases: 0, ht: 0, releasedHt: 0 }
      ),
    [filtered]
  );

  return (
    <div>
      <AdminTopBar
        title="Suivi vendeur par mois"
        subtitle="Commandes, bons de livraison, paiements débloqués et montant HTVA par commande"
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vendeur ou n° de commande…"
            className="pl-8 w-72"
          />
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Mois" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les mois</SelectItem>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {monthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">
          {filtered.length} ligne(s) · {totals.orders} commande(s) · {totals.notes} BL · {totals.releases} déblocage(s)
          · {fmtEur(totals.ht)} HTVA · {fmtEur(totals.releasedHt)} débloqués
        </span>
      </div>

      {error && <div className="p-4 text-sm text-red-600">Chargement impossible : {(error as any).message}</div>}

      <div className="bg-white border rounded-lg overflow-x-auto" style={{ borderColor: "#E2E8F0" }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: "#F8FAFC" }}>
            <tr className="text-[11px] uppercase font-semibold text-slate-500">
              <th className="px-3 py-2 w-8"></th>
              <th className="text-left px-3 py-2">Mois</th>
              <th className="text-left px-3 py-2">Vendeur</th>
              <th className="text-right px-3 py-2">Commandes</th>
              <th className="text-right px-3 py-2">Bons de livraison</th>
              <th className="text-right px-3 py-2">Paiements débloqués</th>
              <th className="text-right px-3 py-2">Montant débloqué (HT)</th>
              <th className="text-right px-3 py-2">Total HTVA</th>
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
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                  Aucune donnée
                </td>
              </tr>
            )}
            {filtered.map((g) => {
              const open = !!expanded[g.key];
              return (
                <Fragment key={g.key}>
                  <tr className="border-t" style={{ borderColor: "#E2E8F0" }}>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setExpanded((p) => ({ ...p, [g.key]: !open }))}
                        aria-label={open ? "Masquer les commandes" : "Voir les commandes"}
                      >
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </Button>
                    </td>
                    <td className="px-3 py-2 capitalize">{monthLabel(g.month)}</td>
                    <td className="px-3 py-2 font-medium">{g.vendorName}</td>
                    <td className="px-3 py-2 text-right">{g.ordersCount}</td>
                    <td className="px-3 py-2 text-right">
                      {g.notesCount}
                      {g.signedCount > 0 && (
                        <span className="text-slate-500"> · {g.signedCount} signé(s)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{g.releasesCount}</td>
                    <td className="px-3 py-2 text-right">{fmtEur(g.releasedHt)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtEur(g.totalHt)}</td>
                  </tr>
                  {open && (
                    <tr key={`${g.key}-detail`} style={{ backgroundColor: "#F8FAFC" }}>
                      <td></td>
                      <td colSpan={7} className="px-3 py-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[11px] uppercase font-semibold text-slate-500">
                              <th className="text-left px-2 py-1">Commande</th>
                              <th className="text-left px-2 py-1">Date</th>
                              <th className="text-left px-2 py-1">Bons de livraison</th>
                              <th className="text-left px-2 py-1">Déblocage</th>
                              <th className="text-right px-2 py-1">Débloqué (HT)</th>
                              <th className="text-right px-2 py-1">Montant HTVA</th>
                              <th className="px-2 py-1"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.orders.map((o) => (
                              <tr key={o.orderId} className="border-t" style={{ borderColor: "#E2E8F0" }}>
                                <td className="px-2 py-1.5 font-medium">{o.orderNumber ?? "—"}</td>
                                <td className="px-2 py-1.5">{fmtDate(o.createdAt)}</td>
                                <td className="px-2 py-1.5">
                                  {o.deliveryNotes.length > 0 ? o.deliveryNotes.join(", ") : "—"}
                                  {o.signedNotes > 0 && (
                                    <Badge variant="secondary" className="ml-2">
                                      {o.signedNotes} signé(s)
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-2 py-1.5">
                                  {o.releaseDecisions.length > 0
                                    ? o.releaseDecisions.map((d) => DECISION_LABEL[d] ?? d).join(", ")
                                    : "—"}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  {o.releaseDecisions.length > 0 ? fmtEur(o.releasedHt) : "—"}
                                </td>
                                <td className="px-2 py-1.5 text-right font-semibold">{fmtEur(o.totalHt)}</td>
                                <td className="px-2 py-1.5 text-right">
                                  <Link
                                    to={`/admin/commandes/${o.orderId}`}
                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                  >
                                    Ouvrir <ExternalLink size={12} />
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
