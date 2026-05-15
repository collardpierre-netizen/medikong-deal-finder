// Helpers to swap the Supabase auth session between the admin and a target buyer.
// All cart/alert/preference writes done while impersonating naturally carry the
// target's auth.uid() because the JS client now holds the target's session.
import { supabase } from "@/integrations/supabase/client";

const ADMIN_SESSION_BACKUP_KEY = "mk_admin_session_backup";

interface BackedUpSession {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string | null;
}

function backupAdminSession(session: { access_token: string; refresh_token: string; user: { id: string; email?: string | null } }) {
  const payload: BackedUpSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user_id: session.user.id,
    email: session.user.email ?? null,
  };
  sessionStorage.setItem(ADMIN_SESSION_BACKUP_KEY, JSON.stringify(payload));
}

function readAdminBackup(): BackedUpSession | null {
  const raw = sessionStorage.getItem(ADMIN_SESSION_BACKUP_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as BackedUpSession; } catch { return null; }
}

export function clearAdminBackup() {
  sessionStorage.removeItem(ADMIN_SESSION_BACKUP_KEY);
}

export function hasAdminBackup() {
  return !!sessionStorage.getItem(ADMIN_SESSION_BACKUP_KEY);
}

/**
 * Enter the target buyer's auth session.
 * - Calls `start-buyer-impersonation` (super_admin gate, opens DB session row, returns magiclink token_hash)
 * - Backs up the current admin session, then verifies the OTP to swap it
 *
 * Returns the session_id of the impersonation row.
 */
export async function enterBuyerSession(opts: {
  targetUserId: string;
  reason?: string;
}): Promise<{ sessionId: string; targetEmail: string }> {
  // Snapshot the current admin session
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (!currentSession) throw new Error("Aucune session admin active.");
  backupAdminSession(currentSession);

  const { data, error } = await supabase.functions.invoke("start-buyer-impersonation", {
    body: { target_user_id: opts.targetUserId, reason: opts.reason },
  });
  if (error || !data?.token_hash) {
    clearAdminBackup();
    throw new Error(error?.message || data?.error || "Impossible de démarrer la session.");
  }

  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.token_hash,
  });
  if (otpErr) {
    // restore admin session
    await restoreAdminSession().catch(() => {});
    throw new Error(otpErr.message);
  }

  return { sessionId: data.session_id, targetEmail: data.email };
}

/**
 * Close the impersonation session and restore the admin auth session.
 */
export async function exitBuyerSession(sessionId: string | null) {
  // 1) try to close the DB session row while we still have target's JWT — but the RPC
  //    is super_admin gated, so we must restore the admin session FIRST then call end.
  const backup = readAdminBackup();
  if (backup) {
    await supabase.auth.setSession({
      access_token: backup.access_token,
      refresh_token: backup.refresh_token,
    });
  } else {
    await supabase.auth.signOut().catch(() => {});
  }

  if (sessionId) {
    await supabase.functions.invoke("end-buyer-impersonation", {
      body: { session_id: sessionId, ended_reason: "manual" },
    }).catch(() => {});
  }

  clearAdminBackup();
}

async function restoreAdminSession() {
  const backup = readAdminBackup();
  if (!backup) return;
  await supabase.auth.setSession({
    access_token: backup.access_token,
    refresh_token: backup.refresh_token,
  });
  clearAdminBackup();
}
