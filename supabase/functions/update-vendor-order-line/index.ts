// Update a vendor order line status via shared token (no JWT required).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-requested-with, accept, accept-language",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Expose-Headers": "content-type, content-length",
  "Vary": "Origin, Access-Control-Request-Headers",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Logging structuré pour 4xx/410 — facilite le diagnostic depuis les logs Edge.
// Tag : [vendor_order_line.update.<status>] error=<code> ctx=<json>
function logRejection(status: number, errorCode: string, ctx: Record<string, unknown>) {
  let payload: string;
  try { payload = JSON.stringify(ctx); } catch { payload = String(ctx); }
  const msg = `[vendor_order_line.update.${status}] error=${errorCode} ctx=${payload}`;
  // 401/403/410/5xx → error ; 400 (input client) → warn pour ne pas polluer les alertes.
  if (status >= 500 || status === 401 || status === 403 || status === 410) {
    console.error(msg);
  } else {
    console.warn(msg);
  }
}

function reject(
  status: number,
  errorCode: string,
  ctx: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  logRejection(status, errorCode, ctx);
  return json(status, { error: errorCode, ...extra });
}

type Action = "confirm" | "ship" | "deliver" | "cancel";

// FSM (allowed source statuses → target status)
const TRANSITIONS: Record<Action, { from: string[]; to: string }> = {
  confirm: { from: ["pending"], to: "processing" },
  ship: { from: ["processing"], to: "shipped" },
  deliver: { from: ["shipped"], to: "delivered" },
  cancel: { from: ["pending", "processing"], to: "cancelled" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    // Reflect requested headers so the browser never blocks a custom header we didn't list.
    const requested = req.headers.get("Access-Control-Request-Headers");
    const headers: Record<string, string> = { ...corsHeaders };
    if (requested) headers["Access-Control-Allow-Headers"] = requested;
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "POST, OPTIONS" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { token, line_id, action, tracking_number, tracking_url } = body as {
      token?: string; line_id?: string; action?: Action; tracking_number?: string; tracking_url?: string;
    };

    if (!token || !line_id || !action) return json(400, { error: "missing_params" });
    if (!(action in TRANSITIONS)) return json(400, { error: "invalid_action" });

    // Normalize + validate tracking fields
    const trackingNumberClean = typeof tracking_number === "string" ? tracking_number.trim() : undefined;
    const trackingUrlClean = typeof tracking_url === "string" ? tracking_url.trim() : undefined;

    if (trackingNumberClean !== undefined && trackingNumberClean.length > 0) {
      if (trackingNumberClean.length < 4 || trackingNumberClean.length > 100) {
        return json(400, { error: "tracking_number_invalid" });
      }
      if (!/^[A-Za-z0-9._\-\/\s]+$/.test(trackingNumberClean)) {
        return json(400, { error: "tracking_number_invalid" });
      }
    }

    if (trackingUrlClean !== undefined && trackingUrlClean.length > 0) {
      if (trackingUrlClean.length > 2048) {
        return json(400, { error: "tracking_url_invalid" });
      }
      try {
        const parsed = new URL(trackingUrlClean);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          return json(400, { error: "tracking_url_invalid" });
        }
      } catch {
        return json(400, { error: "tracking_url_invalid" });
      }
    }

    if (action === "ship" && (!trackingNumberClean || trackingNumberClean.length === 0)) {
      return json(400, { error: "tracking_number_required" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Token validation — table has NO `id` column, PK is `token`.
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("vendor_order_tokens")
      .select("order_id, vendor_id, sub_order_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (tokenErr) return json(500, { error: tokenErr.message });
    if (!tokenRow) return json(401, { error: "invalid_token" });

    // Only expiration blocks. `used_at IS NOT NULL` is NOT a block.
    if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return json(410, { error: "token_expired" });
    }

    // 2. Verify line belongs to vendor+order
    const { data: line, error: lineErr } = await supabase
      .from("order_lines")
      .select("id, fulfillment_status, order_id, vendor_id")
      .eq("id", line_id)
      .eq("order_id", tokenRow.order_id)
      .eq("vendor_id", tokenRow.vendor_id)
      .maybeSingle();
    if (lineErr) return json(500, { error: lineErr.message });
    if (!line) return json(403, { error: "forbidden" });

    // 3. FSM check
    const transition = TRANSITIONS[action];
    const currentStatus = String(line.fulfillment_status);
    if (!transition.from.includes(currentStatus)) {
      return json(400, { error: "invalid_transition", from: currentStatus, action });
    }
    const newStatus = transition.to;
    const nowIso = new Date().toISOString();

    // 4. Update order_lines (fulfillment_status enum). PostgREST applies the cast automatically.
    const linePatch: Record<string, unknown> = {
      fulfillment_status: newStatus,
    };
    if (trackingNumberClean) linePatch.tracking_number = trackingNumberClean;
    if (trackingUrlClean) linePatch.tracking_url = trackingUrlClean;

    const { data: updatedLine, error: updErr } = await supabase
      .from("order_lines")
      .update(linePatch)
      .eq("id", line_id)
      .select("id, fulfillment_status, tracking_number, tracking_url")
      .maybeSingle();
    if (updErr) return json(500, { error: updErr.message });

    // 5. Update sub_orders in parallel of order_lines, per action.
    let updatedSubOrderId: string | null = null;
    if (tokenRow.sub_order_id) {
      // Fetch current timestamps to emulate COALESCE(existing, now()).
      const { data: currentSub, error: subFetchErr } = await supabase
        .from("sub_orders")
        .select("vendor_confirmed_at, shipped_at")
        .eq("id", tokenRow.sub_order_id)
        .maybeSingle();
      if (subFetchErr) return json(500, { error: subFetchErr.message });

      const subPatch: Record<string, unknown> = {
        status: newStatus,
        updated_at: nowIso,
      };
      if (action === "confirm" && !currentSub?.vendor_confirmed_at) {
        subPatch.vendor_confirmed_at = nowIso;
      }
      if (action === "ship" && !currentSub?.shipped_at) {
        subPatch.shipped_at = nowIso;
      }

      const { data: subUpdated, error: subErr } = await supabase
        .from("sub_orders")
        .update(subPatch)
        .eq("id", tokenRow.sub_order_id)
        .select("id")
        .maybeSingle();
      if (subErr) return json(500, { error: subErr.message });
      updatedSubOrderId = subUpdated?.id ?? tokenRow.sub_order_id;
    }

    return json(200, {
      success: true,
      new_status: newStatus,
      updated_line_id: updatedLine?.id ?? line_id,
      sub_order_id: updatedSubOrderId,
    });
  } catch (e) {
    return json(500, { error: String((e as Error).message ?? e) });
  }
});
