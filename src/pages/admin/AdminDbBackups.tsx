import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Database, AlertCircle } from "lucide-react";
import { formatUpdatedAtFull } from "@/lib/format-date";

interface BackupLog {
  id: string;
  storage_path: string;
  tables_included: string[];
  total_rows: number;
  size_bytes: number;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export default function AdminDbBackups() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function loadLogs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("db_backup_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setLogs((data as any) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadLogs();
  }, []);

  async function runBackup() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "db-backup-export",
        { body: {} },
      );
      if (error) throw error;
      toast({
        title: "Export réussi",
        description: `${data?.total_rows ?? 0} lignes — ${formatBytes(
          data?.size_bytes ?? 0,
        )}`,
      });
      if (data?.signed_url) {
        window.open(data.signed_url, "_blank");
      }
      await loadLogs();
    } catch (e: any) {
      toast({
        title: "Échec de l'export",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  }

  async function downloadDump(path: string) {
    const { data, error } = await supabase.storage
      .from("db-backups")
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast({
        title: "Lien indisponible",
        description: error?.message ?? "URL signée non générée",
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-6 p-6">
      <Helmet>
        <title>Sauvegardes base — Admin MediKong</title>
      </Helmet>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-mk-blue" /> Sauvegardes base de
            données
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Export manuel des tables critiques. Les fichiers sont stockés dans
            un bucket privé et accessibles via URL signée (1h).
          </p>
        </div>
        <Button onClick={runBackup} disabled={running} size="lg">
          {running ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {running ? "Export en cours…" : "Lancer un export maintenant"}
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <strong>Recommandé avant toute migration risquée.</strong> Le dump
            contient uniquement les <em>données</em> (INSERTs) des tables
            critiques. Le schéma doit déjà exister pour restaurer. Les fichiers
            ne sont jamais publics.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des exports</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucun export pour le moment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Statut</th>
                    <th className="py-2 pr-4">Tables</th>
                    <th className="py-2 pr-4">Lignes</th>
                    <th className="py-2 pr-4">Taille</th>
                    <th className="py-2 pr-4">Durée</th>
                    <th className="py-2 pr-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {formatUpdatedAtFull(l.created_at)}
                      </td>
                      <td className="py-2 pr-4">
                        {l.status === "success" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Succès
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Échec</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground max-w-xs truncate">
                        {l.tables_included?.join(", ")}
                      </td>
                      <td className="py-2 pr-4">
                        {l.total_rows.toLocaleString("fr-FR")}
                      </td>
                      <td className="py-2 pr-4">
                        {formatBytes(l.size_bytes)}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {l.duration_ms
                          ? `${(l.duration_ms / 1000).toFixed(1)}s`
                          : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {l.status === "success" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadDump(l.storage_path)}
                          >
                            <Download className="h-3 w-3 mr-1" /> Télécharger
                          </Button>
                        ) : (
                          <span className="text-xs text-destructive">
                            {l.error_message}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
