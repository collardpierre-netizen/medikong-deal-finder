import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Landmark, CheckCircle2, Loader2, ExternalLink } from "lucide-react";

type TransferState = "pending" | "received" | "settled";

interface Row {
  id: string;
  order_id: string;
  value_date: string | null;
  amount_cents: number;
  state: TransferState;
  bank_reference: string | null;
  note: string | null;
  confirmed_at: string | null;
  created_at: string;
  order: {
    id: string;
    order_number: string | null;
    total_incl_vat: number | null;
    payment_status: string | null;
    payment_method: string | null;
    status: string | null;
  } | null;
}

const STATE_LABELS: Record<TransferState, string> = {
  pending: "En cours",
  received: "Reçu",
  settled: "Encaissé",
};

const STATE_CLASSES: Record<TransferState, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  received: "bg-blue-100 text-blue-800 border-blue-200",
  settled: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const fmtEur = (cents: number) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
};

const AdminBankTransfers = () => {
  const queryClient = useQueryClient();
  const [stateFilter, setStateFilter] = useState<"all" | TransferState>("all");
  const [search, setSearch] = useState("");

  const queryKey = ["admin-bank-transfers"];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_bank_transfers")
        .select(
          "id, order_id, value_date, amount_cents, state, bank_reference, note, confirmed_at, created_at, order:orders(id, order_number, total_incl_vat, payment_status, payment_method, status)",
        )
        .order("value_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (stateFilter !== "all" && r.state !== stateFilter) return false;
      if (!q) return true;
      return (
        (r.order?.order_number || "").toLowerCase().includes(q) ||
        (r.bank_reference || "").toLowerCase().includes(q) ||
        (r.note || "").toLowerCase().includes(q)
      );
    });
  }, [rows, stateFilter, search]);

  const kpis = useMemo(() => {
    const sum = (s: TransferState) =>
      rows.filter((r) => r.state === s).reduce((acc, r) => acc + r.amount_cents, 0);
    return {
      pending: sum("pending"),
      received: sum("received"),
      settled: sum("settled"),
      count: rows.length,
    };
  }, [rows]);

  /** Valide le virement (état = encaissé) et, si demandé, marque la commande payée. */
  const validate = useMutation({
    mutationFn: async ({ row, markOrderPaid }: { row: Row; markOrderPaid: boolean }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("order_bank_transfers")
        .update({
          state: "settled",
          confirmed_by: auth?.user?.id ?? null,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;

      if (markOrderPaid && row.order_id) {
        const { error: oErr } = await supabase
          .from("orders")
          .update({ payment_status: "paid" })
          .eq("id", row.order_id);
        if (oErr) throw oErr;
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.markOrderPaid ? "Paiement validé — commande marquée payée" : "Paiement validé");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["order-bank-transfers"] });
    },
    onError: (e: any) => toast.error(e?.message || "Validation impossible"),
  });

  const setState = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: TransferState }) => {
      const { error } = await supabase
        .from("order_bank_transfers")
        .update({
          state: next,
          confirmed_by: null,
          confirmed_at: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("État mis à jour");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message || "Mise à jour impossible"),
  });

  const markOrderPaid = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.from("orders").update({ payment_status: "paid" }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commande marquée payée");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message || "Mise à jour de la commande impossible"),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-mk-blue" />
        <h1 className="text-2xl font-bold text-mk-navy">Réception des virements</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Validez chaque virement reçu sur le compte MediKong et mettez à jour le statut de paiement de la commande.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "En cours", value: fmtEur(kpis.pending) },
          { label: "Reçus", value: fmtEur(kpis.received) },
          { label: "Encaissés", value: fmtEur(kpis.settled) },
          { label: "Lignes", value: String(kpis.count) },
        ].map((k) => (
          <div key={k.label} className="bg-white border rounded-lg p-4" style={{ borderColor: "#E2E8F0" }}>
            <div className="text-xs uppercase text-muted-foreground">{k.label}</div>
            <div className="text-lg font-semibold text-mk-navy font-mono">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Rechercher (n° commande, référence, note)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as typeof stateFilter)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les états</SelectItem>
            <SelectItem value="pending">En cours</SelectItem>
            <SelectItem value="received">Reçu</SelectItem>
            <SelectItem value="settled">Encaissé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
        {isLoading ? (
          <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Aucun virement enregistré.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Date de valeur</th>
                  <th className="px-3 py-2">Commande</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                  <th className="px-3 py-2 text-right">Total TTC</th>
                  <th className="px-3 py-2">État virement</th>
                  <th className="px-3 py-2">Paiement commande</th>
                  <th className="px-3 py-2">Référence</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const totalCents = Math.round(Number(r.order?.total_incl_vat || 0) * 100);
                  const covers = totalCents > 0 && r.amount_cents >= totalCents;
                  const orderPaid = r.order?.payment_status === "paid";
                  return (
                    <tr key={r.id} className="border-t" style={{ borderColor: "#EEF2F7" }}>
                      <td className="px-3 py-3 whitespace-nowrap">{fmtDate(r.value_date)}</td>
                      <td className="px-3 py-3">
                        {r.order_id ? (
                          <Link
                            to={`/admin/commandes/${r.order_id}`}
                            className="text-mk-blue hover:underline inline-flex items-center gap-1"
                          >
                            {r.order?.order_number || r.order_id.slice(0, 8)}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{fmtEur(r.amount_cents)}</td>
                      <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                        {totalCents ? fmtEur(totalCents) : "—"}
                        {totalCents > 0 && !covers && (
                          <div className="text-[11px] text-amber-700">Paiement partiel</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={STATE_CLASSES[r.state]}>
                          {STATE_LABELS[r.state]}
                        </Badge>
                        {r.state === "settled" && r.confirmed_at && (
                          <div className="text-[11px] text-muted-foreground mt-1">le {fmtDate(r.confirmed_at)}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant="outline"
                          className={orderPaid ? "bg-emerald-100 text-emerald-800 border-emerald-200" : ""}
                        >
                          {r.order?.payment_status || "—"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{r.bank_reference || "—"}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap space-x-2">
                        {r.state !== "settled" && (
                          <Button
                            size="sm"
                            onClick={() => validate.mutate({ row: r, markOrderPaid: covers })}
                            disabled={validate.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {covers ? "Valider et marquer payée" : "Valider le paiement"}
                          </Button>
                        )}
                        {r.state === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setState.mutate({ id: r.id, next: "received" })}
                            disabled={setState.isPending}
                          >
                            Marquer reçu
                          </Button>
                        )}
                        {r.state === "settled" && !orderPaid && r.order_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markOrderPaid.mutate(r.order_id)}
                            disabled={markOrderPaid.isPending}
                          >
                            Marquer la commande payée
                          </Button>
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

export default AdminBankTransfers;
