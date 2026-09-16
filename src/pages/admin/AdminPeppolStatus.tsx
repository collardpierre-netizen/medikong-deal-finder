import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, ExternalLink, AlertTriangle } from "lucide-react";

type PeppolFilter = "all" | "sent" | "failed" | "pending" | "none";

interface Transmission {
  id: string;
  order_invoice_id: string | null;
  status: string | null;
  channel: string | null;
  retry_count: number | null;
  last_error: string | null;
  submitted_at: string | null;
  last_attempt_at: string | null;
  delivered_at: string | null;
  receiver_name_snapshot: string | null;
  receiver_peppol_id: string | null;
}

interface InvoiceRow {
  id: string;
  order_id: string;
  invoice_number: string | null;
  type: string | null;
  status: string | null;
  amount_incl_vat: number | null;
  created_at: string;
  peppol_status: string | null;
  peppol_document_id: string | null;
  peppol_identifier: string | null;
  peppol_error: string | null;
  peppol_submitted_at: string | null;
  peppol_last_attempt_at: string | null;
  peppol_retry_count: number | null;
  order: {
    id: string;
    order_number: string | null;
    payment_method: string | null;
    payment_status: string | null;
    total_incl_vat: number | null;
    created_at: string | null;
  } | null;
}

const fmtEur = (v: number | null) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(Number(v || 0));

const fmtDateTime = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("fr-BE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
};

const TYPE_LABELS: Record<string, string> = {
  customer: "Client",
  self_billing: "Fournisseur (au nom et pour le compte de)",
  commission: "Commission",
  credit_note: "Note de crédit",
};

const statusBucket = (s: string | null): Exclude<PeppolFilter, "all"> => {
  const v = (s || "").toLowerCase();
  if (!v) return "none";
  if (["sent", "delivered", "accepted", "success"].includes(v)) return "sent";
  if (["failed", "error", "rejected"].includes(v)) return "failed";
  return "pending";
};

const STATUS_CLASSES: Record<Exclude<PeppolFilter, "all">, string> = {
  sent: "bg-emerald-100 text-emerald-800 border-emerald-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  none: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_LABELS: Record<Exclude<PeppolFilter, "all">, string> = {
  sent: "Envoyée",
  failed: "Échec",
  pending: "En cours",
  none: "Non envoyée",
};

