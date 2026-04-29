import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ImportJobType = "buyer_comparator" | "product_submission";
export type ImportJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type ImportJob = {
  id: string;
  user_id: string;
  job_type: ImportJobType;
  status: ImportJobStatus;
  file_name: string | null;
  file_size_bytes: number | null;
  total_rows: number;
  processed_rows: number;
  found_count: number;
  unavailable_count: number;
  created_count: number;
  rejected_count: number;
  metadata: Record<string, any>;
  result_summary: Record<string, any>;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

type CreateJobInput = {
  jobType: ImportJobType;
  fileName?: string;
  fileSizeBytes?: number;
  rows: any[];
  metadata?: Record<string, any>;
};

/**
 * Crée un job d'import asynchrone, persiste le payload, déclenche le worker serveur.
 * Retourne l'id du job — la progression doit être suivie via useImportJob(jobId).
 */
export async function startImportJob(input: CreateJobInput): Promise<string> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw new Error("Vous devez être connecté.");

  const { data: job, error: jobErr } = await supabase
    .from("import_jobs")
    .insert({
      user_id: userData.user.id,
      job_type: input.jobType,
      file_name: input.fileName ?? null,
      file_size_bytes: input.fileSizeBytes ?? null,
      total_rows: input.rows.length,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (jobErr || !job) throw new Error(jobErr?.message ?? "Création du job impossible");

  const { error: payErr } = await supabase
    .from("import_job_payload")
    .insert({ job_id: job.id, rows: input.rows as any });
  if (payErr) {
    await supabase.from("import_jobs").delete().eq("id", job.id);
    throw new Error(payErr.message);
  }

  const { error: invokeErr } = await supabase.functions.invoke(
    "process-import-job",
    { body: { jobId: job.id } },
  );
  if (invokeErr) {
    // Ne supprime pas : le job reste en pending et peut être relancé
    console.error("[startImportJob] invoke failed", invokeErr);
    throw new Error(invokeErr.message ?? "Démarrage du worker impossible");
  }

  return job.id;
}

export function useImportJob(jobId: string | null) {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!jobId) return;
    const { data } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (data) setJob(data as any);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    setLoading(true);
    refetch().finally(() => setLoading(false));

    const channel = supabase
      .channel(`import-job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "import_jobs", filter: `id=eq.${jobId}` },
        (payload) => setJob(payload.new as any),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, refetch]);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    await supabase.from("import_jobs")
      .update({ status: "cancelled" })
      .eq("id", jobId)
      .in("status", ["pending", "processing"]);
    await refetch();
  }, [jobId, refetch]);

  return { job, loading, refetch, cancel };
}

export async function fetchJobResults(jobId: string) {
  const { data, error } = await supabase
    .from("import_job_payload")
    .select("results, errors")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw error;
  return data as { results: any[]; errors: any[] } | null;
}

export async function listMyImportJobs(jobType?: ImportJobType, limit = 20) {
  let q = supabase.from("import_jobs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (jobType) q = q.eq("job_type", jobType);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ImportJob[];
}

export const STATUS_LABEL: Record<ImportJobStatus, string> = {
  pending: "En attente",
  processing: "En cours",
  completed: "Terminé",
  failed: "Échoué",
  cancelled: "Annulé",
};

export const STATUS_COLOR: Record<ImportJobStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  processing: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-amber-100 text-amber-700 border-amber-200",
};
