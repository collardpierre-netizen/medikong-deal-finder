import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, RefreshCw, ShieldAlert, Zap } from "lucide-react";

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

export default function AdminFalcoStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
