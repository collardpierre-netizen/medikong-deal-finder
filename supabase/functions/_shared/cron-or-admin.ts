// Shared auth guard for cron-driven edge functions.
// Allows callers presenting:
//  - a valid x-cron-secret (validated server-side via validate_cron_secret RPC)
//  - OR the Supabase service role JWT (Authorization: Bearer <SERVICE_ROLE_KEY>)
//  - OR (optional) an authenticated admin/super_admin
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "./admin-or-service.ts";

export type CronOrAdminResult =
  | { ok: true; via: "cron" | "service_role" | "admin"; userId?: string }
  | { ok: false; status: number; error: string };

export async function requireCronOrService(
  req: Request,
  opts: { allowAdmin?: boolean } = {},
): Promise<CronOrAdminResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  if (cronSecret) {
    try {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: ok, error } = await admin.rpc("validate_cron_secret", { _secret: cronSecret });
      if (!error && ok) return { ok: true, via: "cron" };
    } catch (_e) {
      // fall through to other auth methods
    }
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token && serviceRoleKey && token === serviceRoleKey) {
    return { ok: true, via: "service_role" };
  }

  if (opts.allowAdmin) {
    const r = await requireAdminOrService(req);
    if (r.ok) return { ok: true, via: r.via === "service_role" ? "service_role" : "admin", userId: r.userId };
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}
