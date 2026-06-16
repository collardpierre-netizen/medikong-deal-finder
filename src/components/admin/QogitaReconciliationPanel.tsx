import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

type SweepRow = {
  id: string;
  sweep_type: string | null;
  sync_run_id: string | null;
  status: string;
  country_code: string | null;
  threshold_days: number | null;
  entities_deactivated: Record<string, number> | null;
  entities_spared: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
};

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "success") return "default";
  if (s === "needs_review") return "destructive";
  if (s === "skipped_guardrail") return "outline";
  return "secondary";
}

export default function QogitaReconciliationPanel() {
  const qc = useQueryClient();
  const [reactKind, setReactKind] = useState<"offer" | "product" | "vendor">("offer");
  const [reactId, setReactId] = useState("");
  const [reactReason, setReactReason] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["qogita-reconciliation-history"],
    queryFn: async (): Promise<SweepRow[]> => {
      const { data, error } = await supabase.rpc("admin_qogita_reconciliation_history", { _limit: 50 });
      if (error) throw error;
      return (data ?? []) as SweepRow[];
    },
  });

  const reactivate = useMutation({
    mutationFn: async () => {
      if (!reactId) throw new Error("ID requis");
      const { data, error } = await supabase.rpc("qogita_reactivate_entity", {
        _kind: reactKind, _id: reactId, _reason: reactReason || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Entité réactivée" });
      setReactId(""); setReactReason("");
      qc.invalidateQueries({ queryKey: ["qogita-reconciliation-history"] });
    },
    onError: (e: any) => toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Réconciliation Qogita — Historique</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">Aucun balayage de réconciliation pour l'instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Statut</th>
                    <th className="text-left p-2">Pays</th>
                    <th className="text-right p-2">Offres ✕</th>
                    <th className="text-right p-2">Produits ✕</th>
                    <th className="text-right p-2">Vendeurs ✕</th>
                    <th className="text-left p-2">Épargné (raison)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => {
                    const d = row.entities_deactivated ?? {};
                    const spared = (row.entities_spared ?? {}) as { reason?: string };
                    return (
                      <tr key={row.id} className="border-b hover:bg-muted/30">
                        <td className="p-2">{new Date(row.started_at).toLocaleString("fr-FR")}</td>
                        <td className="p-2">{row.sweep_type ?? "—"}{row.threshold_days ? ` (${row.threshold_days}j)` : ""}</td>
                        <td className="p-2"><Badge variant={statusVariant(row.status)}>{row.status}</Badge></td>
                        <td className="p-2">{row.country_code ?? "—"}</td>
                        <td className="p-2 text-right">{(d as any).offers ?? 0}</td>
                        <td className="p-2 text-right">{(d as any).products ?? 0}</td>
                        <td className="p-2 text-right">{(d as any).vendors ?? 0}</td>
                        <td className="p-2 text-muted-foreground">{spared.reason ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Réactivation manuelle d'une entité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <Select value={reactKind} onValueChange={(v) => setReactKind(v as any)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="offer">Offre</SelectItem>
                  <SelectItem value="product">Produit</SelectItem>
                  <SelectItem value="vendor">Vendeur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[240px]">
              <label className="text-xs text-muted-foreground">ID (uuid)</label>
              <Input value={reactId} onChange={(e) => setReactId(e.target.value)} placeholder="00000000-..." />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Raison (optionnel)</label>
              <Input value={reactReason} onChange={(e) => setReactReason(e.target.value)} />
            </div>
            <Button onClick={() => reactivate.mutate()} disabled={reactivate.isPending || !reactId}>
              Réactiver
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Réactivation tracée dans audit_logs. À utiliser uniquement après validation manuelle.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
