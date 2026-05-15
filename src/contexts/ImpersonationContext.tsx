import { useState, useCallback, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ImpersonationContext,
  type ImpersonationSession,
  type ImpersonationState,
} from "./impersonation";
import { enterBuyerSession, exitBuyerSession } from "@/lib/buyer-impersonation";

const defaultState: ImpersonationState = {
  isImpersonating: false,
  session: null,
  originalAdmin: null,
};

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImpersonationState>(() => {
    try {
      const saved = localStorage.getItem("mk_impersonation");
      return saved ? JSON.parse(saved) : defaultState;
    } catch {
      return defaultState;
    }
  });

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "mk_impersonation") return;
      if (!event.newValue) {
        setState(defaultState);
        return;
      }
      try {
        setState(JSON.parse(event.newValue));
      } catch {
        setState(defaultState);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (state.isImpersonating) {
      localStorage.setItem("mk_impersonation", JSON.stringify(state));
      return;
    }

    localStorage.removeItem("mk_impersonation");
  }, [state]);

  const startImpersonation = useCallback(async (
    targetUserId: string,
    targetEmail: string,
    targetType: string,
    targetCompany: string,
    targetVendorId?: string,
  ) => {
    let authSwapSessionId: string | null = null;

    // For buyers we perform a REAL auth-session swap so that all writes
    // (cart, alerts, watch list, RFQ, preferences…) carry the buyer's auth.uid().
    if (targetType === "buyer") {
      try {
        const res = await enterBuyerSession({ targetUserId });
        authSwapSessionId = res.sessionId;
      } catch (e) {
        toast.error(`Connexion impossible : ${(e as Error).message}`);
        return;
      }
    }

    const session: ImpersonationSession = {
      id: crypto.randomUUID(),
      admin_user_id: "admin",
      admin_email: "admin",
      target_user_id: targetUserId,
      target_email: targetEmail,
      target_type: targetType,
      target_company_name: targetCompany,
      target_vendor_id: targetVendorId,
      auth_swap_session_id: authSwapSessionId,
      actions_count: 0,
      started_at: new Date().toISOString(),
    };

    const newState: ImpersonationState = {
      isImpersonating: true,
      session,
      originalAdmin: { userId: "admin", email: "admin", name: "Admin" },
    };

    localStorage.setItem("mk_impersonation", JSON.stringify(newState));
    setState(newState);
    toast.success(
      targetType === "buyer"
        ? `Connecté en tant que ${targetCompany}`
        : `Mode shadow activé pour ${targetCompany}`,
    );
  }, []);

  const stopImpersonation = useCallback(async () => {
    const sess = state.session;
    if (sess?.target_type === "buyer") {
      try {
        await exitBuyerSession(sess.auth_swap_session_id ?? null);
      } catch (e) {
        toast.error(`Erreur fin de session : ${(e as Error).message}`);
      }
    }
    setState(defaultState);
    toast.info("Session d'impersonation terminée");
  }, [state.session]);

  const logAction = useCallback(async () => {}, []);

  return (
    <ImpersonationContext.Provider
      value={{
        state,
        startImpersonation,
        stopImpersonation,
        logAction,
        isImpersonating: state.isImpersonating,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

