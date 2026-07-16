// @ts-nocheck — Deno runtime
// Admin utility: pre-check whether a Peppol identifier is listed on the public
// Peppol Directory (peppoldirectory.eu). No auth to Falco — purely a public
// SMP lookup wrapped as an edge function so the browser doesn't hit CORS.
//
// Body: { peppol_id: string }  — e.g. "0208:BE1005771323"
// Response: { registered, found_in_directory, document_type_supported?, message?, raw? }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { checkPeppolReceiverRegistered } from "../_shared/falco-peppol.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    // Auth: admin JWT or service_role (avoid abusing this as an open proxy).
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (bearer !== serviceRole) {
      if (!bearer || bearer === anonKey) return json(401, { error: "unauthorized" });
      const user = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await user.auth.getClaims(bearer);
      const uid = claims?.claims?.sub;
      if (!uid) return json(401, { error: "unauthorized" });
      const { data: adm } = await supabase.rpc("is_admin", { _user_id: uid });
      if (!adm) return json(403, { error: "forbidden" });
    }

    const body = await req.json().catch(() => ({}));
    const peppolId = String(body?.peppol_id || "").trim();
    if (!peppolId) return json(400, { error: "peppol_id_required" });

    const result = await checkPeppolReceiverRegistered(peppolId);
    return json(200, { ok: true, peppol_id: peppolId, ...result });
  } catch (error: any) {
    console.error("check-peppol-directory error:", error);
    return json(200, { ok: false, error: error?.message, stack: error?.stack });
  }
});
