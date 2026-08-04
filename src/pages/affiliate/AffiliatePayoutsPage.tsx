// Portail apporteur — Payouts (auto-facturation MediKong).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAffiliateAccount, affiliateArgs } from "@/hooks/useAffiliateAccount";
import { fmtCents, fmtDate, VAT_MODE_LABELS } from "@/lib/affiliate-format";
import { FileText, AlertTriangle } from "lucide-react";

type Payout = {
  id: string;
  invoice_number: string | null;
  period_start: string;
  period_end: string;
  total_cents: number;
  vat_mode: string;
  vat_rate_bp: number | null;
  vat_cents: number | null;
  total_ttc_cents: number | null;
  status: string;
  pdf_path: string | null;
  issued_at: string | null;
  paid_at: string | null;
};

const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "En préparation", className: "bg-muted text-muted-foreground" },
  issued: { label: "Émise", className: "bg-blue-100 text-blue-800" },
  paid: { label: "Payée", className: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Annulée", className: "bg-muted text-muted-foreground" },
};

// La TVA n'est jamais calculée côté client : elle est figée en base à l'émission
// de la note (colonnes vat_rate_bp / vat_cents / total_ttc_cents).

export default function AffiliatePayoutsPage() {
  const { account, asAffiliateId } = useAffiliateAccount();

  const { data: rows = [] } = useQuery<Payout[]>({
    queryKey: ["affiliate-payouts", asAffiliateId],
    enabled: Boolean(account),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("affiliate_my_payouts", affiliateArgs(asAffiliateId));
      if (error) throw error;
      return (data as Payout[]) ?? [];
    },
  });

  const openPdf = async (p: Payout) => {
    try {
      const { data, error } = await supabase.functions.invoke("affiliate-payout-pdf", { body: { payout_id: p.id } });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error((data as any)?.error ?? "PDF indisponible");
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e.message ?? "Impossible d'ouvrir la note de commission");
    }
  };

  const missingBilling = !account?.iban_masked || !account?.vat_number;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          MediKong établit la note de commission pour votre compte (auto-facturation) et vous règle par virement.
        </p>
      </div>

      {missingBilling && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex gap-3 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Informations de paiement incomplètes</p>
              <p>Transmettez votre IBAN et votre numéro de TVA à MediKong pour que vos commissions validées puissent être réglées.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Mes coordonnées de paiement</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Bénéficiaire</p>
            <p>{account?.company_name || account?.display_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Numéro de TVA</p>
            <p>{account?.vat_number || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">IBAN</p>
            <p className="font-mono">{account?.iban_masked || "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Note</th>
                <th className="p-3">Période</th>
                <th className="p-3 text-right">HTVA</th>
                <th className="p-3 text-right">TVA</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const st = STATUS[p.status] ?? { label: p.status, className: "" };
                const vatCents = Number(p.vat_cents) || 0;
                const vatRateBp = Number(p.vat_rate_bp) || 0;
                return (
                  <tr key={p.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{p.invoice_number ?? "—"}</td>
                    <td className="p-3">{fmtDate(p.period_start)} → {fmtDate(p.period_end)}</td>
                    <td className="p-3 text-right">{fmtCents(p.total_cents)}</td>
                    <td className="p-3 text-right">
                      {fmtCents(vatCents)}
                      <p className="text-[11px] text-muted-foreground">
                        {VAT_MODE_LABELS[p.vat_mode] ?? p.vat_mode}
                        {vatRateBp > 0 ? ` · ${(vatRateBp / 100).toFixed(0)} %` : ""}
                      </p>
                    </td>
                    <td className="p-3 text-right font-medium">{fmtCents(Number(p.total_ttc_cents ?? Number(p.total_cents) + vatCents))}</td>
                    <td className="p-3">
                      <Badge className={st.className}>{st.label}</Badge>
                      {p.paid_at && <p className="text-[11px] text-muted-foreground mt-1">le {fmtDate(p.paid_at)}</p>}
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openPdf(p)}>
                        <FileText className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucun payout pour l'instant.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
