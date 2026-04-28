// Edge Function: db-backup-export
// Génère un dump SQL des tables sélectionnées et l'upload dans le bucket privé `db-backups`.
// Réservé aux admins (vérifié via l'auth utilisateur + RPC is_admin).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tables critiques exportées par défaut (peuvent être surchargées via le body)
const DEFAULT_TABLES = [
  "brands",
  "categories",
  "products",
  "offers",
  "vendors",
  "manufacturers",
  "product_market_codes",
  "brand_reviews",
  "cms_settings",
];

const BUCKET = "db-backups";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  )!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization" }, 401);
  }

  // 1) Authentifier l'utilisateur
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: "Invalid auth" }, 401);
  }
  const userId = userData.user.id;

  // 2) Vérifier qu'il est admin
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: isAdmin, error: adminErr } = await admin.rpc("is_admin", {
    _user_id: userId,
  });
  if (adminErr || !isAdmin) {
    return json({ error: "Admin only" }, 403);
  }

  // 3) Lire le body (tables optionnelles)
  let tables = DEFAULT_TABLES;
  try {
    const body = await req.json();
    if (Array.isArray(body?.tables) && body.tables.length > 0) {
      tables = body.tables.filter(
        (t: unknown) => typeof t === "string" && /^[a-z_][a-z0-9_]*$/.test(t),
      );
    }
  } catch {
    // body vide → tables par défaut
  }

  if (tables.length === 0) {
    return json({ error: "No valid tables" }, 400);
  }

  const startedAt = Date.now();
  let totalRows = 0;
  let dumpParts: string[] = [
    `-- ============================================================`,
    `-- MediKong DB backup`,
    `-- Generated at : ${new Date().toISOString()}`,
    `-- Triggered by : ${userId}`,
    `-- Tables       : ${tables.join(", ")}`,
    `-- ============================================================`,
    `-- WARNING : data-only dump (INSERTs). Schema must already exist.`,
    `--`,
    `SET session_replication_role = 'replica';`,
    ``,
  ];

  // 4) Exporter chaque table via la RPC
  // On utilise un client utilisateur pour que SECURITY DEFINER + is_admin() check passent.
  for (const table of tables) {
    dumpParts.push(`-- === Table: public.${table} ===`);
    const { data, error } = await userClient.rpc("export_table_as_sql", {
      _table_name: table,
    });
    if (error) {
      const msg = `-- ERROR exporting ${table}: ${error.message}`;
      console.error(msg);
      dumpParts.push(msg, "");
      continue;
    }
    const rows = (data ?? []) as Array<{ sql_line: string }>;
    totalRows += rows.length;
    dumpParts.push(`-- Rows: ${rows.length}`);
    for (const r of rows) dumpParts.push(r.sql_line);
    dumpParts.push("");
  }

  dumpParts.push(`SET session_replication_role = 'origin';`, "-- End of dump");
  const dump = dumpParts.join("\n");
  const sizeBytes = new TextEncoder().encode(dump).length;

  // 5) Upload dans le bucket
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/Z$/, "Z");
  const path = `manual/${ts}_dump.sql`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, new Blob([dump], { type: "application/sql" }), {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadErr) {
    await admin.from("db_backup_logs").insert({
      triggered_by: userId,
      storage_path: path,
      tables_included: tables,
      total_rows: totalRows,
      size_bytes: sizeBytes,
      status: "failed",
      error_message: uploadErr.message,
      duration_ms: Date.now() - startedAt,
    });
    return json({ error: `Upload failed: ${uploadErr.message}` }, 500);
  }

  // 6) Log + URL signée (1h)
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);

  await admin.from("db_backup_logs").insert({
    triggered_by: userId,
    storage_path: path,
    tables_included: tables,
    total_rows: totalRows,
    size_bytes: sizeBytes,
    status: "success",
    duration_ms: Date.now() - startedAt,
  });

  return json({
    success: true,
    storage_path: path,
    signed_url: signed?.signedUrl ?? null,
    size_bytes: sizeBytes,
    total_rows: totalRows,
    tables,
    duration_ms: Date.now() - startedAt,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
