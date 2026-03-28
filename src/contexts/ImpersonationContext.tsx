import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { ImpersonationState, ImpersonationTarget, ImpersonationSession } from "@/lib/types/impersonation";
import { toast } from "sonner";

interface ImpersonationContextType {
  state: ImpersonationState;
  startImpersonation: (targetUserId: string, targetEmail: string, targetType: ImpersonationTarget, targetCompany: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  logAction: (action: string, entityType: string, entityId: string, payload: Record<string, any>) => Promise<void>;
  isImpersonating: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImpersonationState>({
    isImpersonating: false,
    session: null,
    originalAdmin: null,
  });

  // Restore from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("mk_impersonation");
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Persist to sessionStorage
  useEffect(() => {
    if (state.isImpersonating) {
      sessionStorage.setItem("mk_impersonation", JSON.stringify(state));
    } else {
      sessionStorage.removeItem("mk_impersonation");
    }
  }, [state]);

  const startImpersonation = useCallback(async (
    targetUserId: string,
    targetEmail: string,
    targetType: ImpersonationTarget,
    targetCompany: string,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get admin info
    const { data: adminData } = await supabase
      .from("admin_users")
      .select("name, email")
      .eq("user_id", user.id)
      .single();

    // Create session in DB
    const { data: session, error } = await supabase
      .from("impersonation_sessions")
      .insert({
        admin_user_id: user.id,
        admin_email: adminData?.email || user.email || "",
        target_user_id: targetUserId,
        target_email: targetEmail,
        target_type: targetType,
        target_company_name: targetCompany,
      })
      .select()
      .single();

    if (error || !session) {
      toast.error("Erreur lors du démarrage de l'impersonation");
      console.error(error);
      return;
    }

    setState({
      isImpersonating: true,
      session: session as ImpersonationSession,
      originalAdmin: {
        userId: user.id,
        email: user.email || "",
        name: adminData?.name || "Admin",
      },
    });

    toast.success(`Mode Shadow activé — ${targetCompany}`);
  }, []);

  const stopImpersonation = useCallback(async () => {
    if (state.session) {
      await supabase
        .from("impersonation_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", state.session.id);
    }

    setState({
      isImpersonating: false,
      session: null,
      originalAdmin: null,
    });

    toast.info("Session d'impersonation terminée");
  }, [state.session]);

  const logAction = useCallback(async (
    action: string,
    entityType: string,
    entityId: string,
    payload: Record<string, any>,
  ) => {
    if (!state.isImpersonating || !state.session) return;

    const { error } = await supabase.from("impersonation_actions").insert({
      session_id: state.session.id,
      admin_user_id: state.session.admin_user_id,
      target_user_id: state.session.target_user_id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      payload,
    });

    if (!error) {
      // Update local count
      setState(prev => prev.session ? {
        ...prev,
        session: { ...prev.session, actions_count: prev.session.actions_count + 1 },
      } : prev);
    }
  }, [state.isImpersonating, state.session]);

  return (
    <ImpersonationContext.Provider value={{
      state,
      startImpersonation,
      stopImpersonation,
      logAction,
      isImpersonating: state.isImpersonating,
    }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}
