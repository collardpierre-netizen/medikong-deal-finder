import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Play, Compass } from "lucide-react";

type Row = {
  scenario: string;
  expected: number;
  actual: number;
  ok: boolean;
  details: string | null;
};

type Result = {
  summary: { total: number; passed: number; failed: number; all_passed: boolean };
  scenarios: Row[];
  ran_at: string;
};

export default function AdminRfqRoutingTestPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const { data, error } = await supabase.rpc("rfq_routing_self_test_admin");
      if (error) throw error;
      const rows = (data || []) as Row[];
      const passed = rows.filter((r) => r.ok).length;
      setResult({
        summary: { total: rows.length, passed, failed: rows.length - passed, all_passed: passed === rows.length },
        scenarios: rows,
        ran_at: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Helmet><title>Tests routage RFQ · Admin · MediKong</title></Helmet>
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-2">
          <Compass className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Tests de routage RFQ</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Valide automatiquement que <code>rfq_resolve_target_vendors</code> sélectionne les bons vendeurs
          en fonction du produit, de la marque, de la catégorie et du pays acheteur (+ pays limitrophes).
          Crée un jeu de données de test isolé puis le supprime.
        </p>

        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Self-test du moteur de routage</span>
              <Button onClick={runTest} disabled={running} size="sm">
                {running ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Play className="h-3 w-3 mr-2" />}
                {running ? "Exécution…" : "Lancer les tests"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Couvre : pays acheteur + limitrophes, exclusion des pays non adjacents, exclusion des vendeurs inactifs,
            priorité <code>product_offer</code> sur intérêt catalogue, intérêts marque/fabricant/catégorie,
            vendeurs sans pays toujours éligibles.
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-4 border-rose-300 bg-rose-50/50">
            <CardContent className="py-3 text-sm text-rose-700">
              <strong>Erreur :</strong> {error}
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-3">
                {result.summary.all_passed ? (
                  <Badge className="bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Tous les tests réussis
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" /> {result.summary.failed} échec(s)
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground font-normal">
                  {result.summary.passed} / {result.summary.total} scénarios
                  · exécuté à {new Date(result.ran_at).toLocaleTimeString("fr-BE")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-center w-10"></th>
                      <th className="px-3 py-2 text-left">Scénario</th>
                      <th className="px-3 py-2 text-right">Attendu</th>
                      <th className="px-3 py-2 text-right">Obtenu</th>
                      <th className="px-3 py-2 text-left">Détails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.scenarios.map((s, i) => (
                      <tr key={i} className={`border-t ${!s.ok ? "bg-rose-50/40" : ""}`}>
                        <td className="px-3 py-2 text-center">
                          {s.ok ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 inline" />
                          ) : (
                            <XCircle className="h-4 w-4 text-rose-600 inline" />
                          )}
                        </td>
                        <td className="px-3 py-2">{s.scenario}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.expected}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${!s.ok ? "font-bold text-rose-700" : ""}`}>
                          {s.actual}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{s.details || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
