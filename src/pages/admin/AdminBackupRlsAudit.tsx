import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, RefreshCw } from "lucide-react";

interface AuditRow {
  table_name: string;
  rls_enabled: boolean;
  policy_count: number;
  anon_has_grants: boolean;
  authenticated_has_grants: boolean;
  status: "ok" | "warn" | "fail";
  issues: string[];
}

const STATUS_META: Record<AuditRow["status"], { label: string; variant: "default" | "secondary" | "destructive"; icon: typeof ShieldCheck }> = {
  ok: { label: "OK", variant: "default", icon: ShieldCheck },
  warn: { label: "À auditer", variant: "secondary", icon: ShieldAlert },
  fail: { label: "Échec", variant: "destructive", icon: ShieldX },
};

export default function AdminBackupRlsAudit() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function runAudit() {
    setLoading(true);
    const { data, error } = await supabase.rpc("audit_backup_tables_rls" as any);
    if (error) {
      toast({ title: "Erreur audit", description: error.message, variant: "destructive" });
      setRows([]);
    } else {
      setRows((data as AuditRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    runAudit();
  }, []);

  const failCount = rows.filter((r) => r.status === "fail").length;
  const warnCount = rows.filter((r) => r.status === "warn").length;
  const okCount = rows.filter((r) => r.status === "ok").length;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Helmet>
        <title>Audit RLS des tables de backup — MediKong Admin</title>
      </Helmet>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7" />
            Audit RLS — tables de backup
          </h1>
          <p className="text-muted-foreground mt-1">
            Vérifie automatiquement que toutes les tables <code>*_backup_*</code> ont RLS activé et aucun accès <code>anon</code> / <code>authenticated</code>.
          </p>
        </div>
        <Button onClick={runAudit} disabled={loading} variant="outline">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Relancer
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">OK</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{okCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">À auditer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{warnCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Échecs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{failCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Résultat de l'audit ({rows.length} table{rows.length > 1 ? "s" : ""})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucune table de backup détectée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="py-2 px-2">Table</th>
                    <th className="py-2 px-2">Statut</th>
                    <th className="py-2 px-2">RLS</th>
                    <th className="py-2 px-2">Policies</th>
                    <th className="py-2 px-2">anon</th>
                    <th className="py-2 px-2">authenticated</th>
                    <th className="py-2 px-2">Problèmes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const meta = STATUS_META[r.status];
                    const Icon = meta.icon;
                    return (
                      <tr key={r.table_name} className="border-b hover:bg-muted/40">
                        <td className="py-2 px-2 font-mono text-xs">{r.table_name}</td>
                        <td className="py-2 px-2">
                          <Badge variant={meta.variant} className="gap-1">
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          {r.rls_enabled ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-destructive font-bold">✗</span>
                          )}
                        </td>
                        <td className="py-2 px-2">{r.policy_count}</td>
                        <td className="py-2 px-2">
                          {r.anon_has_grants ? <span className="text-destructive font-bold">✗</span> : <span className="text-green-600">✓</span>}
                        </td>
                        <td className="py-2 px-2">
                          {r.authenticated_has_grants ? (
                            <span className="text-destructive font-bold">✗</span>
                          ) : (
                            <span className="text-green-600">✓</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">
                          {r.issues.length === 0 ? "—" : r.issues.join(" · ")}
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

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">Critères de validation</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong className="text-foreground">OK</strong> : RLS activée, aucun grant pour <code>anon</code>/<code>authenticated</code>, aucune policy permissive (seul <code>service_role</code> accède).</p>
          <p><strong className="text-foreground">À auditer</strong> : RLS activée mais des policies existent — à revoir manuellement pour confirmer qu'elles n'exposent pas la donnée.</p>
          <p><strong className="text-foreground">Échec</strong> : RLS désactivée ou permissions accordées à <code>anon</code>/<code>authenticated</code>. À corriger immédiatement.</p>
        </CardContent>
      </Card>
    </div>
  );
}
