// Portail apporteur — Mes commissions.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAffiliateAccount, affiliateArgs } from "@/hooks/useAffiliateAccount";
import { CommissionCalcDetails } from "@/components/affiliate/CommissionCalcDetails";
import { fmtCents, fmtDate, COMMISSION_STATUS_LABELS, type CalcDetails } from "@/lib/affiliate-format";
import { Download } from "lucide-react";

type Commission = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  order_date: string | null;
  pseudo: string | null;
  order_total_ht_cents: number;
  commission_cents: number;
  margin_guard_hit: boolean;
  status: string;
  validate_after: string | null;
  calc_details: CalcDetails | null;
  invoice_number: string | null;
  adjustment_of_id: string | null;
  cancelled_reason: string | null;
};

const STATUSES = ["pending", "on_hold", "validated", "invoiced", "paid", "cancelled"];

export default function AffiliateCommissionsPage() {
  const { account, asAffiliateId } = useAffiliateAccount();
  const [status, setStatus] = useState("all");

  const { data: rows = [] } = useQuery<Commission[]>({
    queryKey: ["affiliate-commissions", asAffiliateId],
    enabled: Boolean(account),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("affiliate_my_commissions", affiliateArgs(asAffiliateId));
      if (error) throw error;
      return (data as Commission[]) ?? [];
    },
  });

  const filtered = useMemo(
    () => (status === "all" ? rows : rows.filter((r) => r.status === status)),
    [rows, status],
  );

  const exportCsv = () => {
    const header = ["Commande", "Date", "Client", "Montant HTVA", "Commission", "Statut", "Note de commission"];
    const lines = filtered.map((r) => [
      r.order_number ?? "", r.order_date ?? "", r.pseudo ?? "",
      ((r.order_total_ht_cents ?? 0) / 100).toFixed(2),
      ((r.commission_cents ?? 0) / 100).toFixed(2),
      COMMISSION_STATUS_LABELS[r.status]?.label ?? r.status,
      r.invoice_number ?? "",
    ]);
    const csv = [header, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "mes-commissions.csv";
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Mes commissions</h1>
          <p className="text-sm text-muted-foreground">Montants HTVA, une ligne par commande attribuée.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{COMMISSION_STATUS_LABELS[s]?.label ?? s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Commande</th>
                <th className="p-3">Date</th>
                <th className="p-3">Client</th>
                <th className="p-3 text-right">Montant HTVA</th>
                <th className="p-3 text-right">Commission</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Détail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const st = COMMISSION_STATUS_LABELS[r.status] ?? { label: r.status, className: "" };
                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-3 font-mono text-xs">
                      {r.order_number ?? "—"}
                      {r.adjustment_of_id && <p className="text-[11px] text-muted-foreground">régularisation</p>}
                    </td>
                    <td className="p-3">{fmtDate(r.order_date)}</td>
                    <td className="p-3 font-mono text-xs">{r.pseudo ?? "—"}</td>
                    <td className="p-3 text-right">{fmtCents(r.order_total_ht_cents)}</td>
                    <td className="p-3 text-right font-medium">{fmtCents(r.commission_cents)}</td>
                    <td className="p-3">
                      <Badge className={st.className}>{st.label}</Badge>
                      {r.status === "pending" && r.validate_after && (
                        <p className="text-[11px] text-muted-foreground mt-1">validée le {fmtDate(r.validate_after)}</p>
                      )}
                      {r.invoice_number && (
                        <p className="text-[11px] text-muted-foreground mt-1">note {r.invoice_number}</p>
                      )}
                      {r.status === "cancelled" && r.cancelled_reason && (
                        <p className="text-[11px] text-muted-foreground mt-1">{r.cancelled_reason}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <CommissionCalcDetails details={r.calc_details} />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucune commission.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
