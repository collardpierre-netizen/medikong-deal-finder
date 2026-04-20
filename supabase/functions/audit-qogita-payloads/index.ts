// Audit edge function : fetch des payloads Qogita bruts pour 13 QID cibles
// Objectif : identifier le champ source qui mappe sur qogita_unit_price
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 13 QID cibles + valeur attendue (qogita_unit_price stockée en base)
const TARGETS: Array<{ qid: string; expected_unit_price: number; bucket: string; notes?: string }> = [
  { qid: "afa4cd7f-889a-4a65-8809-737d9effbabf", expected_unit_price: 70165.55, bucket: "normal" },
  { qid: "30b3d4ae-5b71-430f-a1aa-2b87e1ae44fa", expected_unit_price: 3030.30, bucket: "normal", notes: "multi-tier" },
  { qid: "ccbdfbee-e014-462e-9562-9b02794c5d4a", expected_unit_price: 1123.34, bucket: "normal" },
  { qid: "7f608b98-1c0b-46e9-9dbb-6683c20a60a1", expected_unit_price: 1110.98, bucket: "normal" },
  { qid: "cd20c161-2001-4f49-a8fa-b607bffc99e6", expected_unit_price: 944.54, bucket: "normal" },
  { qid: "ef584d0d-72d1-4720-a2a2-47dd232690f4", expected_unit_price: 931.39, bucket: "normal" },
  { qid: "6b34f12e-e0ea-4b00-aac8-f4ea9159c0c1", expected_unit_price: 867.72, bucket: "normal" },
  { qid: "de76abe2-6428-4657-86f9-9acee1902db1", expected_unit_price: 0.01, bucket: "outlier", notes: "ratio 1.0000 sub-1€" },
  { qid: "a68e416e-4ddd-4ae0-895d-54382e3aa709", expected_unit_price: 0.14, bucket: "outlier", notes: "ratio 1.2143 sub-1€" },
];

function findMatchingFields(obj: any, target: number, path = "", results: Array<{ path: string; value: number }> = []): Array<{ path: string; value: number }> {
  if (obj === null || obj === undefined) return results;
  if (typeof obj === "number") {
    if (Math.abs(obj - target) < 0.001) results.push({ path, value: obj });
    return results;
  }
  if (typeof obj === "string") {
    const num = parseFloat(obj);
    if (!isNaN(num) && Math.abs(num - target) < 0.001) results.push({ path: path + " (string)", value: num });
    return results;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => findMatchingFields(item, target, `${path}[${i}]`, results));
    return results;
  }
  if (typeof obj === "object") {
    Object.keys(obj).forEach((k) => findMatchingFields(obj[k], target, path ? `${path}.${k}` : k, results));
  }
  return results;
}

function listAllPriceFields(obj: any, path = "", results: Array<{ path: string; value: any }> = []): Array<{ path: string; value: any }> {
  if (obj === null || obj === undefined) return results;
  if (typeof obj === "number" || (typeof obj === "string" && !isNaN(parseFloat(obj)))) {
    if (path.toLowerCase().match(/price|cost|amount|tier|wholesale|msrp|rrp|tax/)) {
      results.push({ path, value: obj });
    }
    return results;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => listAllPriceFields(item, `${path}[${i}]`, results));
    return results;
  }
  if (typeof obj === "object") {
    Object.keys(obj).forEach((k) => listAllPriceFields(obj[k], path ? `${path}.${k}` : k, results));
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get Qogita token
    const { data: rows } = await sb.from("qogita_config").select("key, value");
    const cfg: Record<string, string> = {};
    (rows || []).forEach((r: any) => { cfg[r.key] = r.value; });

    const email = cfg.qogita_email;
    const password = cfg.qogita_password;
    if (!email || !password) throw new Error("Missing qogita_email / qogita_password in qogita_config");
    const baseUrl = cfg.base_url || "https://api.qogita.com";

    const authRes = await fetch(`${baseUrl}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!authRes.ok) throw new Error(`Auth failed: ${authRes.status} ${await authRes.text()}`);
    const { accessToken } = await authRes.json();

    // Fetch each QID
    const results: any[] = [];
    for (const target of TARGETS) {
      try {
        const offerRes = await fetch(`${baseUrl}/offers/${target.qid}/`, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });
        const status = offerRes.status;
        const body = await offerRes.text();
        let payload: any = null;
        try { payload = JSON.parse(body); } catch { /* keep raw */ }

        if (status !== 200 || !payload) {
          results.push({ qid: target.qid, bucket: target.bucket, expected: target.expected_unit_price, status, error: body.slice(0, 500) });
          continue;
        }

        const matching = findMatchingFields(payload, target.expected_unit_price);
        const allPriceFields = listAllPriceFields(payload);

        results.push({
          qid: target.qid,
          bucket: target.bucket,
          notes: target.notes,
          expected_unit_price: target.expected_unit_price,
          status,
          matching_fields: matching,
          all_price_fields: allPriceFields,
          raw_payload: payload,
        });
      } catch (e: any) {
        results.push({ qid: target.qid, bucket: target.bucket, error: e.message });
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    // Build summary table
    const summary = results.map((r) => ({
      qid: r.qid,
      bucket: r.bucket,
      expected: r.expected_unit_price,
      matching_fields: r.matching_fields?.map((m: any) => m.path) || [],
      total_price_fields_in_payload: r.all_price_fields?.length || 0,
      status: r.status,
      notes: r.notes,
    }));

    return new Response(JSON.stringify({ summary, full_results: results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
