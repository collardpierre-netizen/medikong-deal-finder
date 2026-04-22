import { useEffect, useState, useCallback } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import {
  validateContractEnv,
  type ContractEnvHealth,
} from "@/lib/contract/env-validation";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Clock,
  ServerCog,
  Database,
} from "lucide-react";

/**
 * Page d'audit dédiée à la chaîne de signature des conventions vendeur.
 * Combine 3 sources de vérification :
 *   1. Côté navigateur : variables Vite + ping bucket public (env-validation.ts)
 *   2. Côté serveur   : edge function `contract-pdf-healthcheck` (RLS, write/read,
 *      tables seller_contracts + audit_logs, validation template)
 *   3. Disponibilité  : ping de l'edge function `generate-contract-pdf` via OPTIONS
 *      (preflight CORS) — ne déclenche aucune signature.
 */

type ServerCheck = {
  id: string;
  label: string;
  severity: "info" | "warning" | "error";
  ok: boolean;
  detail: string;
  remediation?: string;
  durationMs?: number;
};

type ServerHealth = {
  status: "ok" | "degraded" | "error";
  checkedAt: string;
  checks: ServerCheck[];
  runtime?: { region?: string };
};

type EdgeAvailability = {
  ok: boolean;
  detail: string;
  durationMs: number;
  status?: number;
};

const SEVERITY_STYLES: Record<
  "info" | "warning" | "error",
  { icon: typeof CheckCircle2; badge: string; iconClass: string }
> = {
  info: {
    icon: CheckCircle2,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconClass: "text-emerald-600",
  },
  warning: {
    icon: AlertTriangle,
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    iconClass: "text-amber-600",
  },
  error: {
    icon: AlertCircle,
    badge: "bg-red-50 text-red-700 border-red-200",
    iconClass: "text-red-600",
  },
};

function CheckRow({ check }: { check: ServerCheck }) {
  const style = SEVERITY_STYLES[check.severity];
  const Icon = check.ok ? CheckCircle2 : style.icon;
  const iconClass = check.ok ? "text-emerald-600" : style.iconClass;
  return (
    <div className="flex gap-3 p-4 border-b last:border-b-0">
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="font-medium text-sm text-slate-900">{check.label}</p>
          <div className="flex items-center gap-2">
            {typeof check.durationMs === "number" && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {check.durationMs} ms
              </span>
            )}
            <Badge variant="outline" className={`text-[10px] uppercase ${style.badge}`}>
              {check.ok ? "OK" : check.severity}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-1 break-words">{check.detail}</p>
        {!check.ok && check.remediation && (
          <p className="text-xs text-slate-700 mt-2 p-2 bg-slate-50 rounded border border-slate-200">
            <span className="font-semibold">Action :</span> {check.remediation}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "ok" | "degraded" | "error" | "loading" }) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Vérification en cours...
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
        <CheckCircle2 className="w-4 h-4" /> Tous les contrôles passent
      </span>
    );
  }
  if (status === "degraded") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-sm border border-amber-200">
        <AlertTriangle className="w-4 h-4" /> Avertissements détectés
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm border border-red-200">
      <AlertCircle className="w-4 h-4" /> Erreurs bloquantes
    </span>
  );
}

