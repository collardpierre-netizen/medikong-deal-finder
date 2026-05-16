// Smoke test : garantit que vendor_order_tokens n'a pas de colonne `id`
// et que le code de get-vendor-order n'utilise que `token` et `sub_order_id`
// comme identifiants (jamais `vot.id` / `tokenRow.id` / `.eq("id", ...)` sur la table tokens).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.test("vendor_order_tokens n'a pas de colonne `id`", async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from("vendor_order_tokens")
    .select("id")
    .limit(1);

  assert(error, "La requête SELECT id doit échouer car la colonne n'existe pas");
  assertEquals(data, null);
  // Postgres renvoie 42703 "column ... does not exist"
  const msg = (error?.message ?? "").toLowerCase();
  assert(
    msg.includes("does not exist") || msg.includes("column") || error?.code === "42703",
    `Erreur inattendue: ${error?.code} ${error?.message}`,
  );
});

Deno.test("vendor_order_tokens expose bien token et sub_order_id", async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
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

  // Aucun .eq("id", ...) ou .select("...id...") sur vendor_order_tokens
  const tokensBlockMatch = source.match(
    /from\(["']vendor_order_tokens["']\)[\s\S]*?(?=\n\s*\/\/|\n\s*const\s|\n\s*if\s|\n\s*return|\.maybeSingle\(\)|\.single\(\)|;\s*\n)/g,
  );
  assert(tokensBlockMatch && tokensBlockMatch.length > 0, "Au moins un accès à vendor_order_tokens attendu");
  for (const block of tokensBlockMatch) {
    assert(
      !/\.select\([^)]*\bid\b[^)]*\)/.test(block),
      `select() sur vendor_order_tokens ne doit pas inclure 'id' : ${block}`,
    );
    assert(
      !/\.eq\(\s*["']id["']/.test(block),
      `.eq("id", ...) interdit sur vendor_order_tokens : ${block}`,
    );
  }

  // L'identifiant utilisé pour update doit être `token`
  assert(
    /\.eq\(\s*["']token["']\s*,\s*token\s*\)/.test(source),
    "Le code doit cibler le token via .eq(\"token\", token)",
  );
});