const AdminPeppolStatus = () => {
  const [filter, setFilter] = useState<PeppolFilter>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-peppol-status"],
    queryFn: async () => {
      const { data: invoices, error } = await supabase
        .from("order_invoices")
        .select(
          "id, order_id, invoice_number, type, status, amount_incl_vat, created_at, peppol_status, peppol_document_id, peppol_identifier, peppol_error, peppol_submitted_at, peppol_last_attempt_at, peppol_retry_count, order:orders!inner(id, order_number, payment_method, payment_status, total_incl_vat, created_at)",
        )
        .eq("orders.payment_method", "bank_transfer")
        .eq("orders.payment_status", "paid")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const rows = (invoices || []) as unknown as InvoiceRow[];
      const ids = rows.map((r) => r.id);
      let transmissions: Transmission[] = [];
      if (ids.length) {
        const { data: tx, error: txErr } = await supabase
          .from("peppol_transmissions")
          .select(
            "id, order_invoice_id, status, channel, retry_count, last_error, submitted_at, last_attempt_at, delivered_at, receiver_name_snapshot, receiver_peppol_id",
          )
          .in("order_invoice_id", ids)
          .order("created_at", { ascending: false });
        if (txErr) throw txErr;
        transmissions = (tx || []) as unknown as Transmission[];
      }
      return { rows, transmissions };
    },
  });

  const rows = data?.rows || [];
  const txByInvoice = useMemo(() => {
    const map = new Map<string, Transmission[]>();
    for (const t of data?.transmissions || []) {
      if (!t.order_invoice_id) continue;
      const list = map.get(t.order_invoice_id) || [];
      list.push(t);
      map.set(t.order_invoice_id, list);
    }
    return map;
  }, [data?.transmissions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && statusBucket(r.peppol_status) !== filter) return false;
      if (!q) return true;
      return (
        (r.invoice_number || "").toLowerCase().includes(q) ||
        (r.order?.order_number || "").toLowerCase().includes(q) ||
        (r.peppol_document_id || "").toLowerCase().includes(q) ||
        (r.peppol_identifier || "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const kpis = useMemo(() => {
    const count = (b: Exclude<PeppolFilter, "all">) =>
      rows.filter((r) => statusBucket(r.peppol_status) === b).length;
    return {
      total: rows.length,
      sent: count("sent"),
      failed: count("failed"),
      pending: count("pending"),
      none: count("none"),
    };
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Send className="h-5 w-5 text-mk-blue" />
        <h1 className="text-2xl font-bold text-mk-navy">Statut Peppol — commandes virement payées</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Pour chaque commande payée par virement, statut d'envoi Peppol de chaque facture, nombre de tentatives et
        erreurs détaillées.
      </p>

      <div className="grid gap-3 sm:grid-cols-5">
        {[
          { label: "Factures", value: kpis.total },
          { label: "Envoyées", value: kpis.sent },
          { label: "En cours", value: kpis.pending },
          { label: "Échecs", value: kpis.failed },
          { label: "Non envoyées", value: kpis.none },
        ].map((k) => (
          <div key={k.label} className="bg-white border rounded-lg p-4" style={{ borderColor: "#E2E8F0" }}>
            <div className="text-xs uppercase text-muted-foreground">{k.label}</div>
            <div className="text-lg font-semibold text-mk-navy font-mono">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Rechercher (n° facture, n° commande, identifiant Peppol)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as PeppolFilter)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="sent">Envoyées</SelectItem>
            <SelectItem value="pending">En cours</SelectItem>
            <SelectItem value="failed">Échecs</SelectItem>
            <SelectItem value="none">Non envoyées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
        {isLoading ? (
          <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            Aucune facture pour les commandes payées par virement.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Commande</th>
                  <th className="px-3 py-2">Facture</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Montant TTC</th>
                  <th className="px-3 py-2">Statut Peppol</th>
                  <th className="px-3 py-2 text-right">Tentatives</th>
                  <th className="px-3 py-2">Dernière tentative</th>
                  <th className="px-3 py-2">Détails / erreurs</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const bucket = statusBucket(r.peppol_status);
                  const tx = txByInvoice.get(r.id) || [];
                  const txRetries = tx.reduce((acc, t) => acc + (t.retry_count || 0), 0);
                  const attempts = Math.max(r.peppol_retry_count || 0, txRetries);
                  const lastAttempt =
                    r.peppol_last_attempt_at || tx.find((t) => t.last_attempt_at)?.last_attempt_at || null;
                  const errors = [r.peppol_error, ...tx.map((t) => t.last_error)].filter(Boolean) as string[];
                  return (
                    <tr key={r.id} className="border-t align-top" style={{ borderColor: "#EEF2F7" }}>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Link
                          to={`/admin/commandes/${r.order_id}`}
                          className="text-mk-blue hover:underline inline-flex items-center gap-1"
                        >
                          {r.order?.order_number || r.order_id.slice(0, 8)}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        <div className="text-[11px] text-muted-foreground">{fmtDateTime(r.order?.created_at || null)}</div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">
                        {r.invoice_number || r.id.slice(0, 8)}
                        <div className="text-[11px] text-muted-foreground font-sans">{r.status || "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-xs">{TYPE_LABELS[r.type || ""] || r.type || "—"}</td>
                      <td className="px-3 py-3 text-right font-mono">{fmtEur(r.amount_incl_vat)}</td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={STATUS_CLASSES[bucket]}>
                          {STATUS_LABELS[bucket]}
                        </Badge>
                        {r.peppol_status && (
                          <div className="text-[11px] text-muted-foreground mt-1 font-mono">{r.peppol_status}</div>
                        )}
                        {r.peppol_submitted_at && (
                          <div className="text-[11px] text-muted-foreground">
                            envoi : {fmtDateTime(r.peppol_submitted_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{attempts}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">{fmtDateTime(lastAttempt)}</td>
                      <td className="px-3 py-3 text-xs max-w-md">
                        {r.peppol_document_id && (
                          <div className="font-mono text-[11px] text-muted-foreground break-all">
                            doc : {r.peppol_document_id}
                          </div>
                        )}
                        {r.peppol_identifier && (
                          <div className="font-mono text-[11px] text-muted-foreground break-all">
                            destinataire : {r.peppol_identifier}
                          </div>
                        )}
                        {tx.map((t) => (
                          <div key={t.id} className="text-[11px] text-muted-foreground mt-1">
                            {t.receiver_name_snapshot || t.receiver_peppol_id || "transmission"} · {t.status || "—"}
                            {t.channel ? ` · ${t.channel}` : ""}
                            {t.delivered_at ? ` · livrée ${fmtDateTime(t.delivered_at)}` : ""}
                          </div>
                        ))}
                        {errors.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {errors.map((e, i) => (
                              <div
                                key={i}
                                className="flex gap-1 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded p-2 break-words"
                              >
                                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                <span>{e}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {!errors.length && !tx.length && !r.peppol_document_id && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPeppolStatus;
