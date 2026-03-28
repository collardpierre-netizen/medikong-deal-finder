import { useState } from "react";
import KpiCard from "@/components/admin/KpiCard";
import { FileText, Clock, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminAuditLog() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Total actions" value={logs.length} icon={FileText} />
        <KpiCard title="Modules" value={[...new Set(logs.map(l => l.module).filter(Boolean))].length} icon={Shield} />
        <KpiCard title="Dernière action" value={logs[0] ? format(new Date(logs[0].created_at), "dd/MM HH:mm", { locale: fr }) : "–"} icon={Clock} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-accent">
              <tr>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Utilisateur</th>
                <th className="text-left p-3 font-medium">Action</th>
                <th className="text-left p-3 font-medium">Module</th>
                <th className="text-left p-3 font-medium">Détail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-t border-border">
                  <td className="p-3 text-muted-foreground">{format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: fr })}</td>
                  <td className="p-3">{log.user_name || "Système"}</td>
                  <td className="p-3 font-medium">{log.action}</td>
                  <td className="p-3">{log.module || "–"}</td>
                  <td className="p-3 text-muted-foreground truncate max-w-[200px]">{log.detail || "–"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Aucune action enregistrée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
