// supabase/functions/_shared/embeddings.ts
//
// Helper d'embeddings pour le matching sémantique catégorie ↔ produit.
//
// IMPORTANT :
//  - Le Lovable AI Gateway ne propose pas (encore) de modèle d'embeddings.
//    On passe donc directement par OpenAI avec text-embedding-3-small (1536 dims).
//  - La clé OPENAI_API_KEY doit être ajoutée comme secret runtime AVANT
//    d'appeler ces fonctions. Sans clé, getEmbedding() throw immédiatement.
//  - Le backfill n'est PAS lancé automatiquement : créer une edge function
//    dédiée (ex: backfill-category-embeddings) qui importe ce module.
//
// Pré-requis DB (déjà en place via migration) :
//  - extension `vector` (pgvector)
//  - colonne `categories.embedding vector(1536)` + index ivfflat cosine
//  - vue `catalog_products` (security_invoker) exposant primary_category_id + status

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dims, ~0,02 $/1M tokens
const MAX_INPUT_CHARS = 8000;

function getApiKey(): string {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Add it as a Supabase secret before calling embeddings.",
    );
  }
  return key;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = getApiKey();
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, MAX_INPUT_CHARS),
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI embeddings error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  return json.data[0].embedding as number[];
}

/**
 * Pré-calcule les embeddings des catégories MediKong N1 actives qui n'en ont pas.
 * À appeler depuis une edge function admin (one-shot ou cron).
 */
export async function backfillCategoryEmbeddings(supabase: any) {
  const { data: cats, error } = await supabase
    .from("categories")
    .select(`
      id,
      slug,
      translations:category_translations(name, description, locale)
    `)
    .eq("level", 1)
    .eq("status", "active")
    .is("embedding", null);

  if (error) throw error;

  const results: Array<{ id: string; slug: string; ok: boolean; error?: string }> = [];

  for (const c of cats ?? []) {
    try {
      const en = c.translations?.find((t: any) => t.locale === "en");
      const fr = c.translations?.find((t: any) => t.locale === "fr");
      const nl = c.translations?.find((t: any) => t.locale === "nl");

      const examples = await getExampleProducts(supabase, c.id, 8);

      const text = [
        en?.name,
        fr?.name,
        nl?.name,
        en?.description,
        fr?.description,
        examples.length ? "Examples: " + examples.join(", ") : null,
      ]
        .filter(Boolean)
        .join(" | ");

      if (!text.trim()) {
        results.push({ id: c.id, slug: c.slug, ok: false, error: "empty input" });
        continue;
      }

      const emb = await getEmbedding(text);

      const { error: updErr } = await supabase
        .from("categories")
        .update({ embedding: emb })
        .eq("id", c.id);

      if (updErr) throw updErr;

      results.push({ id: c.id, slug: c.slug, ok: true });
    } catch (e) {
      results.push({
        id: c.id,
        slug: c.slug,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return results;
}

async function getExampleProducts(
  supabase: any,
  categoryId: string,
  limit: number,
): Promise<string[]> {
  const { data } = await supabase
    .from("catalog_products")
    .select("name")
    .eq("primary_category_id", categoryId)
    .eq("status", "active")
    .limit(limit);
  return (data ?? []).map((p: any) => p.name).filter(Boolean);
}
