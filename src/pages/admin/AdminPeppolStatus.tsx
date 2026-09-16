import { useMemo, useState } from "react";
// CSV : séparateur « ; » (Excel FR), valeurs échappées par guillemets doubles.
const csvCell = (v: string | number | null | undefined): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, ExternalLink, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type PeppolFilter = "all" | "accepted" | "sent" | "rejected" | "failed" | "pending" | "none";

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
  document_type: string | null;
  flow: string | null;
  peppol_document_id: string | null;
  falco_import_id: string | null;
  payload_storage_path: string | null;
  payload_sha256: string | null;
  ubl_storage_path: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  if (["accepted", "delivered"].includes(v)) return "accepted";
  if (["rejected", "refused"].includes(v)) return "rejected";
  if (["sent", "success", "submitted"].includes(v)) return "sent";
  if (["failed", "error"].includes(v)) return "failed";
  return "pending";
};

const STATUS_CLASSES: Record<Exclude<PeppolFilter, "all">, string> = {
  accepted: "bg-emerald-100 text-emerald-800 border-emerald-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  none: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_LABELS: Record<Exclude<PeppolFilter, "all">, string> = {
  accepted: "Acceptée",
  sent: "Émise / transmise",
  rejected: "Rejetée",
  failed: "Échec technique",
  pending: "En cours",
  none: "Non envoyée",
};

// --- Filtres avancés : tentatives + type d'erreur ---
type AttemptsFilter = "all" | "0" | "1" | "2" | "3plus";
type ErrorTypeFilter = "all" | "none" | "receiver_not_found" | "invalid_identifier" | "network" | "auth" | "other";

const ATTEMPTS_LABELS: Record<AttemptsFilter, string> = {
  all: "Tentatives : toutes",
  "0": "0 tentative",
  "1": "1 tentative",
  "2": "2 tentatives",
  "3plus": "3 tentatives et +",
};

const ERROR_TYPE_LABELS: Record<Exclude<ErrorTypeFilter, "all">, string> = {
  none: "Sans erreur",
  receiver_not_found: "Destinataire introuvable / non enregistré",
  invalid_identifier: "Identifiant ou format invalide",
  network: "Réseau / timeout",
  auth: "Authentification / autorisation",
  other: "Autre erreur",
};

// Classification heuristique du premier message d'erreur connu (facture puis transmissions).
const classifyError = (msgs: string[]): Exclude<ErrorTypeFilter, "all"> => {
  const msg = (msgs.find(Boolean) || "").toLowerCase();
  if (!msg) return "none";
  if (/(not registered|not found|introuvable|non enregistr|unknown participant|no such participant)/.test(msg))
    return "receiver_not_found";
  if (/(invalid|invalide|malformed|format|scheme|peppol id)/.test(msg)) return "invalid_identifier";
  if (/(timeout|timed out|network|fetch|econn|socket|502|503|504)/.test(msg)) return "network";
  if (/(401|403|unauthorized|forbidden|non autoris|authentification|token)/.test(msg)) return "auth";
  return "other";
};

const attemptsMatch = (n: number, f: AttemptsFilter): boolean => {
  if (f === "all") return true;
  if (f === "3plus") return n >= 3;
  return n === Number(f);
};

// --- Chronologie des tentatives par facture ---
interface TimelineEvent {
  at: string | null;
  label: string;
  kind: "info" | "sent" | "ok" | "error";
  details?: string[];
  error?: string | null;
}

