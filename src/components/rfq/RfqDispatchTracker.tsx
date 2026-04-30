import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRfqDispatchSummary } from "@/hooks/useRfqDispatch";
import { Eye, MailOpen, MousePointerClick, BellRing, CheckCircle2, XCircle, Clock, Send } from "lucide-react";

interface Props {
  rfqId: string;
  className?: string;
}

const reasonLabel: Record<string, string> = {
  product_offer: "Catalogue produit",
  product_interest: "Produit suivi",
  brand_interest: "Marque suivie",
  manufacturer_interest: "Fabricant suivi",
  manual: "Ajout manuel",
};

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  dispatched: { label: "Envoyée", variant: "secondary" },
  viewed: { label: "Vue", variant: "outline" },
  reminded: { label: "Relancée", variant: "default" },
  responded: { label: "Répondue", variant: "default" },
  declined: { label: "Refusée", variant: "destructive" },
  expired: { label: "Expirée", variant: "outline" },
};

export function RfqDispatchTracker({ rfqId, className }: Props) {
  const { data, summary, isLoading } = useRfqDispatchSummary(rfqId);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader><CardTitle className="text-base">Suivi de la diffusion</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Suivi de la diffusion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={<Send className="h-4 w-4" />} label="Vendeurs ciblés" value={summary.targeted} />
          <Stat icon={<MailOpen className="h-4 w-4" />} label="Email ouvert" value={summary.opened} />
          <Stat icon={<MousePointerClick className="h-4 w-4" />} label="Cliqué" value={summary.clicked} />
          <Stat icon={<Eye className="h-4 w-4" />} label="Vue dans portail" value={summary.viewed} />
          <Stat icon={<BellRing className="h-4 w-4" />} label="Relancés" value={summary.reminded} />
          <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Réponses" value={summary.responded} highlight />
          <Stat icon={<XCircle className="h-4 w-4" />} label="Refus" value={summary.declined} />
          <Stat icon={<Clock className="h-4 w-4" />} label="Expirés" value={summary.expired} />
        </div>

        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun vendeur ciblé pour le moment.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Vendeur</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium">Envoyée</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const st = statusLabel[row.status] ?? { label: row.status, variant: "outline" as const };
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {row.vendor_id.slice(0, 8)}…
                      </td>
                      <td className="px-3 py-2 text-xs">{reasonLabel[row.reason] ?? row.reason}</td>
                      <td className="px-3 py-2"><Badge variant={st.variant}>{st.label}</Badge></td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(row.dispatched_at).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "bg-primary/5 border-primary/30" : "bg-card"}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
