import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";

const REQUIRED_AUTHENTICATED = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;
const REQUIRED_SERVICE_ROLE = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;

type GrantRow = { grantee: string; privilege_type: string; is_grantable: boolean };
type RlsRow = {
  rls_enabled: boolean;
  policy_name: string | null;
  cmd: string | null;
  roles: string[] | null;
  qual: string | null;
  with_check: string | null;
};

export default function AdminTableGrantsAudit() {
  const [schema, setSchema] = useState("public");
  const [table, setTable] = useState("vendors");
  const [query, setQuery] = useState({ schema: "public", table: "vendors" });

  const grantsQ = useQuery({
    queryKey: ["admin-table-grants", query.schema, query.table],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_inspect_table_grants" as any, {
        _schema: query.schema,
        _table: query.table,
      });
      if (error) throw error;
      return (data ?? []) as GrantRow[];
    },
  });

  const rlsQ = useQuery({
    queryKey: ["admin-table-rls", query.schema, query.table],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_inspect_table_rls" as any, {
        _schema: query.schema,
        _table: query.table,
      });
      if (error) throw error;
      return (data ?? []) as RlsRow[];
    },
  });

  const grants = grantsQ.data ?? [];
  const rls = rlsQ.data ?? [];
  const rlsEnabled = rls[0]?.rls_enabled ?? false;
  const policies = rls.filter((r) => r.policy_name);

  const privsByRole = (role: string) =>
    new Set(grants.filter((g) => g.grantee === role).map((g) => g.privilege_type));
  const authPrivs = privsByRole("authenticated");
  const srvPrivs = privsByRole("service_role");
  const anonPrivs = privsByRole("anon");

  const missingAuth = REQUIRED_AUTHENTICATED.filter((p) => !authPrivs.has(p));
  const missingSrv = REQUIRED_SERVICE_ROLE.filter((p) => !srvPrivs.has(p));

  const reload = () => {
    setQuery({ schema, table });
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldAlert className="w-6 h-6" /> Audit GRANT & RLS — diagnostic permissions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inspecte les <code>GRANT</code> table-level et les policies RLS d'une table publique pour
          diagnostiquer rapidement les régressions (ex : embed <code>vendors(...)</code> qui renvoie 0
          ligne suite à un GRANT manquant).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cible</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Schéma</label>
            <Input value={schema} onChange={(e) => setSchema(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Table</label>
            <Input value={table} onChange={(e) => setTable(e.target.value)} className="w-60" />
          </div>
          <Button onClick={reload} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Inspecter
          </Button>
          <div className="flex gap-2 ml-auto">
            {["vendors", "orders", "quotes", "offers", "customers"].map((t) => (
              <Button
                key={t}
                size="sm"
                variant="outline"
                onClick={() => {
                  setSchema("public");
                  setTable(t);
                  setQuery({ schema: "public", table: t });
                }}
              >
                {t}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            GRANT par rôle
            {(missingAuth.length > 0 || missingSrv.length > 0) && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" /> Permissions incomplètes
              </Badge>
            )}
            {missingAuth.length === 0 && missingSrv.length === 0 && grants.length > 0 && (
              <Badge className="gap-1 bg-emerald-600">
                <CheckCircle2 className="w-3 h-3" /> OK
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {grantsQ.isLoading && <div className="text-sm">Chargement…</div>}
          {grantsQ.error && (
            <div className="text-sm text-red-600">{(grantsQ.error as any).message}</div>
          )}
          {!grantsQ.isLoading && !grantsQ.error && (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Rôle</th>
                    <th>SELECT</th>
                    <th>INSERT</th>
                    <th>UPDATE</th>
                    <th>DELETE</th>
                    <th>Autres</th>
                  </tr>
                </thead>
                <tbody>
                  {["anon", "authenticated", "service_role", "postgres"].map((role) => {
                    const privs = privsByRole(role);
                    const others = [...privs].filter(
                      (p) => !["SELECT", "INSERT", "UPDATE", "DELETE"].includes(p),
                    );
                    const present = privs.size > 0;
                    return (
                      <tr key={role} className="border-b">
                        <td className="py-2 font-mono">{role}</td>
                        {(["SELECT", "INSERT", "UPDATE", "DELETE"] as const).map((p) => (
                          <td key={p}>
                            {privs.has(p) ? (
                              <span className="text-emerald-600">✓</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ))}
                        <td className="text-xs text-muted-foreground">
                          {present ? others.join(", ") || "—" : "aucun grant"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {(missingAuth.length > 0 || missingSrv.length > 0) && (
                <div className="mt-4 p-3 rounded bg-red-50 border border-red-200 text-sm">
                  <div className="font-semibold text-red-700 mb-1">Correctif suggéré</div>
                  <pre className="text-xs overflow-x-auto bg-white p-2 rounded border">
{missingAuth.length > 0 &&
  `GRANT ${missingAuth.join(", ")} ON ${query.schema}.${query.table} TO authenticated;\n`}
{missingSrv.length > 0 &&
  `GRANT ${missingSrv.join(", ")} ON ${query.schema}.${query.table} TO service_role;`}
                  </pre>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Row Level Security
            {rlsEnabled ? (
              <Badge className="bg-emerald-600">activée</Badge>
            ) : (
              <Badge variant="destructive">désactivée</Badge>
            )}
            <span className="text-xs text-muted-foreground ml-2">
              {policies.length} polic{policies.length > 1 ? "ies" : "y"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rlsQ.isLoading && <div className="text-sm">Chargement…</div>}
          {rlsQ.error && <div className="text-sm text-red-600">{(rlsQ.error as any).message}</div>}
          {!rlsQ.isLoading && !rlsQ.error && policies.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Aucune policy déclarée. Si RLS est activée, toutes les requêtes non-admin renverront 0
              ligne.
            </div>
          )}
          {policies.length > 0 && (
            <div className="space-y-3">
              {policies.map((p) => (
                <div key={p.policy_name!} className="border rounded p-3 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">{p.policy_name}</span>
                    <Badge variant="outline">{p.cmd}</Badge>
                    <span className="text-xs text-muted-foreground">
                      rôles : {(p.roles ?? []).join(", ") || "—"}
                    </span>
                  </div>
                  {p.qual && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">USING:</span>{" "}
                      <code className="break-all">{p.qual}</code>
                    </div>
                  )}
                  {p.with_check && (
                    <div className="text-xs mt-1">
                      <span className="text-muted-foreground">WITH CHECK:</span>{" "}
                      <code className="break-all">{p.with_check}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
