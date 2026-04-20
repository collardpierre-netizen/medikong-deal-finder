// Audit edge function v2 : fetch via /variants/{gtin}/?country=BE et inspecter les offres imbriquées
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 13 cibles : GTIN + qogita_offer_qid à matcher dans le payload variant
const TARGETS: Array<{ qid: string; gtin: string; expected_unit_price: number; bucket: string; notes?: string }> = [
  { qid: "afa4cd7f-889a-4a65-8809-737d9effbabf", gtin: "3616307416610", expected_unit_price: 70165.55, bucket: "normal" },
  { qid: "30b3d4ae-5b71-430f-a1aa-2b87e1ae44fa", gtin: "4006000184654", expected_unit_price: 3030.30, bucket: "normal", notes: "multi-tier (4 tiers)" },
  { qid: "ccbdfbee-e014-462e-9562-9b02794c5d4a", gtin: "3700693201568", expected_unit_price: 1123.34, bucket: "normal" },
  { qid: "7f608b98-1c0b-46e9-9dbb-6683c20a60a1", gtin: "7612017903200", expected_unit_price: 1110.98, bucket: "normal" },
  { qid: "cd20c161-2001-4f49-a8fa-b607bffc99e6", gtin: "4030363008265", expected_unit_price: 944.54, bucket: "normal" },
  { qid: "ef584d0d-72d1-4720-a2a2-47dd232690f4", gtin: "0806809221697", expected_unit_price: 931.39, bucket: "normal" },
  { qid: "6b34f12e-e0ea-4b00-aac8-f4ea9159c0c1", gtin: "0195950610741", expected_unit_price: 867.72, bucket: "normal" },
  { qid: "de76abe2-6428-4657-86f9-9acee1902db1", gtin: "8414135863126", expected_unit_price: 0.01, bucket: "outlier", notes: "ratio 1.0000 sub-1€" },
  { qid: "a68e416e-4ddd-4ae0-895d-54382e3aa709", gtin: "5903018900612", expected_unit_price: 0.14, bucket: "outlier", notes: "ratio 1.2143 sub-1€" },
];

function findInOffer(obj: any, target: number, path = "", out: Array<{ path: string; value: any }> = []): Array<{ path: string; value: any }> {
  if (obj === null || obj === undefined) return out;
  if (typeof obj === "number" && Math.abs(obj - target) < 0.005) {
    out.push({ path, value: obj });
    return out;
  }
  if (typeof obj === "string") {
    const n = parseFloat(obj);
    if (!isNaN(n) && Math.abs(n - target) < 0.005) out.push({ path: `${path}(str)`, value: n });
    return out;
  }
  if (Array.isArray(obj)) { obj.forEach((v, i) => findInOffer(v, target, `${path}[${i}]`, out)); return out; }
  if (typeof obj === "object") { Object.keys(obj).forEach((k) => findInOffer(obj[k], target, path ? `${path}.${k}` : k, out)); }
  return out;
}

function listPriceFields(obj: any, path = "", out: Array<{ path: string; value: any }> = []): Array<{ path: string; value: any }> {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== "object") {
    if (path.toLowerCase().match(/price|cost|amount|tier|wholesale|msrp|rrp|tax|unit/)) {
      out.push({ path, value: obj });
    }
    return out;
  }
  if (Array.isArray(obj)) { obj.forEach((v, i) => listPriceFields(v, `${path}[${i}]`, out)); return out; }
  Object.keys(obj).forEach((k) => listPriceFields(obj[k], path ? `${path}.${k}` : k, out));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows } = await sb.from("qogita_config").select("key, value");
    const cfg: Record<string, string> = {};
    (rows || []).forEach((r: any) => { cfg[r.key] = r.value; });

    const baseUrl = cfg.base_url || "https://api.qogita.com";
    const authRes = await fetch(`${baseUrl}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cfg.qogita_email, password: cfg.qogita_password }),
    });
    if (!authRes.ok) throw new Error(`Auth ${authRes.status}: ${await authRes.text()}`);
    const { accessToken } = await authRes.json();

    const results: any[] = [];
    for (const t of TARGETS) {
      try {
        const url = `${baseUrl}/variants/${t.gtin}/?country=BE`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
        const status = r.status;
        const bodyText = await r.text();
        let payload: any = null;
        try { payload = JSON.parse(bodyText); } catch {}

        if (status !== 200 || !payload) {
          results.push({ qid: t.qid, gtin: t.gtin, bucket: t.bucket, status, error: bodyText.slice(0, 300) });
          continue;
        }

        // Find the offer with our QID in payload.offers[]
        const offers = payload.offers || [];
        const matchingOffer = offers.find((o: any) => o.qid === t.qid);

        // Find numeric matches anywhere in the matching offer (or whole payload if not found)
        const searchTarget = matchingOffer || payload;
        const matchPaths = findInOffer(searchTarget, t.expected_unit_price);
        const allPriceFields = matchingOffer ? listPriceFields(matchingOffer) : [];

        results.push({
          qid: t.qid,
          gtin: t.gtin,
          bucket: t.bucket,
          notes: t.notes,
          expected_unit_price: t.expected_unit_price,
          status,
          offer_qid_found_in_payload: !!matchingOffer,
          total_offers_in_payload: offers.length,
          all_offer_qids: offers.map((o: any) => o.qid),
          matching_field_paths: matchPaths.map((m) => m.path),
          all_price_fields_in_matching_offer: allPriceFields,
          matching_offer_raw: matchingOffer,
        });
      } catch (e: any) {
        results.push({ qid: t.qid, gtin: t.gtin, error: e.message });
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    const summary = results.map((r) => ({
      qid: r.qid,
      gtin: r.gtin,
      bucket: r.bucket,
      notes: r.notes,
      expected: r.expected_unit_price,
      status: r.status,
      offer_found: r.offer_qid_found_in_payload,
      offers_in_payload: r.total_offers_in_payload,
      matching_paths: r.matching_field_paths,
    }));

    return new Response(JSON.stringify({ summary, full_results: results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500, headers: corsHeaders });
  }
});
