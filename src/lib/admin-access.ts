import { supabase } from "@/integrations/supabase/client";

const ADMIN_REQUEST_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error("La vérification des droits a expiré. Réessayez."));
    }, ADMIN_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

export async function checkIsAdminUser(userId: string): Promise<boolean> {
  const { data, error } = await withTimeout(
    (async () => await supabase.rpc("is_admin", { _user_id: userId }))()
  );

  if (error) throw error;
  return data === true;
}

export async function fetchAdminProfile(userId: string): Promise<{ role: string | null; name: string | null }> {
  const { data, error } = await withTimeout(
    (async () =>
      await supabase
        .from("admin_users")
        .select("role, name")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle())()
  );

  if (error) throw error;

  return {
    role: data?.role ?? null,
    name: data?.name ?? null,
  };
}