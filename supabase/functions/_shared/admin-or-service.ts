// Shared auth guard: allows calls only from
//  - the Supabase service role (Authorization: Bearer <SERVICE_ROLE_KEY>)
//  - an authenticated user that is an active admin/super_admin
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AdminOrServiceResult =
  | { ok: true; via: "service_role" | "admin"; userId?: string }
  | { ok: false; status: number; error: string };

export async function requireAdminOrService(req: Request): Promise<AdminOrServiceResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Missing Authorization" };

  if (serviceRoleKey && token === serviceRoleKey) {
    return { ok: true, via: "service_role" };
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error } = await userClient.auth.getUser();
    if (error || !userData?.user) {
      return { ok: false, status: 401, error: "Invalid token" };
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: row } = await admin
      .from("admin_users")
      .select("role, is_active")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!row?.is_active || !["super_admin", "admin"].includes(row.role)) {
      return { ok: false, status: 403, error: "Admin role required" };
    }
    return { ok: true, via: "admin", userId: userData.user.id };
  } catch (e) {
    return { ok: false, status: 401, error: (e as Error).message };
  }
}
