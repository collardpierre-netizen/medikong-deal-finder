// Historique des importations de comptes acheteurs en masse (journal admin).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type Entry = { id: string; created_at: string; admin_email: string | null; metadata: any };

const n = (v: unknown) => (typeof v === "number" ? v : "—");

export default function AdminHistoriqueImports() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_audit_log")
      .select("id, created_at, admin_email, metadata")
      .eq("action", "bulk_create_buyers")
      .order("created_at", { ascending: false })
      .limit(500);
    setErr(error?.message ?? null);
    setRows((data as Entry[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historique des importations</h1>
          <p className="text-sm text-muted-foreground">Créations de comptes acheteurs en masse, de la plus récente à la plus ancienne.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5"><RefreshCw size={14} /> Actualiser</Button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? <p className="p-6 text-sm text-muted-foreground">Chargement…</p>
        : err ? <p className="p-6 text-sm text-destructive">Erreur : {err}</p>
        : rows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Aucune importation.</p>
        : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="p-3">Date</th><th className="p-3">Fichier</th><th className="p-3">Par</th>
                <th className="p-3 text-right">Créés</th><th className="p-3 text-right">Ignorés</th>
                <th className="p-3 text-right">Erreurs</th><th className="p-3 text-right">Emails envoyés</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = r.metadata ?? {};
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3">{new Date(r.created_at).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="p-3">{m.file_name || "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.admin_email || "—"}</td>
                    <td className="p-3 text-right font-medium">{n(m.created)}</td>
                    <td className="p-3 text-right">{n(m.skipped)}</td>
                    <td className="p-3 text-right">{n(m.errors)}</td>
                    <td className="p-3 text-right">{n(m.emails_sent)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-muted-foreground">« — » : information non enregistrée pour les importations faites avant l'ajout de cet historique.</p>
    </div>
  );
}
