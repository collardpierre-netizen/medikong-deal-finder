import { supabase } from "@/integrations/supabase/client";

const ADMIN_REQUEST_TIMEOUT_MS = 8000;

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function withTimeout<T>(runner: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ADMIN_REQUEST_TIMEOUT_MS);

  try {
    return await runner(controller.signal);
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("La vérification des droits a expiré. Réessayez.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function checkIsAdminUser(userId: string): Promise<boolean> {
  const { data, error } = await withTimeout((signal) =>
    supabase.rpc("is_admin", { _user_id: userId }).abortSignal(signal)
  );

  if (error) throw error;
  return data === true;
}

export async function fetchAdminProfile(userId: string): Promise<{ role: string | null; name: string | null }> {
  const { data, error } = await withTimeout((signal) =>
    supabase
      .from("admin_users")
      .select("role, name")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle()
      .abortSignal(signal)
  );

  if (error) throw error;

  return {
    role: data?.role ?? null,
    name: data?.name ?? null,
  };
}