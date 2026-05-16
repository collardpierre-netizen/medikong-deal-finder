// Smoke test : garantit que vendor_order_tokens n'a pas de colonne `id`
// et que le code de get-vendor-order n'utilise que `token` / `sub_order_id`
// comme identifiants (jamais `vot.id` / `tokenRow.id` / `.eq("id", ...)` sur la table tokens).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const dbTestOpts = { sanitizeOps: false, sanitizeResources: false };

Deno.test("vendor_order_tokens n'a pas de colonne `id`", dbTestOpts, async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("vendor_order_tokens")
    .select("id")
    .limit(1);

  assert(error, "La requête SELECT id doit échouer car la colonne n'existe pas");
  assertEquals(data, null);
  const msg = (error?.message ?? "").toLowerCase();
  assert(
    msg.includes("does not exist") || msg.includes("column") || error?.code === "42703",
    `Erreur inattendue: ${error?.code} ${error?.message}`,
  );
});

Deno.test("vendor_order_tokens expose bien token et sub_order_id", dbTestOpts, async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase
    .from("vendor_order_tokens")
    .select("token, sub_order_id, order_id, vendor_id, order_number, expires_at, used_at")
    .limit(1);
  assertEquals(error, null);
});

Deno.test("le code de get-vendor-order n'utilise pas vendor_order_tokens.id", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  // Aucune référence à tokenRow.id / vot.id
  assert(!/tokenRow\s*\.\s*id\b/.test(source), "tokenRow.id ne doit plus apparaître");
  assert(!/\bvot\s*\.\s*id\b/.test(source), "vot.id ne doit plus apparaître");

  // Extrait chaque accès à vendor_order_tokens jusqu'au prochain `;`
  const accesses = source.match(/from\(["']vendor_order_tokens["']\)[\s\S]*?;/g);
  assert(accesses && accesses.length > 0, "Au moins un accès à vendor_order_tokens attendu");

  for (const block of accesses!) {
    // .eq("id", ...) interdit sur la table tokens
    assert(
      !/\.eq\(\s*["']id["']/.test(block),
      `.eq("id", ...) interdit sur vendor_order_tokens : ${block}`,
    );

    // Pour le check du select(), on ignore les sous-sélections imbriquées
    // type `orders:order_id ( id, ... )` et `vendors:vendor_id ( id, ... )`
    // qui appartiennent à d'autres tables.
    const selectMatch = block.match(/\.select\(`([\s\S]*?)`\)|\.select\("([\s\S]*?)"\)/);
    if (selectMatch) {
      const raw = selectMatch[1] ?? selectMatch[2] ?? "";
      const topLevel = raw.replace(/[a-z_]+\s*:\s*[a-z_]+\s*\([^)]*\)/gi, "");
      const topFields = topLevel
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
      assert(
        !topFields.includes("id"),
        `select() top-level sur vendor_order_tokens ne doit pas inclure 'id' : ${topFields.join(", ")}`,
      );
    }
  }

  // L'identifiant utilisé pour update doit être `token`
  assert(
    /\.eq\(\s*["']token["']\s*,\s*token\s*\)/.test(source),
    'Le code doit cibler le token via .eq("token", token)',
  );
});
