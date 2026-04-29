import { useImportJob, STATUS_LABEL, STATUS_COLOR, type ImportJobStatus } from "@/hooks/useImportJob";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Ban, Clock } from "lucide-react";
import { useMemo } from "react";

const STATUS_ICON: Record<ImportJobStatus, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  processing: <Loader2 className="h-4 w-4 animate-spin" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
  cancelled: <Ban className="h-4 w-4" />,
};

type Props = {
  jobId: string;
  onCompleted?: () => void;
  onCancelled?: () => void;
  showCancel?: boolean;
  compact?: boolean;
};

export function ImportJobProgress({ jobId, onCompleted, onCancelled, showCancel = true, compact = false }: Props) {
  const { job, cancel } = useImportJob(jobId);

  const pct = useMemo(() => {
    if (!job || job.total_rows === 0) return 0;
    return Math.min(100, Math.round((job.processed_rows / job.total_rows) * 100));
  }, [job]);

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Initialisation du job…
      </div>
    );
  }

  // Auto-callbacks (one-shot via key: caller's responsibility)
  if (job.status === "completed" && onCompleted) queueMicrotask(onCompleted);
  if (job.status === "cancelled" && onCancelled) queueMicrotask(onCancelled);

  const isActive = job.status === "pending" || job.status === "processing";

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[job.status]}`}
        >
          {STATUS_ICON[job.status]}
          {STATUS_LABEL[job.status]}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {job.processed_rows.toLocaleString("fr-FR")} / {job.total_rows.toLocaleString("fr-FR")} lignes · {pct}%
        </span>
      </div>

      <Progress value={pct} className="h-2" />

      {!compact && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {job.job_type === "buyer_comparator" && (
            <>
              <span>✓ Trouvés : <strong className="text-emerald-700">{job.found_count}</strong></span>
              <span>✗ Indispo : <strong className="text-orange-700">{job.unavailable_count}</strong></span>
            </>
          )}
          {job.job_type === "product_submission" && (
            <>
              <span>✓ Soumis : <strong className="text-emerald-700">{job.created_count}</strong></span>
              <span>✗ Rejetés : <strong className="text-red-700">{job.rejected_count}</strong></span>
            </>
          )}
          {job.file_name && <span className="truncate max-w-[240px]">📄 {job.file_name}</span>}
        </div>
      )}

      {job.status === "failed" && job.error_message && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          <strong>Erreur :</strong> {job.error_message}
        </div>
      )}

      {showCancel && isActive && (
        <Button size="sm" variant="outline" onClick={cancel}>
          <Ban className="mr-1 h-3 w-3" /> Annuler
        </Button>
      )}
    </div>
  );
}
