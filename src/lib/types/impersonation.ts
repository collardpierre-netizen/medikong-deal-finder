export type ImpersonationTarget = "vendor" | "buyer";

export interface ImpersonationSession {
  id: string;
  admin_user_id: string;
  admin_email: string;
  target_user_id: string;
  target_email: string;
  target_type: ImpersonationTarget;
  target_company_name: string;
  started_at: string;
  ended_at: string | null;
  actions_count: number;
}

export interface ImpersonationAction {
  id: string;
  session_id: string;
  admin_user_id: string;
  target_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, any>;
  created_at: string;
  ip_address: string | null;
}

export interface ImpersonationState {
  isImpersonating: boolean;
  session: ImpersonationSession | null;
  originalAdmin: {
    userId: string;
    email: string;
    name: string;
  } | null;
}
