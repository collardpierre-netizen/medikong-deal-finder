import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle2, XCircle, RefreshCw, KeyRound } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatUpdatedAtFull } from "@/lib/format-date";

interface TestRow {
  id: string;
  tested_at: string;
  tested_email_masked: string | null;
  success: boolean;
  http_status: number | null;
  latency_ms: number | null;
  error_message: string | null;
  source: string;
}

interface ConfigRow {
  key: string;
  value: string;
  updated_at: string;
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export default function AdminQogitaConnection() {
  const qc = useQueryClient();
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: config } = useQuery({
    queryKey: ["qogita-config-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qogita_config")
        .select("key, value, updated_at")
        .in("key", ["qogita_email", "qogita_password", "base_url", "bearer_token"]);
      if (error) throw error;
      const map: Record<string, ConfigRow> = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r; });
      return map;
    },
  });

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["qogita-connection-tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qogita_connection_tests")
        .select("*")
        .order("tested_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as TestRow[];
    },
    refetchInterval: 30_000,
  });

  const runTest = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("test-qogita-stored-credentials");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setLastResult(data);
      qc.invalidateQueries({ queryKey: ["qogita-connection-tests"] });
      qc.invalidateQueries({ queryKey: ["qogita-config-active"] });
      toast({
        title: data?.success ? "Connexion Qogita OK" : "Échec de la connexion Qogita",
        description: data?.success
          ? `Latence : ${data.latency_ms} ms`
          : data?.error_message ?? "Erreur inconnue",
        variant: data?.success ? "default" : "destructive",
      });
    },
    onError: (e: any) => {
      toast({ title: "Erreur", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const email = config?.qogita_email?.value ?? null;
  const credsUpdatedAt = config?.qogita_password?.updated_at ?? config?.qogita_email?.updated_at ?? null;
  const baseUrl = config?.base_url?.value ?? "https://api.qogita.com";
  const bearerUpdatedAt = config?.bearer_token?.updated_at ?? null;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Connexion Qogita</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Teste la connexion à l'API Qogita avec les identifiants actuellement stockés dans <code>qogita_config</code>
          et conserve un historique des derniers tests.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" /> Identifiants actifs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-muted-foreground text-xs">Email</div>
              <div className="font-mono">{maskEmail(email) ?? <span className="text-destructive">Non défini</span>}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Mot de passe</div>
              <div className="font-mono">
                {config?.qogita_password?.value
                  ? `••••••••  (${config.qogita_password.value.length} car.)`
                  : <span className="text-destructive">Non défini</span>}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Base URL</div>
              <div className="font-mono">{baseUrl}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Dernière rotation des credentials</div>
              <div>{credsUpdatedAt ? formatUpdatedAtFull(credsUpdatedAt) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Bearer token rafraîchi</div>
              <div>{bearerUpdatedAt ? formatUpdatedAtFull(bearerUpdatedAt) : "—"}</div>
            </div>
          </div>
          <div className="pt-3 flex items-center gap-3">
            <Button onClick={() => runTest.mutate()} disabled={runTest.isPending}>
              {runTest.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Tester la connexion maintenant
            </Button>
            {lastResult && (
              <Badge variant={lastResult.success ? "default" : "destructive"}>
                {lastResult.success ? "Connexion OK" : "Échec"}
                {lastResult.latency_ms != null && ` · ${lastResult.latency_ms} ms`}
              </Badge>
            )}
          </div>
          {lastResult && !lastResult.success && lastResult.error_message && (
            <p className="text-xs text-destructive pt-2">{lastResult.error_message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des 20 derniers tests</CardTitle>
        </CardHeader>
        <CardContent>
          {histLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
            </div>
          ) : !history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun test enregistré.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Email testé</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Latence</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Détail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{formatUpdatedAtFull(row.tested_at)}</TableCell>
                    <TableCell>
                      {row.success ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium">
                          <XCircle className="w-4 h-4" /> Échec
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.tested_email_masked ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.http_status ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.latency_ms != null ? `${row.latency_ms} ms` : "—"}</TableCell>
                    <TableCell className="text-xs">{row.source}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate" title={row.error_message ?? ""}>
                      {row.error_message ?? (row.success ? "—" : "")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
