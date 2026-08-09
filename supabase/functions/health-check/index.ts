// @ts-nocheck — Deno runtime
// Health-check public (non authentifié) du backend MediKong.
// Vérifie la disponibilité de la base de données (lecture légère) et du service
// d'authentification. Ne renvoie AUCUN secret ni donnée métier — uniquement des
// statuts et des latences, afin que le front puisse afficher un message clair.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

type CheckStatus = "up" | "degraded" | "down";

interface CheckResult {
  status: CheckStatus;
  latency_ms: number;
  error: string | null;
}

const DEGRADED_MS = 2500;
const TIMEOUT_MS = 6000;

async function timed(fn: () => Promise<void>): Promise<CheckResult> {
  const started = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
      ),
    ]);
    const latency = Date.now() - started;
    return {
      status: latency > DEGRADED_MS ? "degraded" : "up",
      latency_ms: latency,
      error: null,
    };
  } catch (e) {
    return {
      status: "down",
      latency_ms: Date.now() - started,
      error: e instanceof Error ? e.message : "unknown_error",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    return json(503, {
      status: "down",
      checks: {
        database: { status: "down", latency_ms: 0, error: "missing_env" },
        auth: { status: "down", latency_ms: 0, error: "missing_env" },
      },
      checked_at: new Date().toISOString(),
    });
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Base de données : lecture publique minimale (RLS appliquée, aucune donnée renvoyée).
  const database = await timed(async () => {
    const { error } = await client
      .from("categories")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) throw new Error(error.message);
  });

  // Auth : le endpoint /auth/v1/health répond sans authentification.
  const auth = await timed(async () => {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: anonKey },
    });
    if (!res.ok) throw new Error(`auth_http_${res.status}`);
  });

  const statuses = [database.status, auth.status];
  const overall: CheckStatus = statuses.includes("down")
    ? "down"
    : statuses.includes("degraded")
      ? "degraded"
      : "up";

  return json(overall === "down" ? 503 : 200, {
    status: overall,
    checks: { database, auth },
    checked_at: new Date().toISOString(),
  });
});
