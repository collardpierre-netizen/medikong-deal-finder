import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useImpersonation } from "@/contexts/impersonation";
import { logAdminAudit } from "@/lib/admin-audit";

/**
 * Logs every navigation in admin-shadow mode (impersonation).
 * Mounted once at the top of <App /> after the router.
 */
export default function ImpersonationPageTracker() {
  const { state, isImpersonating } = useImpersonation();
  const location = useLocation();
  const lastLogged = useRef<string>("");

  useEffect(() => {
    if (!isImpersonating || !state.session) return;
    const key = `${state.session.id}:${location.pathname}${location.search}`;
    if (lastLogged.current === key) return;
    lastLogged.current = key;
    logAdminAudit("impersonate.page_view", {
      targetId: state.session.target_user_id,
      targetType: state.session.target_type || "buyer",
      path: location.pathname + location.search,
      metadata: {
        session_id: state.session.id,
        target_email: state.session.target_email,
        target_company: state.session.target_company_name,
      },
    });
  }, [location.pathname, location.search, isImpersonating, state.session]);

  return null;
}
