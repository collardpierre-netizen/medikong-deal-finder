import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";

/**
 * If the current user is a member of more than one account and none is active,
 * redirect to /select-account — but only from account-bound areas
 * (buyer /mon-compte, /vendor/*, /admin/*). Public pages are unaffected.
 */
const GATED_PREFIXES = ["/mon-compte", "/vendor", "/admin"];
const EXCLUDED = ["/select-account", "/vendor/login", "/admin/login", "/connexion"];

export function AccountSelectionGuard() {
  const { needsSelection } = useActiveAccount();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!needsSelection) return;
    if (EXCLUDED.some((p) => pathname === p || pathname.startsWith(p + "/"))) return;
    if (!GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return;
    navigate("/select-account", { replace: true, state: { from: pathname } });
  }, [needsSelection, pathname, navigate]);

  return null;
}
