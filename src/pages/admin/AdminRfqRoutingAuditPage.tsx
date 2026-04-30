import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, RefreshCw, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

type Decision = "selected" | "excluded" | "over_cap";

interface AuditRow {
  id: string;
  rfq_id: string;
  vendor_id: string;
  vendor_name: string | null;
  vendor_company: string | null;
  vendor_country: string | null;
  decision: Decision;
  reason_code: string;
  reason_label: string | null;
  matched_reason: string | null;
  score: number | null;
  rank_position: number | null;
  cap_applied: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
  rfq_status: string | null;
  rfq_created_at: string | null;
  product_id: string | null;
  brand_id: string | null;
  quantity: number | null;
  destination_country_code: string | null;
  currency_code: string | null;
}

const DECISION_META: Record<Decision, { label: string; variant: "default" | "destructive" | "secondary"; icon: typeof ShieldCheck }> = {
  selected: { label: "Sélectionné", variant: "default", icon: ShieldCheck },
  excluded: { label: "Exclu", variant: "destructive", icon: ShieldX },
  over_cap: { label: "Hors Top N", variant: "secondary", icon: ShieldAlert },
};

export default function AdminRfqRoutingAuditPage() {
  const qc = useQueryClient();
  const [rfqId, setRfqId] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<"all" | Decision>("all");

  const { data: rfqs } = useQuery({
    queryKey: ["admin-rfq-list-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfqs")
        .select("id, status, created_at, quantity, destination_country_code")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: ["rfq-routing-audit", rfqId],
    queryFn: async () => {
      if (!rfqId) return [];
      const { data, error } = await supabase
        .from("rfq_routing_audit_v" as never)
        .select("*")
        .eq("rfq_id", rfqId)
        .order("decision", { ascending: true })
        .order("rank_position", { ascending: true, nullsFirst: false })
        .order("score", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
    enabled: Boolean(rfqId),
  });

  const replay = useMutation({
    mutationFn: async () => {
      if (!rfqId) throw new Error("Sélectionnez une RFQ");
      const { data, error } = await supabase.rpc("rfq_audit_routing" as never, { _rfq_id: rfqId } as never);
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      toast.success(`Audit régénéré (${count} lignes)`);
      qc.invalidateQueries({ queryKey: ["rfq-routing-audit", rfqId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => decisionFilter === "all" || r.decision === decisionFilter),
    [rows, decisionFilter]
  );

  const summary = useMemo(() => {
    const acc = { selected: 0, excluded: 0, over_cap: 0 };
    (rows ?? []).forEach((r) => { acc[r.decision] += 1; });
    return acc;
  }, [rows]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Journal d'audit du routage RFQ</h1>
        <p className="text-muted-foreground mt-1">
          Pour chaque demande envoyée : qui a été sélectionné, exclu (pourquoi) ou laissé hors-cap.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sélection RFQ</CardTitle>
          <CardDescription>Choisis une RFQ récente ou colle son ID, puis consulte l'audit.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <Select value={rfqId} onValueChange={setRfqId}>
            <SelectTrigger className="md:w-[420px]">
              <SelectValue placeholder="Choisir une RFQ récente…" />
            </SelectTrigger>
            <SelectContent>
              {(rfqs ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.id.slice(0, 8)} · {r.status} · qty {r.quantity} · {r.destination_country_code ?? "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="ou coller un RFQ UUID"
            value={rfqId}
            onChange={(e) => setRfqId(e.target.value.trim())}
            className="md:w-[360px] font-mono text-xs"
          />
          <Button variant="outline" onClick={() => refetch()} disabled={!rfqId}>
            <RefreshCw className="h-4 w-4 mr-2" /> Recharger
          </Button>
          <Button onClick={() => replay.mutate()} disabled={!rfqId || replay.isPending}>
            {replay.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Rejouer l'audit
          </Button>
        </CardContent>
      </Card>

      {rfqId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Décisions</CardTitle>
              <CardDescription>
                <Badge variant="default" className="mr-2">{summary.selected} sélectionnés</Badge>
                <Badge variant="secondary" className="mr-2">{summary.over_cap} hors Top N</Badge>
                <Badge variant="destructive">{summary.excluded} exclus</Badge>
              </CardDescription>
            </div>
            <Select value={decisionFilter} onValueChange={(v) => setDecisionFilter(v as typeof decisionFilter)}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les décisions</SelectItem>
                <SelectItem value="selected">Sélectionnés</SelectItem>
                <SelectItem value="over_cap">Hors Top N</SelectItem>
                <SelectItem value="excluded">Exclus</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Aucune ligne d'audit. Lance "Rejouer l'audit" pour calculer.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Décision</TableHead>
                      <TableHead>Vendeur</TableHead>
                      <TableHead>Pays</TableHead>
                      <TableHead>Ciblage</TableHead>
                      <TableHead>Raison</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">Rang</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const meta = DECISION_META[r.decision];
                      const Icon = meta.icon;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Badge variant={meta.variant} className="gap-1">
                              <Icon className="h-3 w-3" /> {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{r.vendor_company || r.vendor_name || r.vendor_id.slice(0, 8)}</div>
                            <div className="text-xs text-muted-foreground font-mono">{r.vendor_id.slice(0, 8)}</div>
                          </TableCell>
                          <TableCell className="text-sm">{r.vendor_country ?? "—"}</TableCell>
                          <TableCell className="text-sm">{r.matched_reason ?? "—"}</TableCell>
                          <TableCell className="text-sm">
                            <div>{r.reason_label ?? r.reason_code}</div>
                            <details className="mt-1">
                              <summary className="text-xs text-muted-foreground cursor-pointer">détails</summary>
                              <pre className="text-[10px] bg-muted p-2 rounded mt-1 overflow-x-auto max-w-md">
                                {JSON.stringify(r.details, null, 2)}
                              </pre>
                            </details>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {r.score != null ? r.score.toFixed(3) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {r.rank_position ?? "—"}
                            {r.cap_applied ? <span className="text-muted-foreground"> / {r.cap_applied}</span> : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
