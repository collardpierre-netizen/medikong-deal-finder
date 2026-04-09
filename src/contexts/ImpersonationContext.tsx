import { useState, useCallback, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ImpersonationContext,
  type ImpersonationSession,
  type ImpersonationState,
} from "./impersonation";

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
    const session: ImpersonationSession = {
      id: crypto.randomUUID(),
      admin_user_id: "admin",
      admin_email: "admin",
      target_user_id: targetUserId,
      target_email: targetEmail,
      target_type: targetType,
      target_company_name: targetCompany,
      target_vendor_id: targetVendorId,
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
    toast.success(`Mode shadow activé pour ${targetCompany}`);
  }, []);

  const stopImpersonation = useCallback(async () => {
    setState(defaultState);
    toast.info("Session d'impersonation terminée");
  }, []);

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
