import { supabase } from "@/integrations/supabase/client";

export type AdminAuditAction =
  | "impersonate.start"
  | "impersonate.stop"
  | "impersonate.page_view"
  | "customer.verify"
  | "customer.suspend"
  | "customer.profile_change.customer_type"
  | "customer.profile_change.visibility_profile"
  | "order.hard_delete"
  | "order.commission_override"
  | string;

export interface LogAdminAuditOptions {
  targetId?: string | null;
  targetType?: string | null;
  path?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort logger for admin audit events.
 * - Calls the SECURITY DEFINER RPC `log_admin_audit_event`.
 * - Swallows errors silently so audit failures never block the underlying admin action.
 */
export async function logAdminAudit(
  action: AdminAuditAction,
  opts: LogAdminAuditOptions = {},
): Promise<void> {
  try {
    const path = opts.path ?? (typeof window !== "undefined" ? window.location.pathname : null);
    const metadata = {
      ...(opts.metadata ?? {}),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      url: typeof window !== "undefined" ? window.location.href : null,
    };
    await (supabase as any).rpc("log_admin_audit_event", {
      _action: action,
      _target_id: opts.targetId ?? null,
      _target_type: opts.targetType ?? null,
      _path: path,
      _metadata: metadata,
    });
  } catch (e) {
    // never throw from audit
    if (typeof console !== "undefined") console.warn("[admin-audit] log failed", e);
  }
}