const buildTimeline = (r: InvoiceRow, tx: Transmission[]): TimelineEvent[] => {
  const events: TimelineEvent[] = [];

  events.push({ at: r.created_at, label: "Facture créée", kind: "info" });

  if (r.peppol_submitted_at) {
    events.push({
      at: r.peppol_submitted_at,
      label: "Envoi Peppol (facture)",
      kind: "sent",
      details: [
        r.peppol_document_id ? `document : ${r.peppol_document_id}` : "",
        r.peppol_identifier ? `destinataire : ${r.peppol_identifier}` : "",
      ].filter(Boolean),
    });
  }

  if (r.peppol_last_attempt_at && r.peppol_last_attempt_at !== r.peppol_submitted_at) {
    events.push({
      at: r.peppol_last_attempt_at,
      label: `Dernière tentative (facture)${r.peppol_retry_count ? ` · tentative n°${r.peppol_retry_count}` : ""}`,
      kind: r.peppol_error ? "error" : "sent",
      error: r.peppol_error,
    });
  } else if (r.peppol_error) {
    events.push({ at: r.peppol_last_attempt_at, label: "Erreur signalée sur la facture", kind: "error", error: r.peppol_error });
  }

  for (const t of tx) {
    const who = t.receiver_name_snapshot || t.receiver_peppol_id || "destinataire inconnu";
    const base = [
      t.flow ? `flux : ${t.flow}` : "",
      t.document_type ? `type : ${t.document_type}` : "",
      t.channel ? `canal : ${t.channel}` : "",
      t.peppol_document_id ? `document : ${t.peppol_document_id}` : "",
      t.falco_import_id ? `import : ${t.falco_import_id}` : "",
      t.payload_storage_path ? `payload : ${t.payload_storage_path}` : "",
      t.payload_sha256 ? `sha256 : ${t.payload_sha256}` : "",
      t.ubl_storage_path ? `UBL : ${t.ubl_storage_path}` : "",
    ].filter(Boolean);

    events.push({
      at: t.created_at,
      label: `Transmission créée → ${who}`,
      kind: "info",
      details: base,
    });
    if (t.submitted_at) {
      events.push({ at: t.submitted_at, label: `Transmission envoyée → ${who}`, kind: "sent" });
    }
    if (t.last_attempt_at && t.last_attempt_at !== t.submitted_at) {
      events.push({
        at: t.last_attempt_at,
        label: `Tentative${t.retry_count ? ` n°${t.retry_count}` : ""} → ${who} · ${t.status || "statut inconnu"}`,
        kind: t.last_error ? "error" : "sent",
        error: t.last_error,
      });
    } else if (t.last_error) {
      events.push({
        at: t.updated_at,
        label: `Erreur → ${who} · ${t.status || "statut inconnu"}`,
        kind: "error",
        error: t.last_error,
      });
    }
    if (t.delivered_at) {
      events.push({ at: t.delivered_at, label: `Accusé reçu (livrée) → ${who}`, kind: "ok" });
    }
  }

  return events.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return ta - tb;
  });
};

const EVENT_DOT: Record<TimelineEvent["kind"], string> = {
  info: "bg-slate-400",
  sent: "bg-blue-500",
  ok: "bg-emerald-500",
  error: "bg-red-500",
};

