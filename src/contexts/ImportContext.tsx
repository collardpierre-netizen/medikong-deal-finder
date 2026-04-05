import React, { createContext, useContext, useState, useCallback } from "react";
import { X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

export type ImportJob = {
  id: string;
  label: string; // e.g. "Catégories", "Produits", "Veille prix"
  phase: string;
  current: number;
  total: number;
  done: boolean;
  result?: {
    success: number;
    errors: string[];
  };
};

type ImportContextType = {
  jobs: ImportJob[];
  addJob: (id: string, label: string) => void;
  updateJob: (id: string, update: Partial<ImportJob>) => void;
  finishJob: (id: string, result: { success: number; errors: string[] }) => void;
  removeJob: (id: string) => void;
};

const ImportContext = createContext<ImportContextType | null>(null);

export const useImportJobs = () => {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error("useImportJobs must be inside ImportProvider");
  return ctx;
};

export const ImportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<ImportJob[]>([]);

  const addJob = useCallback((id: string, label: string) => {
    setJobs(prev => [...prev.filter(j => j.id !== id), { id, label, phase: "Démarrage…", current: 0, total: 0, done: false }]);
  }, []);

  const updateJob = useCallback((id: string, update: Partial<ImportJob>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...update } : j));
  }, []);

  const finishJob = useCallback((id: string, result: { success: number; errors: string[] }) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, done: true, result } : j));
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  return (
    <ImportContext.Provider value={{ jobs, addJob, updateJob, finishJob, removeJob }}>
      {children}
      {jobs.length > 0 && <ImportPanel jobs={jobs} removeJob={removeJob} />}
    </ImportContext.Provider>
  );
};

const ImportPanel: React.FC<{ jobs: ImportJob[]; removeJob: (id: string) => void }> = ({ jobs, removeJob }) => (
  <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-80">
    {jobs.map(job => (
      <div key={job.id} className="bg-background border rounded-xl shadow-lg p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!job.done ? (
              <Loader2 size={14} className="animate-spin text-primary" />
            ) : job.result && job.result.errors.length > 0 ? (
              <AlertTriangle size={14} className="text-orange-500" />
            ) : (
              <CheckCircle2 size={14} className="text-emerald-600" />
            )}
            <span className="text-[13px] font-semibold text-foreground">{job.label}</span>
          </div>
          {job.done && (
            <button onClick={() => removeJob(job.id)} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>

        {!job.done ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{job.phase}</span>
              {job.total > 0 && <span>{job.current}/{job.total}</span>}
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: job.total > 0 ? `${Math.min(100, (job.current / job.total) * 100)}%` : '100%' }}
              />
              {job.total === 0 && (
                <div className="h-full w-1/3 bg-primary rounded-full animate-pulse -mt-1.5" />
              )}
            </div>
          </div>
        ) : job.result && (
          <div className="space-y-1">
            <p className="text-[12px] text-emerald-600">✅ {job.result.success} traité(s)</p>
            {job.result.errors.length > 0 && (
              <div>
                <p className="text-[12px] text-destructive">⚠️ {job.result.errors.length} erreur(s)</p>
                <ul className="text-[10px] text-muted-foreground mt-0.5 max-h-16 overflow-y-auto">
                  {job.result.errors.slice(0, 5).map((err, i) => <li key={i}>• {err}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    ))}
  </div>
);
