import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { toast } from "sonner";

interface ImpersonationSession {
  id: string;
  admin_user_id: string;
  admin_email: string;
  target_user_id: string;
  target_email: string;
  target_type: string;
  target_company_name: string;
  target_vendor_id?: string;
  actions_count: number;
  started_at: string;
}

interface ImpersonationState {
  isImpersonating: boolean;
  session: ImpersonationSession | null;
  originalAdmin: { userId: string; email: string; name: string } | null;
}

interface ImpersonationContextType {
  state: ImpersonationState;
  startImpersonation: (targetUserId: string, targetEmail: string, targetType: string, targetCompany: string, targetVendorId?: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  logAction: (action: string, entityType: string, entityId: string, payload: Record<string, any>) => Promise<void>;
  isImpersonating: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImpersonationState>(() => {
    try {
      const saved = localStorage.getItem("mk_impersonation");
      return saved
        ? JSON.parse(saved)
        : { isImpersonating: false, session: null, originalAdmin: null };
    } catch {
      return { isImpersonating: false, session: null, originalAdmin: null };
    }
  });

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "mk_impersonation") return;
      if (!event.newValue) {
        setState({ isImpersonating: false, session: null, originalAdmin: null });
        return;
      }
      try {
        setState(JSON.parse(event.newValue));
      } catch {}
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (state.isImpersonating) localStorage.setItem("mk_impersonation", JSON.stringify(state));
    else localStorage.removeItem("mk_impersonation");
  }, [state]);

  const startImpersonation = useCallback(async (targetUserId: string, targetEmail: string, targetType: string, targetCompany: string, targetVendorId?: string) => {
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
    const newState = {
      isImpersonating: true,
      session,
      originalAdmin: { userId: "admin", email: "admin", name: "Admin" },
    };
    // Write to localStorage immediately so new tabs can read it right away
    localStorage.setItem("mk_impersonation", JSON.stringify(newState));
    setState(newState);
    toast.success(`Mode shadow activé pour ${targetCompany}`);
  }, []);

  const stopImpersonation = useCallback(async () => {
    setState({ isImpersonating: false, session: null, originalAdmin: null });
    toast.info("Session d'impersonation terminée");
  }, []);

  const logAction = useCallback(async () => {}, []);

  return (
    <ImpersonationContext.Provider value={{ state, startImpersonation, stopImpersonation, logAction, isImpersonating: state.isImpersonating }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}
