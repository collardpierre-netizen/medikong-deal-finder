import { createContext, useContext } from "react";

export interface ImpersonationSession {
  id: string;
  admin_user_id: string;
  admin_email: string;
  target_user_id: string;
  target_email: string;
  target_type: string;
  target_company_name: string;
  target_vendor_id?: string;
  // For buyer "act-as" sessions, the JS client holds the target's auth session
  // and `auth_swap_session_id` points to the buyer_impersonation_sessions row.
  auth_swap_session_id?: string | null;
  actions_count: number;
  started_at: string;
}

export interface ImpersonationState {
  isImpersonating: boolean;
  session: ImpersonationSession | null;
  originalAdmin: { userId: string; email: string; name: string } | null;
}

export interface ImpersonationContextType {
  state: ImpersonationState;
  startImpersonation: (targetUserId: string, targetEmail: string, targetType: string, targetCompany: string, targetVendorId?: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  logAction: (action: string, entityType: string, entityId: string, payload: Record<string, unknown>) => Promise<void>;
  isImpersonating: boolean;
}

export const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}
