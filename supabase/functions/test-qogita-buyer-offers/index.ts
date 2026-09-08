// One-off diagnostic: exercises the OFFICIAL buyer offers endpoint
// GET /buyers/variants/{variant_fid}/offers/ with a FRESH token.
// Returns URL, HTTP status, raw body for each variant tested.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/admin-or-service.ts";
import { maybeDecrypt } from "../_shared/qogita-creds.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const QOGITA = "https://api.qogita.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const guard = await requireAdminOrService(req);
  if (!guard.ok) return new Response(JSON.stringify({ error: guard.error }), { status: guard.status, headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    // Accept either { fids: [...] } or { gtins: [...] }; default: 3 Nuxe fids resolved from DB
    let fids: string[] = Array.isArray(body?.fids) ? body.fids : [];
    const gtins: string[] = Array.isArray(body?.gtins) ? body.gtins : [];

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) Fresh login
    const { data: cfgRows } = await sb.from("qogita_config").select("key,value").in("key", ["qogita_email", "qogita_password"]);
    const cfg: Record<string, string> = {};
    (cfgRows || []).forEach((r: any) => { cfg[r.key] = r.value; });
    const email = cfg.qogita_email;
    const password = await maybeDecrypt(cfg.qogita_password);
    if (!email || !password) throw new Error("Qogita credentials missing");

    const loginRes = await fetch(`${QOGITA}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const loginBody = await loginRes.text();
    let loginJson: any = null;
    try { loginJson = JSON.parse(loginBody); } catch { /* keep raw */ }
    const token = loginJson?.accessToken as string | undefined;
    const loginSummary = {
      url: `${QOGITA}/auth/login/`,
      status: loginRes.status,
      hasAccessToken: !!token,
      bodyPreview: token ? "<redacted: contained accessToken>" : loginBody.slice(0, 500),
    };
    if (!token) {
      return new Response(JSON.stringify({ login: loginSummary, error: "no accessToken" }), { headers: cors });
    }

    // If gtins provided (or no fids), resolve fids via variant endpoint
    const resolvedFrom: Array<{ gtin: string; url: string; status: number; fid: string | null; slug: string | null; bodyPreview: string }> = [];
    if (fids.length === 0) {
      const gtinList = gtins.length > 0 ? gtins : await (async () => {
        const { data } = await sb
          .from("products")
          .select("gtin, brands!inner(name)")
          .in("brands.name", ["Nuxe", "Bio-Beauté by Nuxe"])
          .eq("source", "qogita")
          .not("gtin", "is", null)
          .limit(3);
        return (data ?? []).map((r: any) => r.gtin).filter(Boolean);
      })();

      for (const g of gtinList) {
        const url = `${QOGITA}/variants/${g}/?country=BE`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
        const txt = await r.text();
        let js: any = null; try { js = JSON.parse(txt); } catch {}
        const fid = js?.fid ?? null;
        const slug = js?.slug ?? null;
        resolvedFrom.push({ gtin: g, url, status: r.status, fid, slug, bodyPreview: txt.slice(0, 300) });
        if (fid) fids.push(fid);
      }
    }

    // 2) Call the OFFICIAL buyer offers endpoint for each fid
    const tests: any[] = [];
    for (const fid of fids) {
      const url = `${QOGITA}/buyers/variants/${fid}/offers/`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      const raw = await r.text();
      let parsed: any = null; try { parsed = JSON.parse(raw); } catch {}
      tests.push({
        url,
        status: r.status,
        rawBody: raw.length > 4000 ? raw.slice(0, 4000) + "…(truncated)" : raw,
        offersCount: Array.isArray(parsed?.offers) ? parsed.offers.length : null,
        numberOfExcludedOffers: parsed?.numberOfExcludedOffers ?? null,
        firstOfferSample: Array.isArray(parsed?.offers) && parsed.offers[0] ? {
          qid: parsed.offers[0].qid,
          seller: parsed.offers[0].seller,
          inventory: parsed.offers[0].inventory,
          tieredPrices: parsed.offers[0].tieredPrices,
        } : null,
      });

      // 3) Also probe the OLD non-buyer path for comparison (needs slug)
      const resolved = resolvedFrom.find((x) => x.fid === fid);
      if (resolved?.slug) {
        const oldUrl = `${QOGITA}/variants/${fid}/${resolved.slug}/offers/`;
        const or = await fetch(oldUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
        const oraw = await or.text();
        tests[tests.length - 1].oldPathProbe = { url: oldUrl, status: or.status, bodyPreview: oraw.slice(0, 300) };
      }
    }

    return new Response(JSON.stringify({
      login: loginSummary,
      variantResolutions: resolvedFrom,
      buyerOffersTests: tests,
      testedAt: new Date().toISOString(),
    }, null, 2), { headers: cors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: cors });
  }
});