const AdminContractAudit = () => {
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState(false);

  const [clientHealth, setClientHealth] = useState<ContractEnvHealth | null>(null);
  const [edgeAvail, setEdgeAvail] = useState<EdgeAvailability | null>(null);

  const runChecks = useCallback(async () => {
    setServerLoading(true);
    setServerError(null);

    // 1) Client-side env validation (toujours rapide).
    const clientPromise = validateContractEnv();

    // 2) Edge function availability — preflight OPTIONS sans body.
    const edgeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-contract-pdf`;
    const edgePromise = (async (): Promise<EdgeAvailability> => {
      const start = performance.now();
      try {
        const res = await fetch(edgeUrl, { method: "OPTIONS" });
        await res.text();
        return {
          ok: res.ok || res.status === 204,
          status: res.status,
          detail: `Preflight CORS répondu (HTTP ${res.status}).`,
          durationMs: Math.round(performance.now() - start),
        };
      } catch (e) {
        return {
          ok: false,
          detail: `Edge function injoignable : ${(e as Error).message}`,
          durationMs: Math.round(performance.now() - start),
        };
      }
    })();

    // 3) Server-side health-check (auth requise).
    const serverPromise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke<ServerHealth>(
          "contract-pdf-healthcheck",
          { method: "POST" },
        );
        if (error) throw error;
        if (!data) throw new Error("Réponse vide");
        return data;
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e));
      }
    })();

    const [client, edge] = await Promise.all([clientPromise, edgePromise]);
    setClientHealth(client);
    setEdgeAvail(edge);

    try {
      const server = await serverPromise;
      setServerHealth(server);
    } catch (e) {
      setServerError((e as Error).message);
      setServerHealth(null);
    } finally {
      setServerLoading(false);
    }
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  // Status global = pire des trois sources.
  const globalStatus: "ok" | "degraded" | "error" | "loading" = (() => {
    if (serverLoading && !serverHealth) return "loading";
    if (serverError) return "error";
    const s = serverHealth?.status ?? "ok";
    const clientErr = clientHealth?.hasErrors ?? false;
    const clientWarn = clientHealth?.hasWarnings ?? false;
    const edgeErr = edgeAvail && !edgeAvail.ok;
    if (s === "error" || clientErr || edgeErr) return "error";
    if (s === "degraded" || clientWarn) return "degraded";
    return "ok";
  })();

  const blockingIssues = [
    ...(serverHealth?.checks ?? []).filter((c) => !c.ok && c.severity === "error"),
    ...(clientHealth?.results ?? [])
      .filter((r) => r.severity === "error")
      .map<ServerCheck>((r) => ({
        id: `client.${r.key}`,
        label: r.label,
        severity: "error",
        ok: false,
        detail: r.detail,
        remediation: r.remediation,
      })),
    ...(edgeAvail && !edgeAvail.ok
      ? [
          {
            id: "edge.generate_contract_pdf",
            label: "Edge function generate-contract-pdf",
            severity: "error" as const,
            ok: false,
            detail: edgeAvail.detail,
            remediation:
              "Vérifiez le déploiement de la fonction et la configuration CORS.",
          },
        ]
      : []),
  ];

  return (
    <div>
      <AdminTopBar
        title="Audit configuration contrats PDF"
        breadcrumb={["Admin", "Audit", "Contrats PDF"]}
      />

      <div className="p-6 space-y-6">
        {/* En-tête + statut global */}
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-mk-blue" />
                Diagnostic temps réel
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Vérifie en parallèle les variables d'environnement, la santé du bucket privé{" "}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">seller-contracts</code>,
                l'accès aux tables et la disponibilité de l'edge function{" "}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">generate-contract-pdf</code>.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill status={globalStatus} />
              <Button
                onClick={() => void runChecks()}
                disabled={serverLoading}
                size="sm"
                variant="outline"
              >
                {serverLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Relancer
              </Button>
            </div>
          </div>
          {serverHealth?.checkedAt && (
            <p className="text-xs text-slate-500 mt-3">
              Dernier contrôle : {new Date(serverHealth.checkedAt).toLocaleString("fr-BE")}{" "}
              {serverHealth.runtime?.region && `· région ${serverHealth.runtime.region}`}
            </p>
          )}
        </Card>

        {/* Erreurs bloquantes */}
        {blockingIssues.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>
              {blockingIssues.length} erreur{blockingIssues.length > 1 ? "s" : ""} bloquante
              {blockingIssues.length > 1 ? "s" : ""}
            </AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                {blockingIssues.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.label}</span> — {c.detail}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {serverError && !serverHealth && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>Health-check serveur indisponible</AlertTitle>
            <AlertDescription className="text-sm">
              {serverError}
              <div className="mt-2 text-xs">
                Vérifiez que vous êtes connecté en tant qu'administrateur et que la fonction{" "}
                <code>contract-pdf-healthcheck</code> est déployée.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Section serveur */}
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-600" />
              Côté serveur (edge function · service role)
            </h3>
            <span className="text-xs text-slate-500">
              {serverHealth?.checks.length ?? 0} contrôles
            </span>
          </div>
          {serverLoading && !serverHealth ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Exécution des contrôles serveur...
            </div>
          ) : serverHealth ? (
            <div>
              {serverHealth.checks.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-500">Aucun résultat.</div>
          )}
        </Card>

        {/* Section disponibilité edge */}
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <ServerCog className="w-4 h-4 text-slate-600" />
              Disponibilité edge function (preflight CORS)
            </h3>
          </div>
          {edgeAvail ? (
            <CheckRow
              check={{
                id: "edge.generate_contract_pdf",
                label: "generate-contract-pdf",
                severity: edgeAvail.ok ? "info" : "error",
                ok: edgeAvail.ok,
                detail: edgeAvail.detail,
                durationMs: edgeAvail.durationMs,
                remediation: edgeAvail.ok
                  ? undefined
                  : "Re-déployez la fonction et vérifiez les headers CORS.",
              }}
            />
          ) : (
            <div className="p-6 text-sm text-slate-500">Test en cours...</div>
          )}
        </Card>

        {/* Section client */}
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              Côté navigateur (variables Vite + bucket public)
            </h3>
            <span className="text-xs text-slate-500">
              {clientHealth?.results.length ?? 0} contrôles
            </span>
          </div>
          {clientHealth ? (
            clientHealth.results.length === 0 ? (
              <div className="p-6 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Toutes les variables Vite sont présentes et valides.
              </div>
            ) : (
              <div>
                {clientHealth.results.map((r) => (
                  <CheckRow
                    key={r.key}
                    check={{
                      id: r.key,
                      label: r.label,
                      severity: r.severity,
                      ok: r.severity === "info",
                      detail: r.detail,
                      remediation: r.remediation,
                    }}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="p-6 text-sm text-slate-500">Test en cours...</div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminContractAudit;
