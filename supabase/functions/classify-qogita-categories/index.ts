// Edge function : classifie les catégories Qogita non mappées vers les
// 14 catégories MK (slug `mk-*`) via Lovable AI Gateway (Gemini Flash Lite),
// par batches. Écrit les propositions dans `category_llm_mapping_proposals`
// (mode dry-run par défaut). N'applique RIEN automatiquement —
// l'application passe par la RPC `apply_qogita_llm_mapping(s_bulk)`.
//
// Body : { batch_size?: number=30, max_batches?: number=10, force_resync?: boolean=false }
// Retour : { processed, batches, skipped, errors, ms }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "google/gemini-2.5-flash-lite";

type MkCat = { id: string; slug: string; name_fr: string; name_en: string | null };

async function classifyBatch(
  cats: { qogita_category_id: string; qogita_name: string; products_count: number }[],
  mkCats: MkCat[],
): Promise<Array<{
  qogita_category_id: string;
  suggested_mk_slug: string | null;
  confidence: number;
  reason: string;
}>> {
  const slugList = mkCats
    .map((c) => `- ${c.slug} : ${c.name_fr}${c.name_en ? ` (${c.name_en})` : ""}`)
    .join("\n");

  const items = cats
    .map((c, i) => `${i + 1}. "${c.qogita_name}" (${c.products_count} produits)`)
    .join("\n");

  const tools = [
    {
      type: "function",
      function: {
        name: "classify_categories",
        description:
          "Classifie chaque catégorie Qogita vers UNE des 14 catégories MediKong (slug mk-*) ou null si aucune ne convient.",
        parameters: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "integer", description: "Index 1-based dans la liste" },
                  mk_slug: {
                    type: ["string", "null"],
                    description: "Slug mk-* parmi la liste fournie, ou null",
                  },
                  confidence: {
                    type: "number",
                    description: "0.0 (incertain) à 1.0 (certain)",
                  },
                  reason: { type: "string", description: "Justification courte (1 phrase)" },
                },
                required: ["index", "mk_slug", "confidence", "reason"],
                additionalProperties: false,
              },
            },
          },
          required: ["results"],
          additionalProperties: false,
        },
      },
    },
  ];

  const systemPrompt = `Tu mappes des libellés de catégories produits Qogita (anglais ou multilingue) vers la taxonomie maîtresse MediKong.
Catégories MediKong cibles (utilise le slug exact) :
${slugList}

Règles :
- Choisis le slug le plus pertinent. Si aucune catégorie MK ne convient (ex: "Non classé", catégories trop génériques ou hors-scope pharma/parapharma/beauté/santé), retourne mk_slug=null.
- mk-otc-medicaments = médicaments grand public (analgésiques, rhume, digestion, etc.).
- mk-complements-nutrition = vitamines, minéraux, compléments alimentaires, nutrition médicale.
- mk-hygiene-desinfection = savons, gels antibactériens, désinfectants pour la peau.
- mk-pansements-soins-plaies = pansements, gazes, antiseptiques de plaies.
- mk-diagnostic-autonomie = thermomètres, tensiomètres, glucomètres, aides à la mobilité.
- mk-soins-infirmiers = matériel infirmier, seringues, gants médicaux, sondes.
- mk-maman-bebe = puériculture, lait infantile, couches, soins bébé/grossesse.
- mk-dermatocosmetique = soins visage/peau dermo (anti-âge, acné, hydratation pharma).
- mk-soin-corps-mains = soins corps non-dermo, soin des mains, déodorants.
- mk-capillaire-coiffure = shampoings, soins cheveux, coloration, coiffure.
- mk-maquillage-ongles = maquillage, vernis, faux ongles, gel polish.
- mk-parfumerie = parfums, eaux de toilette, fragrances.
- mk-medecines-complementaires = phytothérapie, homéopathie, huiles essentielles, aromathérapie.
- mk-hygiene-domestique = hygiène maison, lessives, produits ménagers.

Retourne TOUJOURS un confidence ∈ [0,1] honnête (≥0.85 = très sûr, 0.6-0.85 = vraisemblable, <0.6 = douteux).`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Classifie ces catégories :\n${items}` },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "classify_categories" } },
    }),
  });

  if (!res.ok) {
    throw new Error(`AI gateway ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("no tool_call in response");
  const args = JSON.parse(call.function.arguments);

  return (args.results || []).map((r: any) => ({
    qogita_category_id: cats[r.index - 1]?.qogita_category_id,
    suggested_mk_slug: r.mk_slug,
    confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0)),
    reason: String(r.reason || "").slice(0, 500),
  })).filter((r: any) => r.qogita_category_id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();
  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(50, Math.max(1, body.batch_size ?? 30));
    const maxBatches = Math.min(200, Math.max(1, body.max_batches ?? 10));
    const forceResync = !!body.force_resync;
    // Si fourni (0..1), les propositions ≥ seuil sont appliquées immédiatement
    // (création d'aliases + backfill products.primary_category_id) via la RPC bulk.
    const autoApplyThreshold: number | null =
      typeof body.auto_apply_threshold === "number" &&
      body.auto_apply_threshold >= 0 &&
      body.auto_apply_threshold <= 1
        ? body.auto_apply_threshold
        : null;

    // Auth admin via JWT du caller
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userData.user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Charge les 14 cats MK
    const { data: mkCats, error: mkErr } = await admin
      .from("categories")
      .select("id, slug, name_fr, name_en")
      .like("slug", "mk-%")
      .order("display_order");
    if (mkErr) throw mkErr;
    const slugToId = new Map<string, string>();
    for (const c of mkCats!) slugToId.set(c.slug, c.id);

    // Cats Qogita non mappées (toute la vue, ordonnée par volume)
    const { data: unmapped, error: unmErr } = await admin
      .from("admin_unmapped_qogita_categories")
      .select("qogita_category_id, qogita_name, products_count");
    if (unmErr) throw unmErr;

    // Skip celles déjà proposées (sauf force_resync)
    let pool = unmapped || [];
    if (!forceResync && pool.length) {
      const ids = pool.map((p: any) => p.qogita_category_id);
      const { data: existing } = await admin
        .from("category_llm_mapping_proposals")
        .select("qogita_category_id")
        .in("qogita_category_id", ids);
      const seen = new Set((existing || []).map((e: any) => e.qogita_category_id));
      pool = pool.filter((p: any) => !seen.has(p.qogita_category_id));
    }

    let processed = 0;
    let batches = 0;
    let errors = 0;
    const errorSamples: string[] = [];

    for (let i = 0; i < pool.length && batches < maxBatches; i += batchSize) {
      const batch = pool.slice(i, i + batchSize);
      try {
        const results = await classifyBatch(batch, mkCats as MkCat[]);
        const rows = results.map((r) => {
          const c = batch.find((b: any) => b.qogita_category_id === r.qogita_category_id)!;
          const mkId = r.suggested_mk_slug ? slugToId.get(r.suggested_mk_slug) ?? null : null;
          return {
            qogita_category_id: r.qogita_category_id,
            qogita_name: c.qogita_name,
            products_count: c.products_count,
            suggested_mk_slug: r.suggested_mk_slug,
            suggested_mk_category_id: mkId,
            confidence: r.confidence,
            reason: r.reason,
            model: MODEL,
            status: "pending",
          };
        });

        if (rows.length) {
          const { error: upErr } = await admin
            .from("category_llm_mapping_proposals")
            .upsert(rows, { onConflict: "qogita_category_id" });
          if (upErr) throw upErr;
        }
        processed += rows.length;
      } catch (e) {
        errors++;
        errorSamples.push(e instanceof Error ? e.message : String(e));
      }
      batches++;
      // léger rate-limit
      await new Promise((r) => setTimeout(r, 250));
    }

    return new Response(
      JSON.stringify({
        processed,
        batches,
        errors,
        error_samples: errorSamples.slice(0, 5),
        remaining_after: Math.max(0, pool.length - batches * batchSize),
        ms: Date.now() - t0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("classify-qogita-categories error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
