import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ALLOWED_PATHS = ["/definir-mot-de-passe", "/reset-password", "/mot-de-passe-oublie", "/connexion"];

/**
 * Forces users created with a temporary password to define their own password
 * before they can browse the rest of the app.
 */
export function ForcePasswordChangeGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const mustChange = user?.user_metadata?.must_change_password === true;

  useEffect(() => {
    if (loading || !mustChange) return;
    if (ALLOWED_PATHS.some((p) => location.pathname.startsWith(p))) return;
    navigate("/definir-mot-de-passe", { replace: true });
  }, [loading, mustChange, location.pathname, navigate]);

  return null;
}
