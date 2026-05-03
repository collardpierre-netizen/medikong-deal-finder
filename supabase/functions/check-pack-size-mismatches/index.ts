// Detects products where DB pack_size disagrees with what the name suggests
// (regex extraction) OR with a GTIN twin already validated. Read-only by default.
// Optionally lets an admin "validate" or "fix" a single product.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Mirror of src/lib/pack-size.ts (kept in sync with backfill function)
function extractPackSizeFromName(name: string | null): number | null {
  if (!name || typeof name !== "string") return null;
  const cleaned = name.trim();
  if (!cleaned) return null;

  const cerpSlash = cleaned.match(/(?:^|\s)\/\s*(\d{1,3})\b\s*$/);
  if (cerpSlash) {
    const n = Number(cerpSlash[1]);
    if (n >= 2 && n <= 500) return n;
  }
  const cerpTrailing = cleaned.match(/(?:^|\s)([A-Za-zÀ-ÿ./]+)\s+(\d{1,3})\s*$/);
  if (cerpTrailing) {
    const prevToken = cerpTrailing[1].toLowerCase().replace(/\.$/, "");
    const n = Number(cerpTrailing[2]);
    const isUnit = /^(mg|ml|g|kg|cl|l|kcal|cc|oz|mcg|µg|ug|ui|iu|mm|cm|m|%)$/.test(prevToken);
    if (!isUnit && n >= 2 && n <= 50) return n;
  }
  const multiPack = cleaned.match(
    /\b(\d{1,3})\s*[x×]\s*\d+(?:[.,]\d+)?\s*(ml|cl|l|g|mg|kg|cc)\b/i,
  );
  if (multiPack) {
    const n = Number(multiPack[1]);
    if (n >= 2 && n <= 500) return n;
  }
  const galenic =
    /\b(\d{1,4})\s*(caps?|capsules?|cps|comprim[eé]s?|cpr?|c[oó]mp|g[eé]lules?|gel\.?|sachets?|sticks?|ampoules?|amp\.?|doses?|sprays?|patchs?|tabl(?:ettes)?|pastilles?|suppositoires?|supp\.?|ovules?|lingettes?|pi[èe]ces?|pcs?)\b/i;
  const g = cleaned.match(galenic);
  if (g) {
    const n = Number(g[1]);
    if (n >= 2 && n <= 1000) return n;
  }
  const containerOf = cleaned.match(
    /\b(?:bo[iî]te|pack|lot|paquet|box|set)\s*(?:de|d['’]|of)\s*(\d{1,4})\b/i,
  );
  if (containerOf) {
    const n = Number(containerOf[1]);
    if (n >= 2 && n <= 1000) return n;
  }
  return null;
}

interface Body {
  action?: "scan" | "validate" | "apply";
  // scan params
  scanLimit?: number;       // how many products to inspect per call
  cursor?: string | null;   // last id seen
  onlyMismatches?: boolean; // default true
  // mutating params
  productId?: string;
  newPackSize?: number;
}

async function requireAdmin(authHeader: string | null) {
  if (!authHeader) throw new Error("Unauthorized");
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles ?? []).some(r =>
    r.role === "admin" || r.role === "super_admin" || r.role === "moderator"
  );
  if (!isAdmin) throw new Error("Forbidden");
  return { admin, user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { admin } = await requireAdmin(req.headers.get("authorization"));
    const body: Body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action ?? "scan";

    if (action === "validate") {
      if (!body.productId) throw new Error("productId required");
      const { error } = await admin
        .from("products")
        .update({ pack_size_validated: true })
        .eq("id", body.productId);
      if (error) throw error;
      return json({ ok: true, productId: body.productId, validated: true });
    }

    if (action === "apply") {
      if (!body.productId || !body.newPackSize || body.newPackSize < 1) {
        throw new Error("productId & newPackSize required");
      }
      const { error } = await admin
        .from("products")
        .update({
          pack_size: body.newPackSize,
          pack_size_source: "admin_manual",
          pack_size_updated_at: new Date().toISOString(),
          pack_size_validated: true,
        })
        .eq("id", body.productId);
      if (error) throw error;
      return json({ ok: true, productId: body.productId, pack_size: body.newPackSize });
    }

    // ----- scan -----
    const scanLimit = Math.min(Math.max(body.scanLimit ?? 1000, 100), 5000);
    const onlyMismatches = body.onlyMismatches ?? true;

    let q = admin
      .from("products")
      .select("id, name, gtin, pack_size, pack_size_source, pack_size_validated, is_active")
      .not("pack_size", "is", null)
      .eq("pack_size_validated", false)
      .order("id", { ascending: true })
      .limit(scanLimit);
    if (body.cursor) q = q.gt("id", body.cursor);

    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows || rows.length === 0) {
      return json({ ok: true, scanned: 0, mismatches: [], nextCursor: null, done: true });
    }

    // GTIN twins lookup (any product with same GTIN, validated, pack_size > 1)
    const gtins = Array.from(new Set(rows.map(r => r.gtin).filter(Boolean) as string[]));
    const twinMap = new Map<string, number>();
    if (gtins.length > 0) {
      const { data: twins } = await admin
        .from("products")
        .select("gtin, pack_size, pack_size_validated")
        .in("gtin", gtins)
        .gt("pack_size", 1);
      for (const t of twins ?? []) {
        if (!t.gtin || !t.pack_size) continue;
        // Prefer validated values
        const existing = twinMap.get(t.gtin);
        if (!existing || t.pack_size_validated) twinMap.set(t.gtin, t.pack_size);
      }
    }

    const mismatches: Array<{
      id: string;
      name: string;
      gtin: string | null;
      db_pack_size: number;
      regex_pack_size: number | null;
      gtin_twin_pack_size: number | null;
      suggested: number;
      reason: string;
      source: string | null;
      is_active: boolean;
    }> = [];

    for (const r of rows) {
      const fromName = extractPackSizeFromName(r.name);
      const fromTwin = r.gtin ? twinMap.get(r.gtin) ?? null : null;
      const dbPs = r.pack_size as number;

      const nameMismatch = fromName && fromName > 1 && fromName !== dbPs;
      const twinMismatch = fromTwin && fromTwin > 1 && fromTwin !== dbPs;

      if (!nameMismatch && !twinMismatch) {
        if (!onlyMismatches) {
          mismatches.push({
            id: r.id, name: r.name, gtin: r.gtin,
            db_pack_size: dbPs, regex_pack_size: fromName, gtin_twin_pack_size: fromTwin,
            suggested: dbPs, reason: "ok", source: r.pack_size_source, is_active: !!r.is_active,
          });
        }
        continue;
      }

      // Suggested: prefer regex (libellé fait foi) > twin
      const suggested = (nameMismatch ? fromName : fromTwin) as number;
      const reason = nameMismatch && twinMismatch
        ? "name+twin"
        : nameMismatch ? "name" : "twin";

      mismatches.push({
        id: r.id,
        name: r.name,
        gtin: r.gtin,
        db_pack_size: dbPs,
        regex_pack_size: fromName,
        gtin_twin_pack_size: fromTwin,
        suggested,
        reason,
        source: r.pack_size_source,
        is_active: !!r.is_active,
      });
    }

    return json({
      ok: true,
      scanned: rows.length,
      mismatches,
      nextCursor: rows[rows.length - 1].id,
      done: rows.length < scanLimit,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
