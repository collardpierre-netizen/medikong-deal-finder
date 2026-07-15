import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, RefreshCw, ShieldAlert, Zap, PlugZap, KeyRound } from "lucide-react";

type Status = {
  active: boolean;
  api_key_configured: boolean;
  app_secret_configured: boolean;
  base_url_overridden: boolean;
  base_url: string;
  environment: "sandbox" | "production";
  missing_secrets: string[];
  checked_at: string;
};

type TestResult = {
  ok: boolean;
  http_status?: number;
  network_error?: string | null;
  latency_ms?: number;
  environment?: string;
  base_url?: string;
  endpoint?: string;
  organization?: {
    name?: string | null;
    vat_number?: string | null;
    peppol_identifier?: string | null;
    country?: string | null;
  } | null;
  message: string;
  missing_secrets?: string[];
  reason?: string;
  checked_at?: string;
};

export default function AdminFalcoStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("falco-status");
      if (error) throw error;
      setStatus(data as Status);
    } catch (e: any) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("falco-test-connection", { body: {} });
      if (error) throw error;
      setTestResult(data as TestResult);
    } catch (e: any) {
      setTestError(e?.message || "Erreur inconnue");
    } finally {
      setTesting(false);
    }
  };

  const seedCronSecret = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("seed-cron-secret-vault", { body: {} });
      if (error) throw error;
      const d = data as { ok?: boolean; vault_secret_name?: string; vault_secret_id?: string; error?: string; details?: string };
      if (d?.ok) {
        setSeedResult({ ok: true, message: `Secret « ${d.vault_secret_name} » écrit dans le coffre-fort (id ${d.vault_secret_id?.slice(0, 8)}…). Le cron pg_cron y lira désormais le Bearer.` });
      } else {
        setSeedResult({ ok: false, message: d?.details || d?.error || "Échec inconnu" });
      }
    } catch (e: any) {
      setSeedResult({ ok: false, message: e?.message || "Erreur inconnue" });
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => { load(); }, []);



  const Row = ({ label, ok }: { label: string; ok: boolean }) => (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm font-medium">{label}</span>
      {ok ? (
        <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> Configuré
        </Badge>
      ) : (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3.5 w-3.5" /> Manquant
        </Badge>
      )}
    </div>
  );

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intégration Falco / Peppol</h1>
          <p className="text-sm text-muted-foreground">
            Vérifie que les secrets nécessaires à l'envoi UBL sur le réseau Peppol sont en place.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Impossible de vérifier</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {status && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                État de l'intégration
                {status.active ? (
                  <Badge className="ml-auto bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                ) : (
                  <Badge variant="destructive" className="ml-auto">Inactive</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Environnement Falco :{" "}
                <span className="font-mono font-medium">{status.environment}</span>
                {status.base_url_overridden ? " (URL personnalisée)" : " (défaut)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Row label="FALCO_API_KEY" ok={status.api_key_configured} />
              <Row label="FALCO_APP_SECRET" ok={status.app_secret_configured} />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">Base URL</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">{status.base_url}</code>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Les valeurs des secrets ne sont jamais transmises au front — seul leur état de configuration est exposé.
                Dernière vérification : {new Date(status.checked_at).toLocaleString("fr-BE")}.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Format attendu des secrets Falco
              </CardTitle>
              <CardDescription>
                Vérifiez le format avant de coller la valeur dans « Secrets ». Un mauvais format entraîne un <code className="text-xs">401 Unauthorized</code> côté Falco.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1">
                <div className="font-medium font-mono">FALCO_API_KEY</div>
                <div className="text-muted-foreground">
                  Format : <code className="text-xs bg-muted px-1.5 py-0.5 rounded">sk_&lt;env&gt;_&lt;id&gt;_&lt;secret&gt;</code>
                  {" "}où <code className="text-xs">&lt;env&gt;</code> vaut <code className="text-xs">live</code> ou <code className="text-xs">test</code>.
                </div>
                <div className="text-xs">
                  Exemple générique :{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded">sk_live_abc123_XXXXXXXXXXXXXXXX</code>
                </div>
                <div className="text-xs text-muted-foreground">
                  À copier depuis le dashboard Falco (Settings → API keys). Ne collez ni un libellé d'UI, ni un jeton d'un autre service.
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-medium font-mono">FALCO_APP_SECRET</div>
                <div className="text-muted-foreground">
                  Format : commence par <code className="text-xs bg-muted px-1.5 py-0.5 rounded">app_</code> suivi de caractères alphanumériques.
                </div>
                <div className="text-xs">
                  Exemple générique : <code className="bg-muted px-1.5 py-0.5 rounded">app_XXXXXXXXXXXX</code>
                </div>
              </div>

              <div className="space-y-1">
                <div className="font-medium font-mono">FALCO_BASE_URL <span className="text-xs font-normal text-muted-foreground">(optionnel)</span></div>
                <div className="text-xs text-muted-foreground">
                  Production : <code className="bg-muted px-1.5 py-0.5 rounded">https://api.falco-app.be/v1</code> ·
                  Sandbox : <code className="bg-muted px-1.5 py-0.5 rounded">https://api.sandbox.falco-app.be/v1</code>
                </div>
              </div>

              <div className="pt-2 border-t">
                <Button onClick={runTest} disabled={testing} size="sm" className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${testing ? "animate-spin" : ""}`} />
                  {testing ? "Test en cours…" : "Relancer le test de connexion"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Le résultat s'affiche dans la carte « Test de connexion Falco » ci-dessous.
                </p>
              </div>
            </CardContent>
          </Card>



          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlugZap className="h-5 w-5" />
                Test de connexion Falco
              </CardTitle>
              <CardDescription>
                Lance un appel <code className="text-xs">GET /organization/whoami</code> avec les secrets configurés.
                Aucun document n'est envoyé sur Peppol.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={runTest} disabled={testing} className="gap-2">
                <PlugZap className={`h-4 w-4 ${testing ? "animate-pulse" : ""}`} />
                {testing ? "Test en cours…" : "Lancer le test"}
              </Button>

              {testError && (
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Impossible d'exécuter le test</AlertTitle>
                  <AlertDescription>{testError}</AlertDescription>
                </Alert>
              )}

              {testResult && (
                <Alert variant={testResult.ok ? "default" : "destructive"}>
                  {testResult.ok ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {testResult.ok ? "Succès" : "Échec"}
                    {typeof testResult.http_status === "number" && testResult.http_status > 0
                      ? ` — HTTP ${testResult.http_status}`
                      : ""}
                    {typeof testResult.latency_ms === "number" ? ` (${testResult.latency_ms} ms)` : ""}
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <div>{testResult.message}</div>
                    {testResult.organization && (
                      <div className="text-xs bg-muted/50 rounded p-2 space-y-0.5">
                        <div><span className="font-medium">Organisation :</span> {testResult.organization.name || "—"}</div>
                        <div><span className="font-medium">TVA :</span> {testResult.organization.vat_number || "—"}</div>
                        <div><span className="font-medium">Peppol ID :</span> {testResult.organization.peppol_identifier || "—"}</div>
                        <div><span className="font-medium">Pays :</span> {testResult.organization.country || "—"}</div>
                      </div>
                    )}
                    {testResult.missing_secrets && testResult.missing_secrets.length > 0 && (
                      <div className="text-xs">
                        Secrets manquants : <span className="font-mono">{testResult.missing_secrets.join(", ")}</span>
                      </div>
                    )}
                    {testResult.base_url && (
                      <div className="text-xs text-muted-foreground">
                        Endpoint : <code>{testResult.base_url}{testResult.endpoint}</code>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Secret partagé pg_cron ↔ edge functions
              </CardTitle>
              <CardDescription>
                Copie <code className="text-xs">CRON_SHARED_SECRET</code> depuis les secrets Lovable
                vers le coffre-fort Supabase (nom : <code className="text-xs">cron_shared_secret</code>).
                Le cron horaire <code className="text-xs">retry-peppol-failed-hourly</code> lit ce coffre-fort
                à l'exécution : aucun secret n'est stocké en clair dans le SQL.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={seedCronSecret} disabled={seeding} variant="outline" className="gap-2">
                <KeyRound className={`h-4 w-4 ${seeding ? "animate-pulse" : ""}`} />
                {seeding ? "Écriture…" : "Synchroniser vers le coffre-fort"}
              </Button>
              {seedResult && (
                <Alert variant={seedResult.ok ? "default" : "destructive"}>
                  {seedResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <AlertTitle>{seedResult.ok ? "Coffre-fort à jour" : "Échec"}</AlertTitle>
                  <AlertDescription>{seedResult.message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>



          {!status.active && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Secrets manquants</AlertTitle>
              <AlertDescription>
                Peppol est désactivé tant que ces secrets ne sont pas définis :{" "}
                <span className="font-mono">{status.missing_secrets.join(", ")}</span>.
                Ajoutez-les via <span className="font-medium">More → Cloud → Secrets</span> (ou <kbd>Cmd/Ctrl+K</kbd> → « Secrets »).
              </AlertDescription>
            </Alert>
          )}

          {status.active && status.environment === "sandbox" && (
            <Alert>
              <AlertTitle>Mode sandbox</AlertTitle>
              <AlertDescription>
                Les envois passent par <code className="font-mono text-xs">api.sandbox.falco-app.be</code>.
                Pour la production, ajoutez le secret{" "}
                <span className="font-mono">FALCO_BASE_URL</span> avec{" "}
                <code className="text-xs">https://api.falco-app.be/v1</code>.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
