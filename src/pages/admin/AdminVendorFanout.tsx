import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Send } from "lucide-react";

type Row = {
  order_id: string;
  order_number: string;
  paid_at: string;
  payment_status: string;
  order_status: string;
  total_incl_vat: number | string | null;
  expected_vendors: number;
  sub_orders_count: number;
  missing_vendors: number;
  email_attempts: number;
  emails_sent: number;
  emails_failed: number;
  last_attempt_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" });
};

const fmtEur = (n: number | string | null) => {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(v);
};

export default function AdminVendorFanout() {
  const qc = useQueryClient();
  const [days, setDays] = useState(7);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-vendor-fanout", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_vendor_fanout_status", {
        _days: days,
        _limit: 200,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const replay = useMutation({
    mutationFn: async (orderId: string) => {
      setReplayingId(orderId);
      const { data, error } = await supabase.functions.invoke("admin-replay-vendor-fanout", {
        body: { orderId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any, orderId) => {
      const r = data?.result ?? {};
      toast({
        title: "Fan-out relancé",
        description: `Vendeurs: ${r.vendors ?? "?"} · Emails envoyés: ${r.emails_sent ?? 0} · Ignorés: ${r.emails_skipped ?? 0}`,
      });
      qc.invalidateQueries({ queryKey: ["admin-vendor-fanout"] });
    },
    onError: (e: any) => {
      toast({ title: "Échec de la relance", description: e?.message ?? "Erreur inconnue", variant: "destructive" });
    },
    onSettled: () => setReplayingId(null),
  });

  const rows = data ?? [];
  const counts = rows.reduce(
    (acc, r) => {
      acc.total++;
      if (r.missing_vendors > 0) acc.missing++;
      if (r.emails_failed > 0) acc.failed++;
      if (r.expected_vendors > 0 && r.emails_sent >= r.expected_vendors && r.missing_vendors === 0) acc.ok++;
      return acc;
    },
    { total: 0, missing: 0, failed: 0, ok: 0 },
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-mk-navy">Fan-out vendeurs — notifications de commande</h1>
          <p className="text-sm text-mk-sec mt-1">
            État des notifications <code>notify-vendors-new-order</code> pour chaque commande payée : sous-commandes créées, tentatives d'email, dernier échec. Relance manuelle disponible ligne par ligne.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 border border-mk-line rounded-md px-2 text-sm bg-background"
          >
            <option value={1}>24h</option>
            <option value={3}>3 jours</option>
            <option value={7}>7 jours</option>
            <option value={14}>14 jours</option>
            <option value={30}>30 jours</option>
          </select>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="border border-mk-line rounded-lg p-4 bg-background">
          <div className="text-xs text-mk-sec">Commandes payées</div>
          <div className="text-2xl font-bold text-mk-navy mt-1">{counts.total}</div>
        </div>
        <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50">
          <div className="text-xs text-emerald-700">OK (tous notifiés)</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{counts.ok}</div>
        </div>
        <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
          <div className="text-xs text-amber-700">Sous-commandes manquantes</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{counts.missing}</div>
        </div>
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <div className="text-xs text-red-700">Avec échec email</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{counts.failed}</div>
        </div>
      </div>

      <div className="border border-mk-line rounded-lg overflow-hidden bg-background">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-mk-alt text-xs font-semibold text-mk-sec">
          <span className="col-span-2">Commande</span>
          <span className="col-span-2">Payée le</span>
          <span className="col-span-1 text-right">Total</span>
          <span className="col-span-1 text-center">Vendeurs</span>
          <span className="col-span-1 text-center">Sub-orders</span>
          <span className="col-span-1 text-center">Emails</span>
          <span className="col-span-2">Dernier échec</span>
          <span className="col-span-2 text-right">Action</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-mk-sec">Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-mk-sec">Aucune commande payée sur la période.</div>
        ) : (
          rows.map((r) => {
            const allOk = r.missing_vendors === 0 && r.emails_failed === 0 && r.expected_vendors > 0 && r.emails_sent >= r.expected_vendors;
            const missing = r.missing_vendors > 0;
            const failed = r.emails_failed > 0;
            return (
              <div key={r.order_id} className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-mk-line text-sm items-center hover:bg-mk-alt">
                <span className="col-span-2 font-medium text-mk-navy truncate">
                  <Link to={`/admin/commandes/${r.order_id}`} className="hover:underline text-primary">
                    {r.order_number}
                  </Link>
                  <div className="text-xs text-mk-sec">{r.order_status}</div>
                </span>
                <span className="col-span-2 text-mk-sec text-xs">{fmtDate(r.paid_at)}</span>
                <span className="col-span-1 text-right text-mk-navy">{fmtEur(r.total_incl_vat)}</span>
                <span className="col-span-1 text-center text-mk-navy">
                  {r.expected_vendors}
                </span>
                <span className="col-span-1 text-center">
                  <Badge variant={missing ? "destructive" : "secondary"}>
                    {r.sub_orders_count}/{r.expected_vendors}
                  </Badge>
                </span>
                <span className="col-span-1 text-center text-xs">
                  <span className="text-emerald-700">{r.emails_sent}✓</span>
                  {r.emails_failed > 0 && <span className="text-red-700 ml-1">{r.emails_failed}✗</span>}
                  {r.email_attempts === 0 && <span className="text-mk-sec">—</span>}
                </span>
                <span className="col-span-2 text-xs">
                  {failed ? (
                    <>
                      <div className="text-red-700 truncate" title={r.last_error ?? ""}>{r.last_error ?? "Erreur"}</div>
                      <div className="text-mk-sec">{fmtDate(r.last_error_at)}</div>
                    </>
                  ) : allOk ? (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200">OK</Badge>
                  ) : (
                    <span className="text-mk-sec">—</span>
                  )}
                </span>
                <span className="col-span-2 text-right">
                  <Button
                    size="sm"
                    variant={missing || failed ? "default" : "outline"}
                    onClick={() => replay.mutate(r.order_id)}
                    disabled={replayingId === r.order_id}
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    {replayingId === r.order_id ? "Envoi…" : "Relancer"}
                  </Button>
                </span>
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-mk-sec">
        Astuce : la relance est idempotente — <code>fanout_order_to_vendors</code> ne recrée pas de sous-commande existante et l'email vendeur est dédoublonné via son <code>idempotencyKey</code>.
      </p>
    </div>
  );
}
