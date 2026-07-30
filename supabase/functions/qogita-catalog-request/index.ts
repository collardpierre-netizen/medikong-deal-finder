// ─────────────────────────────────────────────────────────────────────────────
// LOT 3 — Enregistrement du webhook + déclenchement des Catalog Downloads.
//
// Actions (POST { action }) :
//   register        → POST /public/webhooks/ (stocke qid + signingSecret chiffré)
//   status          → GET /public/webhooks/ (liste) + config locale
//   test            → POST /public/webhooks/{qid}/send-test-event/ (best effort)
//   unregister      → DELETE /public/webhooks/{qid}
//   request (défaut)→ POST /public/buyers/catalog-downloads/
//
// Stratégie de déclenchement (cron) : marques prioritaires d'abord (export
// léger, filtre brand_names), full catalog beaucoup plus rare.
// Rate limit Qogita : 3 req/min → jamais plus de 2 requêtes par run.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireCronOrService } from "../_shared/cron-or-admin.ts";
import {
  QOGITA_API, qogitaLogin, readConfig, writeConfig, storeSigningSecret,
  CFG_WEBHOOK_QID, CFG_WEBHOOK_URL,
} from "../_shared/qogita-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireCronOrService(req, { allowAdmin: true });
  if (!guard.ok) return json({ error: guard.error }, guard.status);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const body = await req.json().catch(() => ({}));
  const action: string = body.action ?? "request";
  const webhookUrl: string = body.webhookUrl ?? `${supabaseUrl}/functions/v1/qogita-catalog-webhook`;

  try {
    const token = await qogitaLogin(sb);
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // ── register ────────────────────────────────────────────────────────────
    if (action === "register") {
      const res = await fetch(`${QOGITA_API}/public/webhooks/`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          url: webhookUrl,
          eventTypes: ["catalog_download.completed", "catalog_download.failed"],
          description: "MediKong — ingestion référentiel catalogue",
          enabled: true,
        }),
      });
      const text = await res.text();
      if (res.status === 409) {
        return json({ error: "already_registered", detail: text.slice(0, 400) }, 409);
      }
      if (!res.ok) return json({ error: `webhook_create_${res.status}`, detail: text.slice(0, 400) }, 502);
      const data = JSON.parse(text);
      const qid = data.qid ?? data.id;
      const signingSecret = data.signingSecret ?? data.signing_secret;
      if (signingSecret) await storeSigningSecret(sb, signingSecret);
      if (qid) await writeConfig(sb, CFG_WEBHOOK_QID, String(qid));
      await writeConfig(sb, CFG_WEBHOOK_URL, webhookUrl);
      // Le secret n'est JAMAIS renvoyé au client.
      return json({ ok: true, qid, url: webhookUrl, signing_secret_stored: !!signingSecret });
    }

    // ── status ──────────────────────────────────────────────────────────────
    if (action === "status") {
      const res = await fetch(`${QOGITA_API}/public/webhooks/`, { headers: auth });
      const remote = res.ok ? await res.json() : { error: res.status, detail: (await res.text()).slice(0, 300) };
      return json({
        ok: res.ok,
        local: {
          qid: await readConfig(sb, CFG_WEBHOOK_QID),
          url: await readConfig(sb, CFG_WEBHOOK_URL),
          signing_secret_present: !!(await readConfig(sb, "qogita_webhook_signing_secret")),
        },
        remote,
      });
    }

    const qid = await readConfig(sb, CFG_WEBHOOK_QID);

    // ── test event ──────────────────────────────────────────────────────────
    if (action === "test") {
      if (!qid) return json({ error: "webhook_not_registered" }, 400);
      const paths = [
        `/public/webhooks/${qid}/send-test-event/`,
        `/public/webhooks/${qid}/test/`,
      ];
      for (const p of paths) {
        const res = await fetch(`${QOGITA_API}${p}`, {
          method: "POST", headers: auth,
          body: JSON.stringify({ eventType: body.eventType ?? "catalog_download.completed" }),
        });
        const text = await res.text();
        if (res.ok) return json({ ok: true, path: p, detail: text.slice(0, 400) });
        if (res.status !== 404) return json({ error: `test_${res.status}`, path: p, detail: text.slice(0, 400) }, 502);
      }
      return json({ error: "test_endpoint_not_found", tried: paths }, 404);
    }

    // ── unregister ──────────────────────────────────────────────────────────
    if (action === "unregister") {
      if (!qid) return json({ error: "webhook_not_registered" }, 400);
      const res = await fetch(`${QOGITA_API}/public/webhooks/${qid}`, { method: "DELETE", headers: auth });
      return json({ ok: res.ok, status: res.status });
    }

    // ── request : déclenche 1 ou 2 downloads (rate limit 3/min) ─────────────
    if (!qid) return json({ error: "webhook_not_registered", hint: "action=register d'abord" }, 400);

    const requests: { scope: string; filters: Record<string, unknown> }[] = [];

    if (body.filters) {
      requests.push({ scope: body.scope ?? "filtered", filters: body.filters });
    } else if (body.scope === "full") {
      requests.push({ scope: "full", filters: {} });
    } else {
      // Défaut cron : marques prioritaires (export léger).
      const { data: brands } = await sb
        .from("brands")
        .select("name")
        .eq("is_priority", true)
        .order("name", { ascending: true })
        .limit(Number(body.maxBrands ?? 40));
      const names = (brands || []).map((b: { name: string }) => b.name).filter(Boolean);
      if (names.length === 0) return json({ error: "no_priority_brands" }, 400);
      requests.push({ scope: "priority_brands", filters: { brand_names: names } });
    }

    const results: unknown[] = [];
    for (let i = 0; i < requests.length; i++) {
      if (i > 0) await sleep(21_000); // ≤ 3 req/min
      const r = requests[i];
      const res = await fetch(`${QOGITA_API}/public/buyers/catalog-downloads/`, {
        method: "POST", headers: auth, body: JSON.stringify(r.filters),
      });
      const text = await res.text();
      // deno-lint-ignore no-explicit-any
      let payload: any = null;
      try { payload = JSON.parse(text); } catch { /* ignore */ }
      const catalogRequestId = payload?.catalogRequestId ?? payload?.catalog_request_id ?? null;

      await sb.from("qogita_catalog_downloads").insert({
        catalog_request_id: catalogRequestId,
        status: res.ok ? "requested" : "request_error",
        scope: r.scope,
        filters: r.filters,
        requested_at: new Date().toISOString(),
        triggered_by: body.source ?? "manual",
        error_code: res.ok ? null : String(res.status),
        error_message: res.ok ? null : text.slice(0, 400),
      });

      results.push({ scope: r.scope, http: res.status, catalog_request_id: catalogRequestId, detail: res.ok ? undefined : text.slice(0, 300) });
    }

    return json({ ok: true, requested: results });
  } catch (e) {
    console.error("[qogita-catalog-request] fatal", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
