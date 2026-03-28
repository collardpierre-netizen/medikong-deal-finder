import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/admin/KpiCard";
import { FileText, Clock, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ImpersonationSession, ImpersonationAction } from "@/lib/types/impersonation";

export default function AdminAuditLog() {
  const [sessions, setSessions] = useState<ImpersonationSession[]>([]);
  const [actions, setActions] = useState<Record<string, ImpersonationAction[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    const { data } = await supabase
      .from("impersonation_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);

    setSessions((data || []) as ImpersonationSession[]);
    setLoading(false);
  }

  async function toggleExpand(sessionId: string) {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);
    if (!actions[sessionId]) {
      const { data } = await supabase
        .from("impersonation_actions")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      setActions(prev => ({ ...prev, [sessionId]: (data || []) as ImpersonationAction[] }));
    }
  }

  function formatDuration(start: string, end: string | null) {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const mins = Math.floor((e - s) / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
  }

  const totalSessions = sessions.length;
  const totalActions = sessions.reduce((s, sess) => s + sess.actions_count, 0);
  const activeSessions = sessions.filter(s => !s.ended_at).length;

  const actionLabels: Record<string, string> = {
    "offer.create": "Offre créée",
    "offer.update_price": "Prix modifié",
    "offer.activate": "Offre activée",
    "offer.deactivate": "Offre désactivée",
    "offer.update_stock": "Stock modifié",
    "order.confirm": "Commande confirmée",
    "order.ship": "Commande expédiée",
    "order.cancel": "Commande annulée",
    "message.send": "Message envoyé",
    "settings.update": "Paramètre modifié",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#1D2530]">Audit Log — Impersonation</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Sessions totales" value={totalSessions} icon={<Shield size={20} className="text-red-500" />} />
        <KpiCard label="Actions tracées" value={totalActions} icon={<FileText size={20} className="text-[#1B5BDA]" />} />
        <KpiCard label="Sessions actives" value={activeSessions} icon={<Clock size={20} className="text-amber-500" />} />
      </div>

      <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[11px] font-medium text-[#8B95A5] uppercase tracking-wide">
              <th className="text-left px-4 py-3">Admin</th>
              <th className="text-left px-4 py-3">User cible</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Entreprise</th>
              <th className="text-left px-4 py-3">Début</th>
              <th className="text-left px-4 py-3">Durée</th>
              <th className="text-center px-4 py-3">Actions</th>
              <th className="text-center px-4 py-3">Détail</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[#8B95A5]">Chargement…</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[#8B95A5]">Aucune session d'impersonation</td></tr>
            ) : sessions.map(s => (
              <>
                <tr key={s.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3 text-[#616B7C]">{s.admin_email}</td>
                  <td className="px-4 py-3 text-[#616B7C]">{s.target_email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${s.target_type === "vendor" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                      {s.target_type === "vendor" ? "Vendeur" : "Acheteur"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#1D2530]">{s.target_company_name}</td>
                  <td className="px-4 py-3 text-[#616B7C]">{format(new Date(s.started_at), "dd/MM HH:mm", { locale: fr })}</td>
                  <td className="px-4 py-3 text-[#616B7C]">{formatDuration(s.started_at, s.ended_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#1D2530] font-medium text-[11px]">
                      {s.actions_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleExpand(s.id)} className="p-1 rounded hover:bg-[#F1F5F9]">
                      {expandedId === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </td>
                </tr>
                {expandedId === s.id && (
                  <tr key={`${s.id}-detail`}>
                    <td colSpan={8} className="bg-[#F8FAFC] px-6 py-4">
                      {!actions[s.id] ? (
                        <p className="text-[#8B95A5] text-sm">Chargement…</p>
                      ) : actions[s.id].length === 0 ? (
                        <p className="text-[#8B95A5] text-sm">Aucune action enregistrée</p>
                      ) : (
                        <div className="space-y-2">
                          {actions[s.id].map(a => (
                            <div key={a.id} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-[#E2E8F0]">
                              <span className="text-[11px] text-[#8B95A5] font-mono shrink-0 mt-0.5">
                                {format(new Date(a.created_at), "HH:mm:ss")}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#1D2530]">
                                  {actionLabels[a.action] || a.action}
                                </p>
                                <p className="text-[12px] text-[#8B95A5]">
                                  {a.entity_type} — {a.entity_id}
                                </p>
                                {Object.keys(a.payload).length > 0 && (
                                  <pre className="text-[11px] text-[#616B7C] mt-1 bg-[#F8FAFC] rounded p-2 overflow-x-auto">
                                    {JSON.stringify(a.payload, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
