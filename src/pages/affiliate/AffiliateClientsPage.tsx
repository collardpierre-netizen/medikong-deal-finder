// Portail apporteur — Mes clients.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import AffiliateClientSheet from "@/components/affiliate/AffiliateClientSheet";
import { useAffiliateAccount, affiliateArgs } from "@/hooks/useAffiliateAccount";
import { fmtCents, fmtDate, daysUntil } from "@/lib/affiliate-format";

type Referral = {
  referral_id: string;
  pseudo: string;
  client_name: string | null;
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
  const [openReferralId, setOpenReferralId] = useState<string | null>(null);
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
        <p className="text-sm text-muted-foreground mt-1">
          Clients attribués à votre code apporteur. Ouvrez la fiche client pour l'appeler et suivre ses commandes.
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
                <th className="p-3 text-right">Fiche</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const left = daysUntil(r.window_expires_at);
                return (
                  <tr key={`${r.pseudo}-${i}`} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{r.client_name ?? "—"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{r.pseudo}</div>
                    </td>
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
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setOpenReferralId(r.referral_id)}>
                        <Phone className="h-3.5 w-3.5 mr-1" /> Fiche client
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Aucun client attribué pour l'instant.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <AffiliateClientSheet referralId={openReferralId} onClose={() => setOpenReferralId(null)} />
    </div>
  );
}
