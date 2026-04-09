import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { useImpersonation } from "@/contexts/impersonation";

function formatDuration(startedAt: string) {
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (diff < 1) return "< 1 min";
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)}h${String(diff % 60).padStart(2, "0")}`;
}

export default function ImpersonationBanner() {
  const { state, stopImpersonation, isImpersonating } = useImpersonation();
  const navigate = useNavigate();
  const [elapsed, setElapsed] = useState("");
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    if (!state.session) return;
    const update = () => setElapsed(formatDuration(state.session!.started_at));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [state.session]);

  if (!isImpersonating || !state.session) return null;

  const handleStop = async () => {
    await stopImpersonation();
    navigate("/admin");
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 h-11 flex items-center px-4 gap-3 text-white text-[13px] font-semibold"
      style={{ zIndex: 9999, background: "linear-gradient(90deg, #DC2626, #B91C1C)" }}
    >
      <Shield size={16} />
      <span className="uppercase tracking-wider text-[11px]">Mode Admin</span>
      <span className="text-white/40">|</span>
      <span>
        Connecté en tant que <strong>{state.session.target_company_name}</strong>{" "}
        ({state.session.target_type === "vendor" ? "vendeur" : "acheteur"})
      </span>
      <span className="text-white/40">|</span>
      <span className="text-white/70">Session active depuis {elapsed}</span>
      <span
        className="ml-1 px-2 py-0.5 rounded text-[11px] font-bold"
        style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
      >
        {state.session.actions_count} action{state.session.actions_count !== 1 ? "s" : ""}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => navigate("/admin/audit-log")}
          className="px-3 py-1 rounded border border-white/40 text-[12px] hover:bg-white/10 transition-colors"
        >
          Audit log
        </button>
        <button
          onClick={handleStop}
          className="px-3 py-1 rounded bg-white text-red-600 font-bold text-[12px] hover:bg-red-50 transition-colors"
        >
          Quitter
        </button>
      </div>
    </div>
  );
}
