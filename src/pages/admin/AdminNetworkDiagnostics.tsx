import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, RefreshCw, Trash2, Wifi } from "lucide-react";
import {
  clearNetworkEvents,
  getBackendOrigin,
  getNetworkEvents,
  probeEndpoint,
  subscribeNetworkEvents,
  type NetworkEvent,
  type ProbeResult,
} from "@/lib/network-diagnostics";

const kindLabel: Record<NetworkEvent["kind"], string> = {
  ok: "OK",
  http_error: "Erreur HTTP",
  network: "Réseau / DNS",
  cors: "CORS",
  aborted: "Interrompu",
};

function kindVariant(kind: NetworkEvent["kind"]) {
  if (kind === "ok") return "secondary" as const;
  if (kind === "http_error") return "outline" as const;
  return "destructive" as const;
}

function outcomeVariant(outcome: ProbeResult["outcome"]) {
  if (outcome === "ok") return "secondary" as const;
  if (outcome === "http_error") return "outline" as const;
  return "destructive" as const;
}

const AdminNetworkDiagnostics = () => {
  const [events, setEvents] = useState<NetworkEvent[]>(() => [
    ...getNetworkEvents(),
  ]);
  const [live, setLive] = useState(true);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [probes, setProbes] = useState<ProbeResult[]>([]);
  const [probing, setProbing] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    if (!live) return;
    const unsubscribe = subscribeNetworkEvents((next) => setEvents(next));
    setEvents([...getNetworkEvents()]);
    return unsubscribe;
  }, [live]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const backend = getBackendOrigin();

  const runProbes = useCallback(async () => {
    setProbing(true);
    const targets: { label: string; url: string; init?: RequestInit }[] = [];
    if (backend) {
      targets.push(
        { label: "Auth (health)", url: `${backend}/auth/v1/health` },
        {
          label: "API données (REST)",
          url: `${backend}/rest/v1/?apikey=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ""}`,
        },
        {
          label: "Edge functions (CORS preflight)",
          url: `${backend}/functions/v1/image-proxy`,
          init: { method: "OPTIONS" },
        },
      );
    }
    targets.push(
      { label: "Application (même origine)", url `${window.location.origin}/favicon.ico`.length ? `${window.location.origin}/favicon.ico` : "" } as never,
    );
    const results: ProbeResult[] = [];
    for (const t of targets) {
      results.push(await probeEndpoint(t.label, t.url, t.init));
    }
    setProbes(results);
    setProbing(false);
  }, [backend]);

  useEffect(() => {
    void runProbes();
  }, [runProbes]);

  const filtered = useMemo(
    () => (onlyErrors ? events.filter((e) => e.kind !== "ok") : events),
    [events, onlyErrors],
  );

  const stats = useMemo(() => {
    const total = events.length;
    const errors = events.filter((e) => e.kind !== "ok").length;
    const network = events.filter((e) => e.kind === "network").length;
    const cors = events.filter((e) => e.kind === "cors").length;
    return { total, errors, network, cors };
  }, [events]);

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Diagnostic réseau | Admin MediKong</title>
        <meta
          name="description"
          content="Suivi temps réel des endpoints appelés, codes d'erreur HTTP et état CORS/DNS du backend MediKong."
        />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Diagnostic réseau
          </h1>
          <p className="text-sm text-muted-foreground">
            Endpoints appelés, codes d'erreur et état CORS/DNS en temps réel.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={online ? "secondary" : "destructive"}>
            <Wifi className="mr-1 h-3 w-3" />
            {online ? "Navigateur en ligne" : "Hors ligne"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void runProbes()}
            disabled={probing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${probing ? "animate-spin" : ""}`}
            />
            Retester
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Requêtes observées", value: stats.total },
          { label: "En erreur", value: stats.errors },
          { label: "Échecs réseau / DNS", value: stats.network },
          { label: "Blocages CORS", value: stats.cors },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-6">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {k.label}
              </div>
              <div className="mt-1 text-2xl font-semibold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            État CORS / DNS des endpoints backend
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!backend && (
            <p className="text-sm text-destructive">
              URL backend introuvable dans la configuration du client.
            </p>
          )}
          <div className="space-y-2">
            {probes.map((p) => (
              <div
                key={p.label}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium">{p.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.url}
                  </div>
                  <div className="mt-1 text-xs">{p.detail}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {p.durationMs} ms
                  </span>
                  <Badge variant={outcomeVariant(p.outcome)}>
                    {p.status ? `HTTP ${p.status}` : kindLabel[p.outcome]}
                  </Badge>
                </div>
              </div>
            ))}
            {probing && probes.length === 0 && (
              <p className="text-sm text-muted-foreground">Test en cours…</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">
            Journal des appels ({filtered.length})
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="net-live" checked={live} onCheckedChange={setLive} />
              <Label htmlFor="net-live" className="text-sm">
                Temps réel
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="net-errors"
                checked={onlyErrors}
                onCheckedChange={setOnlyErrors}
              />
              <Label htmlFor="net-errors" className="text-sm">
                Erreurs seules
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearNetworkEvents();
                setEvents([]);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Vider
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[520px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Heure</TableHead>
                  <TableHead className="w-[70px]">Méthode</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="w-[110px]">Cible</TableHead>
                  <TableHead className="w-[80px]">Durée</TableHead>
                  <TableHead className="w-[140px]">Résultat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Aucun appel enregistré pour le moment. Naviguez dans
                      l'application, les appels apparaissent ici en direct.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs tabular-nums">
                      {new Date(e.startedAt).toLocaleTimeString("fr-BE")}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {e.method}
                    </TableCell>
                    <TableCell className="max-w-[420px]">
                      <div className="truncate text-xs" title={e.url}>
                        {e.path}
                      </div>
                      {e.errorMessage && (
                        <div className="truncate text-xs text-destructive">
                          {e.errorMessage}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.scope}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {e.durationMs} ms
                    </TableCell>
                    <TableCell>
                      <Badge variant={kindVariant(e.kind)}>
                        {e.status ? `HTTP ${e.status}` : kindLabel[e.kind]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNetworkDiagnostics;
