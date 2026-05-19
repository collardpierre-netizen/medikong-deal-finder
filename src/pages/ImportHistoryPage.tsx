import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Loader2, RefreshCw, AlertCircle, Eye, RotateCw } from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";
import { toast } from "@/hooks/use-toast";
import { replayImportJob } from "@/hooks/useImportJob";

type ImportJob = {
  id: string;
  job_type: "buyer_comparator" | "product_submission";
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  file_name: string | null;
  total_rows: number;
  processed_rows: number;
  found_count: number;
  unavailable_count: number;
  created_count: number;
  rejected_count: number;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
};

const statusLabel: Record<ImportJob["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  processing: { label: "En cours", variant: "secondary" },
  completed: { label: "Terminé", variant: "default" },
  failed: { label: "Échoué", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "outline" },
};

const typeLabel: Record<ImportJob["job_type"], string> = {
  buyer_comparator: "Comparateur acheteur",
  product_submission: "Soumission produits",
};

export default function ImportHistoryPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      navigate("/connexion?redirect=/compte/imports");
      return;
    }
    const { data, error } = await supabase
      .from("import_jobs")
      .select("id, job_type, status, file_name, total_rows, processed_rows, found_count, unavailable_count, created_count, rejected_count, error_message, created_at, finished_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast({ title: "Erreur de chargement", description: error.message, variant: "destructive" });
    } else {
      setJobs((data ?? []) as ImportJob[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("import_jobs_history")
      .on("postgres_changes", { event: "*", schema: "public", table: "import_jobs" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadErrors = async (job: ImportJob) => {
    setDownloadingId(job.id);
    try {
      const { data, error } = await supabase
        .from("import_job_payload")
        .select("errors, results, rows")
        .eq("job_id", job.id)
        .maybeSingle();
      if (error) throw error;

      const explicitErrors = Array.isArray(data?.errors) ? (data!.errors as any[]) : [];
      const results = Array.isArray(data?.results) ? (data!.results as any[]) : [];
      const rows = Array.isArray(data?.rows) ? (data!.rows as any[]) : [];

      // Inférer les lignes en erreur depuis results si errors vide
      const inferred = results
        .map((r: any, idx: number) => {
          const status = r?.status ?? r?.state;
          if (status && status !== "found" && status !== "ok" && status !== "created" && status !== "matched") {
            return {
              row: r?.line_index ?? r?.row ?? idx + 1,
              ean: r?.ean ?? r?.gtin ?? rows[idx]?.ean ?? "",
              cnk: r?.cnk ?? rows[idx]?.cnk ?? "",
              reason: r?.reason ?? r?.error ?? status,
            };
          }
          return null;
        })
        .filter(Boolean) as any[];

      const all = [...explicitErrors, ...inferred];

      if (all.length === 0) {
        toast({ title: "Aucune ligne en erreur", description: "Cet import ne contient pas de ligne rejetée." });
        return;
      }

      const headers = ["row", "ean", "cnk", "reason"];
      const escape = (v: any) => {
        const s = v == null ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const csv = [
        headers.join(","),
        ...all.map((e) => headers.map((h) => escape(e[h] ?? "")).join(",")),
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `import-${job.id.slice(0, 8)}-erreurs.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Téléchargement impossible", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Historique des imports</h1>
          <p className="text-muted-foreground mt-1">
            Liste de vos soumissions CSV avec leur statut et le détail des lignes rejetées.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {jobs.length} import{jobs.length > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Chargement…
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Aucun import pour l'instant.</p>
              <Button asChild variant="link" className="mt-2">
                <Link to="/compte">Lancer un import depuis mon compte</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Fichier</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Lignes</TableHead>
                    <TableHead className="text-right">Erreurs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const errorCount =
                      (job.unavailable_count ?? 0) + (job.rejected_count ?? 0);
                    const st = statusLabel[job.status];
                    return (
                      <TableRow key={job.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatUpdatedAt(job.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">{typeLabel[job.job_type]}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-sm" title={job.file_name ?? ""}>
                          {job.file_name ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>
                            {job.status === "processing" && (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            )}
                            {st.label}
                          </Badge>
                          {job.error_message && (
                            <div className="text-xs text-destructive mt-1 flex items-center gap-1 max-w-[220px] truncate" title={job.error_message}>
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              {job.error_message}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {job.processed_rows}/{job.total_rows}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {errorCount > 0 ? (
                            <span className="text-destructive font-medium">{errorCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              downloadingId === job.id ||
                              !["completed", "failed"].includes(job.status)
                            }
                            onClick={() => downloadErrors(job)}
                          >
                            {downloadingId === job.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-1" />
                                Erreurs CSV
                              </>
                            )}
                          </Button>
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
    </div>
  );
}
