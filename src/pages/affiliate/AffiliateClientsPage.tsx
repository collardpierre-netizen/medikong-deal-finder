// Portail apporteur — Mes clients (pseudonymisés).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAffiliateAccount, affiliateArgs } from "@/hooks/useAffiliateAccount";
import { fmtCents, fmtDate, daysUntil } from "@/lib/affiliate-format";
import { ShieldCheck } from "lucide-react";

type Referral = {
  pseudo: string;
  attributed_at: string | null;
  first_order_at: string | null;
  window_expires_at: string | null;
  status: string;
  orders_count: number;
  revenue_ht_cents: number;
};

const STATUS_LABELS: Record<string, string> = {
  attributed: "Inscrit, pas encore acheté",
  converted: "Client actif",
  expired: "Attribution terminée",
  revoked: "Attribution retirée",
};

export default function AffiliateClientsPage() {
  const { account, asAffiliateId } = useAffiliateAccount();
  const { data: rows = [] } = useQuery<Referral[]>({
    queryKey: ["affiliate-referrals", asAffiliateId],
    enabled: Boolean(account),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("affiliate_my_referrals", affiliateArgs(asAffiliateId));
      if (error) throw error;
      return (data as Referral[]) ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Mes clients</h1>
        <p className="text-sm text-muted-foreground flex items-start gap-1.5 mt-1">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          Pour protéger la confidentialité de vos clients, seul un identifiant anonyme vous est communiqué.
          MediKong ne transmet ni nom, ni email, ni téléphone.
        </p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Client</th>
                <th className="p-3">Inscrit le</th>
                <th className="p-3">1ʳᵉ commande</th>
                <th className="p-3 text-right">Commandes</th>
                <th className="p-3 text-right">CA HTVA</th>
                <th className="p-3">Situation</th>
                <th className="p-3">Attribution</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const left = daysUntil(r.window_expires_at);
                return (
                  <tr key={`${r.pseudo}-${i}`} className="border-t">
                    <td className="p-3 font-mono text-xs">{r.pseudo}</td>
                    <td className="p-3">{fmtDate(r.attributed_at)}</td>
                    <td className="p-3">{fmtDate(r.first_order_at)}</td>
                    <td className="p-3 text-right">{r.orders_count}</td>
                    <td className="p-3 text-right">{fmtCents(r.revenue_ht_cents)}</td>
                    <td className="p-3 text-muted-foreground">{STATUS_LABELS[r.status] ?? r.status}</td>
                    <td className="p-3">
                      {left == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : left <= 0 ? (
                        <Badge variant="secondary">Terminée</Badge>
                      ) : (
                        <Badge className={left <= 30 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}>
                          {left} j restants
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucun client attribué pour l'instant.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