const AdminPeppolStatus = () => {
  const [filter, setFilter] = useState<PeppolFilter>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [attemptsFilter, setAttemptsFilter] = useState<AttemptsFilter>("all");
  const [errorTypeFilter, setErrorTypeFilter] = useState<ErrorTypeFilter>("all");

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
            "id, order_invoice_id, status, channel, retry_count, last_error, submitted_at, last_attempt_at, delivered_at, receiver_name_snapshot, receiver_peppol_id, document_type, flow, peppol_document_id, falco_import_id, payload_storage_path, payload_sha256, ubl_storage_path, created_at, updated_at",
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
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    return rows.filter((r) => {
      if (filter !== "all" && statusBucket(r.peppol_status) !== filter) return false;
      // Période : sur la date de création de la facture
      if (from || to) {
        const d = new Date(r.created_at);
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      // Tentatives : max(colonne facture, somme des transmissions)
      if (attemptsFilter !== "all") {
        const tx = txByInvoice.get(r.id) || [];
        const attempts = Math.max(
          r.peppol_retry_count || 0,
          tx.reduce((acc, t) => acc + (t.retry_count || 0), 0),
        );
        if (!attemptsMatch(attempts, attemptsFilter)) return false;
      }
      // Type d'erreur : classification du premier message connu
      if (errorTypeFilter !== "all") {
        const tx = txByInvoice.get(r.id) || [];
        const msgs = [r.peppol_error, ...tx.map((t) => t.last_error)].filter(Boolean) as string[];
        if (classifyError(msgs) !== errorTypeFilter) return false;
      }
      if (!q) return true;
      return (
        (r.invoice_number || "").toLowerCase().includes(q) ||
        (r.order?.order_number || "").toLowerCase().includes(q) ||
        (r.peppol_document_id || "").toLowerCase().includes(q) ||
        (r.peppol_identifier || "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search, dateFrom, dateTo, attemptsFilter, errorTypeFilter, txByInvoice]);

  const kpis = useMemo(() => {
    const count = (b: Exclude<PeppolFilter, "all">) =>
      rows.filter((r) => statusBucket(r.peppol_status) === b).length;
    return {
      total: rows.length,
      accepted: count("accepted"),
      sent: count("sent"),
      rejected: count("rejected"),
      failed: count("failed"),
      pending: count("pending"),
      none: count("none"),
    };
  }, [rows]);

  // Export CSV de la liste filtrée : statut, tentatives, dernière tentative, erreurs détaillées.
  const exportCsv = () => {
    const header = [
      "Commande",
      "Date commande",
      "Facture",
      "Type",
      "Montant TTC",
      "Statut Peppol",
      "Statut brut",
      "Tentatives",
      "Dernière tentative",
      "Document Peppol",
      "Destinataire Peppol",
      "Erreurs détaillées",
    ];
    const lines = filtered.map((r) => {
      const bucket = statusBucket(r.peppol_status);
      const tx = txByInvoice.get(r.id) || [];
      const attempts = Math.max(
        r.peppol_retry_count || 0,
        tx.reduce((acc, t) => acc + (t.retry_count || 0), 0),
      );
      const lastAttempt =
        r.peppol_last_attempt_at || tx.find((t) => t.last_attempt_at)?.last_attempt_at || null;
      const errors = [r.peppol_error, ...tx.map((t) => t.last_error)].filter(Boolean) as string[];
      return [
        r.order?.order_number || r.order_id,
        fmtDateTime(r.order?.created_at || null),
        r.invoice_number || r.id,
        TYPE_LABELS[r.type || ""] || r.type || "",
        (Number(r.amount_incl_vat || 0)).toFixed(2).replace(".", ","),
        STATUS_LABELS[bucket],
        r.peppol_status || "",
        attempts,
        fmtDateTime(lastAttempt),
        r.peppol_document_id || "",
        r.peppol_identifier || "",
        errors.join(" | "),
      ]
        .map(csvCell)
        .join(";");
    });
    const csv = "\uFEFF" + [header.map(csvCell).join(";"), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peppol-virements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

      <div className="grid gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {[
          { label: "Factures", value: kpis.total },
          { label: "Acceptées", value: kpis.accepted },
          { label: "Émises", value: kpis.sent },
          { label: "Rejetées", value: kpis.rejected },
          { label: "Échecs", value: kpis.failed },
          { label: "En cours", value: kpis.pending },
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
            <SelectItem value="accepted">Acceptées</SelectItem>
            <SelectItem value="sent">Émises / transmises</SelectItem>
            <SelectItem value="rejected">Rejetées</SelectItem>
            <SelectItem value="pending">En cours</SelectItem>
            <SelectItem value="failed">Échecs techniques</SelectItem>
            <SelectItem value="none">Non envoyées</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Du"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
          <span className="text-xs text-muted-foreground">au</span>
          <Input
            type="date"
            aria-label="Au"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>
        <Select value={attemptsFilter} onValueChange={(v) => setAttemptsFilter(v as AttemptsFilter)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(ATTEMPTS_LABELS) as AttemptsFilter[]).map((k) => (
              <SelectItem key={k} value={k}>{ATTEMPTS_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={errorTypeFilter} onValueChange={(v) => setErrorTypeFilter(v as ErrorTypeFilter)}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Type d'erreur : toutes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Type d'erreur : toutes</SelectItem>
            {(Object.keys(ERROR_TYPE_LABELS) as Exclude<ErrorTypeFilter, "all">[]).map((k) => (
              <SelectItem key={k} value={k}>{ERROR_TYPE_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(dateFrom || dateTo || attemptsFilter !== "all" || errorTypeFilter !== "all" || filter !== "all" || search) && (
          <button
            type="button"
            onClick={() => {
              setFilter("all");
              setSearch("");
              setDateFrom("");
              setDateTo("");
              setAttemptsFilter("all");
              setErrorTypeFilter("all");
            }}
            className="text-xs text-mk-blue hover:underline"
          >
            Réinitialiser les filtres
          </button>
        )}
        <span className="text-xs text-muted-foreground">{filtered.length} facture(s)</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={isLoading || filtered.length === 0}
          className="ml-auto"
        >
          <Download className="h-4 w-4 mr-1" />
          Exporter en CSV ({filtered.length})
        </Button>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 px-2 text-[11px]"
                          onClick={() => toggleTimeline(r.id)}
                        >
                          {expanded[r.id] ? (
                            <ChevronDown className="h-3 w-3 mr-1" />
                          ) : (
                            <ChevronRight className="h-3 w-3 mr-1" />
                          )}
                          Chronologie des tentatives
                        </Button>
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
